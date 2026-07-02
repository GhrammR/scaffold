import { useCallback, useState } from 'react'
import type { LLMMessage, LLMProvider } from '../llm/LLMProvider'
import { LLMProviderError } from '../llm/LLMProvider'
import type { CoverageStatus, Decision } from '../interview/types'
import { SCAFFOLD_TOOL, SCAFFOLD_TOOL_NAME } from './scaffoldTool'
import { buildGenerationSystemPrompt } from './generationSystemPrompt'
import { buildRevisionSystemPrompt } from './revisionSystemPrompt'
import { buildRegenerateWithRevisionsSystemPrompt } from './regenerateWithRevisionsSystemPrompt'
import { buildScaffoldFileTree } from './scaffoldFileTree'
import { validateScaffold } from './validateScaffold'
import { countDiffTotals, diffScaffold, summarizeDiff, type ScaffoldDiffSummary } from './diffScaffold'
import type { GeneratedScaffold } from './types'
import { loadSession, saveSession } from '../storage/sessionPersistence'

export type GenerationStatus = 'idle' | 'loading' | 'error' | 'done'

// path -> file content, e.g. { 'CLAUDE.md': '...', '.agent_governance/rules/foo.md': '...' }
export type ScaffoldFileTree = Record<string, string>

function buildFileTree(scaffold: GeneratedScaffold): ScaffoldFileTree {
  const tree: ScaffoldFileTree = {}
  for (const entry of buildScaffoldFileTree(scaffold)) {
    tree[entry.path] = entry.content
  }
  return tree
}

export interface RevisionHistoryEntry {
  request: string
  diff: ScaffoldDiffSummary
  previousFileTree: ScaffoldFileTree
  nextFileTree: ScaffoldFileTree
}

export type RegenerationKind = 'fresh' | 'with-revisions'

export interface RegenerationMarker {
  kind: RegenerationKind
  diff: ScaffoldDiffSummary
  previousFileTree: ScaffoldFileTree
  nextFileTree: ScaffoldFileTree
}

export interface HistoryLineage {
  regeneration: RegenerationMarker
  revisions: RevisionHistoryEntry[]
}

export interface UseGenerationState {
  status: GenerationStatus
  errorMessage?: string
  scaffold?: GeneratedScaffold
  fileTree?: ScaffoldFileTree
  revisionMessages: LLMMessage[]
  lineages: HistoryLineage[]
  openRevisions: RevisionHistoryEntry[]
  lastDiffSummary?: string
  noOpWarning?: string
}

// The model occasionally stringifies parts of the structured tool output (returning
// escaped JSON text instead of the object/array the schema requires) — sometimes the
// whole input, sometimes just claudeMd or slicePlan, sometimes a field nested inside
// one of those. Before rejecting the shape, try to recover every level of this.
function tryParseJSON(value: unknown): unknown {
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    return value // Not valid JSON either — leave unchanged; the shape check downstream will reject it.
  }
}

function normalizeScaffoldInput(input: unknown): unknown {
  // Whole tool input arrived as a JSON string instead of an object.
  const working = tryParseJSON(input)
  if (typeof working !== 'object' || working === null) return working

  const normalized: Record<string, unknown> = { ...(working as Record<string, unknown>) }

  normalized.claudeMd = tryParseJSON(normalized.claudeMd)
  normalized.slicePlan = tryParseJSON(normalized.slicePlan)

  if (typeof normalized.claudeMd === 'object' && normalized.claudeMd !== null) {
    const claudeMd: Record<string, unknown> = { ...(normalized.claudeMd as Record<string, unknown>) }

    // The model sometimes stuffs the whole scaffold into claudeMd (occasionally
    // as a single stringified blob), nesting slicePlan inside it instead of
    // returning it as a top-level sibling key. If there's no valid top-level
    // slicePlan already, lift a nested one out of claudeMd up to the top level.
    const hasValidTopLevelSlicePlan =
      typeof normalized.slicePlan === 'object' &&
      normalized.slicePlan !== null &&
      Array.isArray((normalized.slicePlan as Record<string, unknown>).slices)
    if (!hasValidTopLevelSlicePlan && 'slicePlan' in claudeMd) {
      normalized.slicePlan = tryParseJSON(claudeMd.slicePlan)
      delete claudeMd.slicePlan
    }

    for (const field of ['hardInvariants', 'softDecisions', 'knownForks', 'conventions']) {
      claudeMd[field] = tryParseJSON(claudeMd[field])
    }
    normalized.claudeMd = claudeMd
  }

  if (typeof normalized.slicePlan === 'object' && normalized.slicePlan !== null) {
    const slicePlan: Record<string, unknown> = { ...(normalized.slicePlan as Record<string, unknown>) }
    slicePlan.slices = tryParseJSON(slicePlan.slices)
    normalized.slicePlan = slicePlan
  }

  return normalized
}

function isGeneratedScaffold(input: unknown): input is GeneratedScaffold {
  if (typeof input !== 'object' || input === null) return false
  const candidate = input as Record<string, unknown>
  if (typeof candidate.claudeMd !== 'object' || candidate.claudeMd === null) return false
  if (typeof candidate.slicePlan !== 'object' || candidate.slicePlan === null) return false
  const claudeMd = candidate.claudeMd as Record<string, unknown>
  const slicePlan = candidate.slicePlan as Record<string, unknown>
  return (
    typeof claudeMd.projectSummary === 'string' &&
    typeof claudeMd.stackArchitecture === 'string' &&
    Array.isArray(claudeMd.hardInvariants) &&
    Array.isArray(claudeMd.softDecisions) &&
    Array.isArray(claudeMd.knownForks) &&
    Array.isArray(claudeMd.conventions) &&
    Array.isArray(slicePlan.slices)
  )
}

function initialState(): UseGenerationState {
  const persisted = loadSession()
  if (persisted?.generatedScaffold) {
    return {
      status: 'done',
      scaffold: persisted.generatedScaffold,
      fileTree: buildFileTree(persisted.generatedScaffold),
      revisionMessages: persisted.revisionMessages ?? [],
      lineages: persisted.lineages ?? [],
      openRevisions: persisted.openRevisions ?? [],
    }
  }
  return { status: 'idle', revisionMessages: [], lineages: [], openRevisions: [] }
}

function persistScaffold(
  scaffold: GeneratedScaffold,
  revisionMessages: LLMMessage[],
  lineages: HistoryLineage[],
  openRevisions: RevisionHistoryEntry[],
): void {
  const existing = loadSession()
  saveSession({
    messages: existing?.messages ?? [],
    coverage: existing?.coverage ?? [],
    decisions: existing?.decisions ?? [],
    readyToGenerate: existing?.readyToGenerate ?? false,
    doneWarning: existing?.doneWarning,
    generatedScaffold: scaffold,
    revisionMessages,
    lineages,
    openRevisions,
  })
}

type AttemptResult =
  | { kind: 'success'; scaffold: GeneratedScaffold }
  | { kind: 'retryable'; correction: string; finalErrorMessage: string }
  | { kind: 'fatal'; message: string }

async function attemptScaffoldCall(
  provider: LLMProvider,
  systemPrompt: string,
  messages: LLMMessage[],
  decisionsForValidation: Decision[],
  logLabel: string,
): Promise<AttemptResult> {
  try {
    const response = await provider.complete({
      system: systemPrompt,
      messages,
      tools: [SCAFFOLD_TOOL],
      toolChoice: { type: 'tool', name: SCAFFOLD_TOOL_NAME },
    })

    if (!response.toolUse) {
      console.error(
        `[${logLabel}] Model returned text instead of calling generate_scaffold (forced tool_choice was not honored). Raw text response:`,
        response.text,
      )
      return {
        kind: 'retryable',
        correction:
          'You must report your response through the generate_scaffold tool, not as plain text. Please try again using the tool.',
        finalErrorMessage:
          'The model returned plain text instead of calling generate_scaffold (forced tool_choice was not honored). See the browser console for the raw response.',
      }
    }

    const normalizedInput = normalizeScaffoldInput(response.toolUse.input)
    if (!isGeneratedScaffold(normalizedInput)) {
      console.error(
        `[${logLabel}] Tool output did not match the expected GeneratedScaffold shape (even after attempting to recover stringified sub-fields).`,
      )
      console.error(`[${logLabel}] Raw tool_use input (inspectable object):`, response.toolUse.input)
      try {
        console.error(
          `[${logLabel}] Raw tool_use input (JSON, copy/paste-able):\n${JSON.stringify(response.toolUse.input, null, 2)}`,
        )
      } catch (stringifyError) {
        console.error(`[${logLabel}] Raw tool_use input could not be JSON.stringify'd:`, stringifyError)
      }
      console.error(`[${logLabel}] Input after normalization attempts (still invalid):`, normalizedInput)
      return {
        kind: 'retryable',
        correction:
          'Your last response did not match the required shape for generate_scaffold. Please try again, including every required field.',
        finalErrorMessage:
          "The model's tool output did not match the expected shape (missing or mistyped fields). See the browser console for the raw response.",
      }
    }

    const scaffold = normalizedInput
    const problems = validateScaffold(scaffold, decisionsForValidation)

    if (problems.length > 0) {
      console.error(`[${logLabel}] Parsed scaffold failed validation:`, problems, 'Raw scaffold:', scaffold)
      return {
        kind: 'retryable',
        correction: `Your last response had problems: ${problems.join(' ')} Please regenerate, fixing these specifically.`,
        finalErrorMessage: `The generated scaffold is still incomplete: ${problems.join(' ')}`,
      }
    }

    return { kind: 'success', scaffold }
  } catch (error) {
    console.error(`[${logLabel}] LLMProvider.complete() threw:`, error)
    const message = error instanceof LLMProviderError ? error.message : 'Something went wrong. Please try again.'
    return { kind: 'fatal', message }
  }
}

async function runScaffoldCall(
  provider: LLMProvider,
  systemPrompt: string,
  messages: LLMMessage[],
  decisionsForValidation: Decision[],
  logLabel: string,
): Promise<{ scaffold: GeneratedScaffold } | { errorMessage: string }> {
  const first = await attemptScaffoldCall(provider, systemPrompt, messages, decisionsForValidation, logLabel)
  if (first.kind === 'success') return { scaffold: first.scaffold }
  if (first.kind === 'fatal') return { errorMessage: first.message }

  const retryMessages: LLMMessage[] = [...messages, { role: 'user', content: first.correction }]
  const second = await attemptScaffoldCall(provider, systemPrompt, retryMessages, decisionsForValidation, logLabel)
  if (second.kind === 'success') return { scaffold: second.scaffold }
  if (second.kind === 'fatal') return { errorMessage: second.message }
  return { errorMessage: second.finalErrorMessage }
}

function allRevisionRequests(lineages: HistoryLineage[], openRevisions: RevisionHistoryEntry[]): string[] {
  return [...lineages.flatMap((l) => l.revisions.map((r) => r.request)), ...openRevisions.map((r) => r.request)]
}

export function useGeneration(provider: LLMProvider, messages: LLMMessage[], coverage: CoverageStatus[], decisions: Decision[]) {
  const [state, setState] = useState<UseGenerationState>(initialState)

  // Plain Regenerate: a hard reset. Wipes ALL history — closed lineages and
  // the open revisions alike — and starts clean, as if this were the very
  // first generation. The lineage/history feature is exclusive to
  // regenerateWithRevisions(); plain Regenerate never creates a lineage entry.
  const commitFreshScaffold = useCallback((freshScaffold: GeneratedScaffold): void => {
    const fileTree = buildFileTree(freshScaffold)

    persistScaffold(freshScaffold, [], [], [])
    setState({
      status: 'done',
      scaffold: freshScaffold,
      fileTree,
      revisionMessages: [],
      lineages: [],
      openRevisions: [],
      lastDiffSummary: undefined,
      noOpWarning: undefined,
    })
  }, [])

  // Regenerate with revisions: builds the RegenerationMarker from the scaffold
  // as it stood right before this call, closes the currently open lineage
  // under it (preserving history), and commits the fresh result.
  const commitRegenerationWithRevisions = useCallback(
    (freshScaffold: GeneratedScaffold): void => {
      const fileTree = buildFileTree(freshScaffold)

      const previousScaffold = state.scaffold
      let nextLineages = state.lineages

      if (previousScaffold) {
        const previousFileTree = state.fileTree ?? buildFileTree(previousScaffold)
        const marker: RegenerationMarker = {
          kind: 'with-revisions',
          diff: diffScaffold(previousScaffold, freshScaffold),
          previousFileTree,
          nextFileTree: fileTree,
        }
        nextLineages = [...state.lineages, { regeneration: marker, revisions: state.openRevisions }]
      }
      // No previous scaffold — nothing to diff against — no lineage entry.
      // (In practice regenerateWithRevisions is hidden until a scaffold
      // exists, so this branch is defensive rather than reachable.)

      persistScaffold(freshScaffold, [], nextLineages, [])
      setState({
        status: 'done',
        scaffold: freshScaffold,
        fileTree,
        revisionMessages: [],
        lineages: nextLineages,
        openRevisions: [],
        lastDiffSummary: undefined,
        noOpWarning: undefined,
      })
    },
    [state.scaffold, state.fileTree, state.lineages, state.openRevisions],
  )

  const runGenerate = useCallback(async (): Promise<void> => {
    setState((prev) => ({ ...prev, status: 'loading', errorMessage: undefined }))

    // The interview transcript's last turn is the AI's own "ready to generate?"
    // proposal. Anthropic requires the message list to end on a user turn (no
    // assistant-message prefill), so always append a trailing user turn here.
    const requestMessages: LLMMessage[] = [
      ...messages,
      { role: 'user', content: 'Generate the scaffold now based on our conversation.' },
    ]

    const outcome = await runScaffoldCall(
      provider,
      buildGenerationSystemPrompt(coverage, decisions),
      requestMessages,
      decisions,
      'generation',
    )

    if ('errorMessage' in outcome) {
      setState((prev) => ({ ...prev, status: 'error', errorMessage: outcome.errorMessage }))
      return
    }

    try {
      commitFreshScaffold(outcome.scaffold)
    } catch (renderError) {
      console.error('[generation] Rendering the validated scaffold threw an error:', renderError, 'Scaffold:', outcome.scaffold)
      setState((prev) => ({
        ...prev,
        status: 'error',
        errorMessage: 'The scaffold passed validation but failed to render. See the browser console for details.',
      }))
    }
  }, [provider, messages, coverage, decisions, commitFreshScaffold])

  const generate = useCallback(() => {
    void runGenerate()
  }, [runGenerate])

  const runRegenerateWithRevisions = useCallback(async (): Promise<void> => {
    const requests = allRevisionRequests(state.lineages, state.openRevisions)
    setState((prev) => ({ ...prev, status: 'loading', errorMessage: undefined }))

    const requestMessages: LLMMessage[] = [
      ...messages,
      { role: 'user', content: 'Generate the scaffold now based on our conversation.' },
    ]

    const outcome = await runScaffoldCall(
      provider,
      buildRegenerateWithRevisionsSystemPrompt(coverage, decisions, requests),
      requestMessages,
      decisions,
      'regenerate-with-revisions',
    )

    if ('errorMessage' in outcome) {
      setState((prev) => ({ ...prev, status: 'error', errorMessage: outcome.errorMessage }))
      return
    }

    try {
      commitRegenerationWithRevisions(outcome.scaffold)
    } catch (renderError) {
      console.error(
        '[regenerate-with-revisions] Rendering the validated scaffold threw an error:',
        renderError,
        'Scaffold:',
        outcome.scaffold,
      )
      setState((prev) => ({
        ...prev,
        status: 'error',
        errorMessage: 'The scaffold passed validation but failed to render. See the browser console for details.',
      }))
    }
  }, [provider, messages, coverage, decisions, state.lineages, state.openRevisions, commitRegenerationWithRevisions])

  const regenerateWithRevisions = useCallback(() => {
    void runRegenerateWithRevisions()
  }, [runRegenerateWithRevisions])

  const runRevise = useCallback(
    async (request: string): Promise<void> => {
      const currentScaffold = state.scaffold
      if (!currentScaffold) return
      // Captured before setState overwrites them — this is the tree the
      // inline line-level diff will compare against.
      const previousFileTree = state.fileTree ?? buildFileTree(currentScaffold)

      const requestMessages: LLMMessage[] = [...state.revisionMessages, { role: 'user', content: request }]
      setState((prev) => ({ ...prev, status: 'loading', errorMessage: undefined, revisionMessages: requestMessages }))

      // revisionMessages already ends on the user's request — no trailing
      // instruction to append for the first attempt (only the corrective
      // retry, if needed, appends its own follow-up user turn).
      const outcome = await runScaffoldCall(
        provider,
        buildRevisionSystemPrompt(currentScaffold),
        requestMessages,
        [],
        'revision',
      )

      if ('errorMessage' in outcome) {
        setState((prev) => ({ ...prev, status: 'error', errorMessage: outcome.errorMessage }))
        return
      }

      try {
        const diff = diffScaffold(currentScaffold, outcome.scaffold)
        const summary = summarizeDiff(diff)
        const fileTree = buildFileTree(outcome.scaffold)
        const totals = countDiffTotals(diff)
        const isNoOp = totals.added === 0 && totals.removed === 0 && totals.modified === 0
        const confirmedRevisionMessages: LLMMessage[] = [...requestMessages, { role: 'assistant', content: summary }]
        const confirmedOpenRevisions: RevisionHistoryEntry[] = [
          ...state.openRevisions,
          {
            request,
            diff,
            previousFileTree,
            nextFileTree: fileTree,
          },
        ]
        persistScaffold(outcome.scaffold, confirmedRevisionMessages, state.lineages, confirmedOpenRevisions)
        setState({
          status: 'done',
          scaffold: outcome.scaffold,
          fileTree,
          revisionMessages: confirmedRevisionMessages,
          lineages: state.lineages,
          openRevisions: confirmedOpenRevisions,
          lastDiffSummary: summary,
          noOpWarning: isNoOp
            ? 'The model returned no changes for that request — try rephrasing.'
            : undefined,
        })
      } catch (renderError) {
        console.error('[revision] Rendering the revised scaffold threw an error:', renderError, 'Scaffold:', outcome.scaffold)
        setState((prev) => ({
          ...prev,
          status: 'error',
          errorMessage: 'The revised scaffold passed validation but failed to render. See the browser console for details.',
        }))
      }
    },
    [provider, state.scaffold, state.fileTree, state.revisionMessages, state.lineages, state.openRevisions],
  )

  const revise = useCallback(
    (request: string) => {
      void runRevise(request)
    },
    [runRevise],
  )

  const dismissError = useCallback(() => {
    setState((prev) => ({ ...prev, status: 'idle', errorMessage: undefined }))
  }, [])

  return { state, generate, regenerateWithRevisions, revise, dismissError }
}

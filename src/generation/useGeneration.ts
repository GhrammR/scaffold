import { useCallback, useState } from 'react'
import type { LLMMessage, LLMProvider } from '../llm/LLMProvider'
import { LLMProviderError } from '../llm/LLMProvider'
import type { CoverageStatus, Decision } from '../interview/types'
import { SCAFFOLD_TOOL, SCAFFOLD_TOOL_NAME } from './scaffoldTool'
import { buildGenerationSystemPrompt } from './generationSystemPrompt'
import { buildRevisionSystemPrompt } from './revisionSystemPrompt'
import { renderClaudeMd, renderSlicePlan } from './renderMarkdown'
import { validateScaffold } from './validateScaffold'
import { diffScaffold, summarizeDiff } from './diffScaffold'
import type { GeneratedScaffold } from './types'
import { loadSession, saveSession } from '../storage/sessionPersistence'

export type GenerationStatus = 'idle' | 'loading' | 'error' | 'done'

export interface UseGenerationState {
  status: GenerationStatus
  errorMessage?: string
  scaffold?: GeneratedScaffold
  claudeMdText?: string
  slicePlanText?: string
  revisionMessages: LLMMessage[]
  lastDiffSummary?: string
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
      claudeMdText: renderClaudeMd(persisted.generatedScaffold.claudeMd),
      slicePlanText: renderSlicePlan(persisted.generatedScaffold.slicePlan),
      revisionMessages: persisted.revisionMessages ?? [],
    }
  }
  return { status: 'idle', revisionMessages: [] }
}

function persistScaffold(scaffold: GeneratedScaffold, revisionMessages: LLMMessage[]): void {
  const existing = loadSession()
  saveSession({
    messages: existing?.messages ?? [],
    coverage: existing?.coverage ?? [],
    decisions: existing?.decisions ?? [],
    readyToGenerate: existing?.readyToGenerate ?? false,
    doneWarning: existing?.doneWarning,
    generatedScaffold: scaffold,
    revisionMessages,
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

    if (!isGeneratedScaffold(response.toolUse.input)) {
      console.error(
        `[${logLabel}] Tool output did not match the expected GeneratedScaffold shape. Raw tool_use input:`,
        response.toolUse.input,
      )
      return {
        kind: 'retryable',
        correction:
          'Your last response did not match the required shape for generate_scaffold. Please try again, including every required field.',
        finalErrorMessage:
          "The model's tool output did not match the expected shape (missing or mistyped fields). See the browser console for the raw response.",
      }
    }

    const scaffold = response.toolUse.input
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

export function useGeneration(provider: LLMProvider, messages: LLMMessage[], coverage: CoverageStatus[], decisions: Decision[]) {
  const [state, setState] = useState<UseGenerationState>(initialState)

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
      const claudeMdText = renderClaudeMd(outcome.scaffold.claudeMd)
      const slicePlanText = renderSlicePlan(outcome.scaffold.slicePlan)
      // A fresh generation starts a new scaffold lineage — any prior revision
      // conversation was about the old scaffold and shouldn't carry over.
      persistScaffold(outcome.scaffold, [])
      setState({
        status: 'done',
        scaffold: outcome.scaffold,
        claudeMdText,
        slicePlanText,
        revisionMessages: [],
        lastDiffSummary: undefined,
      })
    } catch (renderError) {
      console.error('[generation] Rendering the validated scaffold threw an error:', renderError, 'Scaffold:', outcome.scaffold)
      setState((prev) => ({
        ...prev,
        status: 'error',
        errorMessage: 'The scaffold passed validation but failed to render. See the browser console for details.',
      }))
    }
  }, [provider, messages, coverage, decisions])

  const generate = useCallback(() => {
    void runGenerate()
  }, [runGenerate])

  const runRevise = useCallback(
    async (request: string): Promise<void> => {
      const currentScaffold = state.scaffold
      if (!currentScaffold) return

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
        const summary = summarizeDiff(diffScaffold(currentScaffold, outcome.scaffold))
        const claudeMdText = renderClaudeMd(outcome.scaffold.claudeMd)
        const slicePlanText = renderSlicePlan(outcome.scaffold.slicePlan)
        const confirmedRevisionMessages: LLMMessage[] = [...requestMessages, { role: 'assistant', content: summary }]
        persistScaffold(outcome.scaffold, confirmedRevisionMessages)
        setState({
          status: 'done',
          scaffold: outcome.scaffold,
          claudeMdText,
          slicePlanText,
          revisionMessages: confirmedRevisionMessages,
          lastDiffSummary: summary,
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
    [provider, state.scaffold, state.revisionMessages],
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

  return { state, generate, revise, dismissError }
}

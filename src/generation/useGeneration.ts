import { useCallback, useState } from 'react'
import type { LLMMessage, LLMProvider } from '../llm/LLMProvider'
import { LLMProviderError } from '../llm/LLMProvider'
import type { CoverageStatus, Decision } from '../interview/types'
import { SCAFFOLD_TOOL, SCAFFOLD_TOOL_NAME } from './scaffoldTool'
import { buildGenerationSystemPrompt } from './generationSystemPrompt'
import { renderClaudeMd, renderSlicePlan } from './renderMarkdown'
import { validateScaffold } from './validateScaffold'
import type { GeneratedScaffold } from './types'
import { loadSession, saveSession } from '../storage/sessionPersistence'

export type GenerationStatus = 'idle' | 'loading' | 'error' | 'done'

export interface UseGenerationState {
  status: GenerationStatus
  errorMessage?: string
  scaffold?: GeneratedScaffold
  claudeMdText?: string
  slicePlanText?: string
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
    }
  }
  return { status: 'idle' }
}

function persistScaffold(scaffold: GeneratedScaffold): void {
  const existing = loadSession()
  saveSession({
    messages: existing?.messages ?? [],
    coverage: existing?.coverage ?? [],
    decisions: existing?.decisions ?? [],
    readyToGenerate: existing?.readyToGenerate ?? false,
    doneWarning: existing?.doneWarning,
    generatedScaffold: scaffold,
  })
}

export function useGeneration(provider: LLMProvider, messages: LLMMessage[], coverage: CoverageStatus[], decisions: Decision[]) {
  const [state, setState] = useState<UseGenerationState>(initialState)

  const runGeneration = useCallback(
    async (correction?: string): Promise<void> => {
      setState((prev) => ({ ...prev, status: 'loading', errorMessage: undefined }))
      try {
        // The interview transcript's last turn is the AI's own "ready to generate?"
        // proposal. Anthropic requires the message list to end on a user turn (no
        // assistant-message prefill), so always append a trailing user turn here —
        // either the correction, or the initial generation instruction.
        const requestMessages: LLMMessage[] = [
          ...messages,
          { role: 'user', content: correction ?? 'Generate the scaffold now based on our conversation.' },
        ]

        const response = await provider.complete({
          system: buildGenerationSystemPrompt(coverage, decisions),
          messages: requestMessages,
          tools: [SCAFFOLD_TOOL],
          toolChoice: { type: 'tool', name: SCAFFOLD_TOOL_NAME },
        })

        if (!response.toolUse) {
          console.error(
            '[generation] Model returned text instead of calling generate_scaffold (forced tool_choice was not honored). Raw text response:',
            response.text,
          )
          if (!correction) {
            await runGeneration(
              'You must report your response through the generate_scaffold tool, not as plain text. Please try again using the tool.',
            )
            return
          }
          setState({
            status: 'error',
            errorMessage:
              'The model returned plain text instead of calling generate_scaffold (forced tool_choice was not honored). See the browser console for the raw response.',
          })
          return
        }

        if (!isGeneratedScaffold(response.toolUse.input)) {
          console.error(
            '[generation] Tool output did not match the expected GeneratedScaffold shape. Raw tool_use input:',
            response.toolUse.input,
          )
          if (!correction) {
            await runGeneration(
              'Your last response did not match the required shape for generate_scaffold. Please try again, including every required field.',
            )
            return
          }
          setState({
            status: 'error',
            errorMessage:
              "The model's tool output did not match the expected shape (missing or mistyped fields). See the browser console for the raw response.",
          })
          return
        }

        const scaffold = response.toolUse.input
        const problems = validateScaffold(scaffold, decisions)

        if (problems.length > 0) {
          console.error('[generation] Parsed scaffold failed validation:', problems, 'Raw scaffold:', scaffold)
          if (!correction) {
            await runGeneration(
              `Your last response had problems: ${problems.join(' ')} Please regenerate, fixing these specifically.`,
            )
            return
          }
          setState({
            status: 'error',
            errorMessage: `The generated scaffold is still incomplete: ${problems.join(' ')}`,
          })
          return
        }

        try {
          const claudeMdText = renderClaudeMd(scaffold.claudeMd)
          const slicePlanText = renderSlicePlan(scaffold.slicePlan)
          persistScaffold(scaffold)
          setState({ status: 'done', scaffold, claudeMdText, slicePlanText })
        } catch (renderError) {
          console.error('[generation] Rendering the validated scaffold threw an error:', renderError, 'Scaffold:', scaffold)
          setState({
            status: 'error',
            errorMessage: 'The scaffold passed validation but failed to render. See the browser console for details.',
          })
        }
      } catch (error) {
        console.error('[generation] LLMProvider.complete() threw:', error)
        const message = error instanceof LLMProviderError ? error.message : 'Something went wrong. Please try again.'
        setState((prev) => ({ ...prev, status: 'error', errorMessage: message }))
      }
    },
    [provider, messages, coverage, decisions],
  )

  const generate = useCallback(() => {
    void runGeneration()
  }, [runGeneration])

  const dismissError = useCallback(() => {
    setState((prev) => ({ ...prev, status: 'idle', errorMessage: undefined }))
  }, [])

  return { state, generate, dismissError }
}

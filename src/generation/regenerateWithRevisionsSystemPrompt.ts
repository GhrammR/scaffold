import type { CoverageStatus, Decision } from '../interview/types'
import { buildGenerationSystemPrompt } from './generationSystemPrompt'

export function buildRegenerateWithRevisionsSystemPrompt(
  coverage: CoverageStatus[],
  decisions: Decision[],
  revisionRequests: string[],
): string {
  const base = buildGenerationSystemPrompt(coverage, decisions)
  if (revisionRequests.length === 0) return base

  const requestsList = revisionRequests.map((r, i) => `${i + 1}. ${r}`).join('\n')

  return `${base}

ADDITIONAL CONTEXT — this is a FULL REGENERATION, not a targeted edit. You may reorganize, reword, and rebuild any section freely from the interview above. However, the user made these refinement requests during earlier iterations on a previous draft, and the fresh scaffold you produce now MUST still reflect them, woven naturally into whichever section they belong — not bolted on as an addendum:
${requestsList}`
}

import type { CoverageStatus, Decision } from '../interview/types'

export function buildGenerationSystemPrompt(coverage: CoverageStatus[], decisions: Decision[]): string {
  const decisionsList = decisions
    .map((d) => `- [${d.kind.toUpperCase()}] (${d.area}) ${d.summary}`)
    .join('\n')
  const coverageList = coverage.map((c) => `- ${c.label} (${c.status})${c.note ? `: ${c.note}` : ''}`).join('\n')

  return `You are generating a governance scaffold for a coding agent, from a completed interview about a project called Scaffold. You are given the full interview transcript (in the conversation below), plus this decisions log and coverage snapshot as ground truth:

DECISIONS LOG (authoritative — do not invent, drop, or re-tier any of these):
${decisionsList || '(none)'}

COVERAGE SNAPSHOT (area notes, including any project-specific forks/weak spots the interview surfaced):
${coverageList || '(none)'}

Your job is to report the generate_scaffold tool with the following STRICT rules:

1. Ground every line in the actual interview above. Do NOT pad with generic best-practice filler that was never discussed ("write tests," "use clean code," etc.) unless the interview specifically established it as a convention or invariant. If nothing was established for a field, it is fine to leave the array empty or write a short honest sentence rather than invent content.
2. Preserve the hard/soft tier EXACTLY as tagged in the decisions log above. A decision tagged HARD must appear in hardInvariants, never in softDecisions, and vice versa. Do not upgrade or downgrade a decision's tier.
3. For each softDecisions entry, the "reason" field must explain WHY it's provisional, grounded in what the user actually said (e.g. hedging language, an explicit "not sure yet").
4. For knownForks, draw from decisions and coverage notes about rework-risk / weak-spot areas — do not invent forks that were never raised.
5. The slice plan must be an ordered, concrete build sequence reflecting the ACTUAL project scope discussed in the transcript — not a generic "step 1: setup, step 2: build" template.
6. Never include markdown syntax (no #, *, -, backticks) in any field — plain text only. The app renders formatting.
7. You MUST report through the generate_scaffold tool. Do not respond with plain text.`
}

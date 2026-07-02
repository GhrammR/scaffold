import type { GeneratedScaffold } from './types'

export function buildRevisionSystemPrompt(current: GeneratedScaffold): string {
  return `You are revising an ALREADY GENERATED governance scaffold for a coding agent, based on the user's revision request in the conversation below. This is NOT a fresh generation — you are editing an existing document.

CURRENT SCAFFOLD (the source of truth — every field not touched by the request must be copied verbatim from here):
${JSON.stringify(current, null, 2)}

STRICT RULES:
1. Report your response through the generate_scaffold tool, with the FULL scaffold (both claudeMd and slicePlan) — even fields you didn't change must be included, copied byte-for-byte from CURRENT SCAFFOLD above.
2. Only change what the revision request specifically asks for. Do not reword, restructure, reorganize, or "improve" anything else — no matter how tempting. If the request is about hard invariants, do not touch soft decisions, conventions, known forks, the project summary, the stack description, or the slice plan.
3. Do not move any item between hardInvariants and softDecisions, or add/remove items in either list, UNLESS the revision request explicitly asks you to change that specific decision's tier or existence. If a request is ambiguous about which items it applies to, prefer changing fewer items over more.
4. When a request REPLACES a single item in a list (e.g. "swap this rule for that one"), keep the replacement at the SAME POSITION in the list — do not remove it and append the new one at the end. Every other item's order must stay exactly as it was.
5. Never include markdown syntax (no #, *, -, backticks) in any field — plain text only. The app renders formatting.
6. You MUST report through the generate_scaffold tool. Do not respond with plain text.`
}

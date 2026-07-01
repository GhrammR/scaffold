# Rule: Context Asceticism — No Exploration, No Drift

The operator's API budget is finite. Every token spent wandering the codebase to
"see what's here" is waste, and open-ended exploration is the primary cause of an
agent drifting off-task. This rule is the single most important constraint in the
repo. (Ported from The Janitor, where it was the hardest-won lesson.)

## The laws

### Law I — No speculative exploration

You are forbidden from spawning orientation sub-agents, running open-ended
`grep`/`find`/glob across the workspace, or scanning broadly to "get oriented."
Read only:

- files named in the operator's directive,
- files cited in a compiler/test error or stack trace,
- files whose paths you already know from prior context.

**Forbidden:** `glob("**/*")`, speculative `grep` across the tree, any
"let me see what exists" tool call.

### Law II — Fail-fast on ambiguity

If a directive lacks specific file paths and you do not know exactly where the
target code lives, **do not guess and do not search.** Stop and ask the operator
for the exact paths. The cost of a wrong guess (read 3 wrong files, then the
right one) is 4× a single targeted read. The cost of asking is zero.

### Law III — Stay on the current slice

Work only on the slice named in the current directive (see
`slice-discipline.md`). Do not "while I'm here" edit adjacent code, refactor
unrelated files, or start the next slice. Scope creep mid-slice is drift.

## Enforcement checklist

- [ ] No glob/grep without an exact target path
- [ ] No orientation sub-agents
- [ ] Ambiguous directive → asked for paths, did not guess
- [ ] No edits outside the files the current slice requires

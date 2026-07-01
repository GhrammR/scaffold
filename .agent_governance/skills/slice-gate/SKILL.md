# Skill: Slice Gate (Auto-Invoked)

**Trigger:** whenever the operator asks to commit, stage, or finalize changes.

This gate fires on every commit request without exception. The operator may not
bypass it by saying "just commit." (Ported and simplified from The Janitor's
pre-commit gate.)

## Protocol

Run these checks in order. If any fails, ABORT the commit, report why, and wait
for the operator.

1. **Build passes.** Run `npm run build` (the production build — NOT just
   `npm run dev`, which is more lenient and misses type errors that break the
   deploy). If it fails, abort and report the error.

2. **Tests pass.** Run the test suite. If any test fails, abort and report which.

3. **Slice discipline held.** Confirm the diff is limited to the current slice's
   required files (see `rules/slice-discipline.md`). If the diff touches
   unrelated files, stop and ask the operator before committing.

4. **Operator verified.** Confirm the operator has verified this slice on the
   running app. If not, do not commit — a slice is not done on self-report alone.

5. **Governance hygiene.** If this commit adds or edits a rule file, confirm it
   is under ~40 lines and follows the skeleton (see `rules/governance-hygiene.md`).

Only when all five pass: finalize the commit.

## Abort conditions

| Condition | Action |
|-----------|--------|
| `npm run build` fails | Abort, report the build error, do not commit |
| A test fails | Abort, report the failing test |
| Diff touches files outside the current slice | Stop, ask the operator |
| Slice not yet verified by operator | Do not commit; request verification |
| A rule file exceeds ~40 lines | Sharpen/split it before committing |

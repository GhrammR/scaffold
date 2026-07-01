# Rule: Slice Discipline — One Vertical Slice, Then Stop

Work proceeds one vertical slice at a time. A slice is a single, complete,
deploy-verifiable increment. This is the method that shipped Double Down; it is
mandatory here.

## The law

1. **Build exactly one slice per directive.** The slice plan is in the root
   `CLAUDE.md`. Build the current slice only — do not start the next one.
2. **Deploy-and-verify.** A slice is not done until it builds and the operator
   has verified it on the running app. Post what changed and STOP for operator
   review before committing or moving on.
3. **Plan before non-trivial slices.** For any slice involving new design (not a
   routine port), produce a short plan and stop for approval BEFORE writing code.
4. **Never claim a slice works without verification.** Do not report a slice as
   complete based on your own inspection. The operator verifies on the actual
   running app; your self-report is not the source of truth.

## Scope boundaries per slice

- Touch only the files the current slice requires.
- Do not refactor, rename, or "improve" adjacent code mid-slice.
- If you discover a needed change outside the slice, note it for the operator —
  do not silently make it.

## Enforcement checklist

- [ ] Only the current slice was built
- [ ] Non-trivial slice: a plan was approved before coding
- [ ] Slice builds clean (`npm run build`, not just `npm run dev`)
- [ ] Operator verified on the running app before commit
- [ ] No changes outside the current slice's required files

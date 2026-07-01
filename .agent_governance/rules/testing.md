# Rule: Testing Mandate

Every functional change to core logic ships with a test in the same commit.
(Adapted from The Janitor's testing mandate, scaled to a TypeScript/React app.)

## The law

- Any change to non-trivial logic — the `LLMProvider` abstraction, scaffold
  generation, output parsing/validation, the interview state machine — MUST ship
  with at least one test in the same commit.
- Tests must be deterministic: no live network calls, no real API calls, no
  timing dependence. Mock the `LLMProvider` at its interface.
- A bug fix ships with a test that would have caught the bug.

## What does NOT require a test

Pure presentational components, styling, and static content. Use judgment — the
rule targets logic that can silently break, not markup.

## Enforcement checklist

- [ ] Logic change includes a test in the same commit
- [ ] Tests mock the LLM provider — no real API calls in the test suite
- [ ] Tests are deterministic (no network, no sleep, no wall-clock reliance)
- [ ] Bug fixes include a regression test

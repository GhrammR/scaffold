# Rule: Governance Hygiene — Keep Rules Short

A rule that grows into an essay is a rule the agent never internalized. On The
Janitor, the rules that held were short and mechanically checkable (the best was
~650 bytes); the ones that failed ballooned to 12–25KB as clauses were piled on
trying to force compliance. Size was the fingerprint of failure. Do not repeat it.

## The law

1. **Every rule file stays under ~40 lines / ~2KB.** If a rule needs more, it is
   too vague — sharpen the constraint or split it, do not pad it.
2. **Every rule follows the skeleton:** a hard constraint → a scope → an
   enforcement checklist. (Add acceptable/unacceptable examples only if genuinely
   ambiguous.)
3. **Name the enforcement mechanism.** A rule that ties to a check (a test, a
   lint, a build step, a concrete threshold) holds; a vague aspiration ("write
   clean code") gets ignored. State how the rule is enforced.
4. **The root `CLAUDE.md` is an index, not an encyclopedia.** Keep it small and
   stable; depth goes in these modular rule files.

## When a rule keeps getting violated

Do NOT add more clauses. A repeatedly-violated rule means the constraint is
unclear or unenforceable — rewrite it shorter and sharper, or attach it to a
mechanical check. Length is not enforcement.

## Enforcement checklist

- [ ] This rule file is under ~40 lines
- [ ] It has: constraint → scope → checklist
- [ ] Its enforcement mechanism is named
- [ ] Root CLAUDE.md was not turned into a catch-all

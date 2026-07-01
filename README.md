# Scaffold — Governance Starter Kit

This is the hand-built governance for **building Scaffold itself**. Drop these
files into the root of a new empty repo, then point Claude Code at it and give it
the Slice 1 directive.

It is deliberately a small version of exactly what Scaffold will one day generate
— which makes building Scaffold a live test of its own premise: if a minimal
`.agent_governance/` keeps the agent on-track through this build, the concept works.

## What's here

```
CLAUDE.md                      # entry point Claude Code reads on startup (imports AGENTS.md)
AGENTS.md                      # agent-agnostic entry point (Codex reads this)
setup-governance.sh            # creates the .claude/ symlinks (run once)
.agent_governance/
  README.md                    # bootstrap instructions for any agent
  rules/
    context-asceticism.md      # #1 rule: no exploration, no drift (from The Janitor)
    slice-discipline.md        # one vertical slice, deploy-verify, stop for review
    testing.md                 # logic changes ship with tests
    governance-hygiene.md      # keep rules short — the meta-lesson
  skills/
    slice-gate/SKILL.md        # auto-fires on commit: build + tests + slice check
```

## How to use it

1. Create a new empty repo and copy all of these files into its root.
2. Run `bash setup-governance.sh` to create the `.claude/` symlinks.
3. Open Claude Code in the repo. It reads `CLAUDE.md` → `AGENTS.md` →
   `.agent_governance/rules/` on startup.
4. Give it the Slice 1 directive (the interview — see the slice plan in
   `CLAUDE.md`). It plans first, you approve, it builds one slice, you verify.

## The four rules, in one line each

- **context-asceticism** — don't explore/guess; read only what's named; ask when unsure.
- **slice-discipline** — one slice at a time; verify on the running app before commit.
- **testing** — logic changes ship with deterministic tests (mock the LLM).
- **governance-hygiene** — rules stay short; a rule that grows is a rule being ignored.

Edit these as the project teaches you what it actually needs — that's the point.
The rules that survive are the ones that earned their place.

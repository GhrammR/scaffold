# Scaffold — Shared Governance Layer

This directory is the canonical source for all governance rules and skills for
this repository. It is **agent-agnostic**: Claude Code, Codex, and any other AI
agent operating in this repo MUST read this directory on startup to understand
operating constraints.

Pattern adapted from a proven system (The Janitor's Universal Agent Protocol),
keeping only what a project of this size needs.

## Directory structure

| Path | Purpose |
|------|---------|
| `rules/` | Hard laws — the constraints that keep the build on-track and out of drift |
| `skills/` | Auto-invoked protocols that fire on specific events (e.g. the slice gate on commit) |

## Agent bootstrap

1. Read every `.md` in `rules/` — mandatory constraints.
2. Read every `SKILL.md` in `skills/` — protocols that auto-fire on their trigger.

## Compatibility

For Claude Code, `.claude/rules` and `.claude/skills` are symlinks that resolve
to this directory (create them with the commands below). Edits are made HERE in
`.agent_governance/` — never in the symlink stubs.

```bash
mkdir -p .claude
ln -s ../.agent_governance/rules  .claude/rules
ln -s ../.agent_governance/skills .claude/skills
```

Claude Code also reads the root `CLAUDE.md`, which imports `AGENTS.md`; both
point back to the rules in this folder. Codex reads `AGENTS.md` directly.

## Why this exists

A coding agent pointed at a build with no governance explores, guesses, sprawls,
and burns API budget — this repo's own reason for existing is that "just start
building" does not hold at scale. These rules are the minimal set that keeps the
agent targeted. Keep them short; a rule that grows into an essay is a rule the
agent isn't internalizing — sharpen it instead of padding it.

# AGENTS.md — Scaffold

This is the shared, agent-agnostic entry point (read by Codex and any non-Claude
agent). The CLAUDE.md at the repo root imports this file via `@AGENTS.md`, so
Claude Code and Codex operate under the same governance — one source of truth.

The canonical rules live in `.agent_governance/rules/`. Read all of them on
startup; they are mandatory constraints, not suggestions.

## What Scaffold is

An LLM-backed tool that interviews a user about a project they want to build,
then generates a governance scaffold (CLAUDE.md / AGENTS.md + rules) for a
coding agent. The interview is the heart of the product.

## Stack

Vite + React + TypeScript, client-side only, Tailwind, LLM behind a single
`LLMProvider` interface, user-supplied API key stored client-side only, static
deploy on Vercel.

## Non-negotiable invariants

1. LLM calls go through the `LLMProvider` abstraction — never a vendor SDK directly.
2. The user's API key is client-side only; never sent to our server, never hard-coded.
3. Every output is a real, downloadable artifact — never abstract advice.
4. Scope stays narrow: the first version outputs only CLAUDE.md + a slice plan.
5. One vertical slice at a time; stop for operator review between slices.

## Governance layout

- `.agent_governance/rules/` — hard laws (read all on startup)
- `.agent_governance/skills/` — auto-invoked protocols (e.g. the slice gate)

Explicit operator instructions in chat override these files. When a directive
is ambiguous or lacks specific file paths, STOP and ask — do not guess.

# CLAUDE.md — Scaffold

@AGENTS.md

This is the entry point for Claude Code. The canonical governance lives in
`.agent_governance/` and is read by any agent (Claude Code, Codex) working in
this repo. Keep THIS file small and stable — it is the index, not the encyclopedia.
Depth belongs in `.agent_governance/rules/`.

---

## What Scaffold is

An LLM-backed planning tool. The user describes a project; an LLM interviews
them — asking the questions that prevent planning rework — and generates a
governance scaffold (CLAUDE.md / AGENTS.md + rules/skills/commands) the user
can hand to a coding agent. The heart of the app is **the interview**: asking
genuinely useful questions is the hard, valuable part.

## Stack

- Vite + React + TypeScript (fully client-side SPA, no backend)
- Tailwind CSS
- LLM call behind a single `LLMProvider` interface (Anthropic OR OpenAI)
- User brings their own API key, stored client-side only
- Deploys as a static site (Vercel)

## Invariants (do not violate without operator approval)

1. **The LLM provider is abstracted.** All model calls go through the
   `LLMProvider` interface — never call a vendor SDK directly from app code.
2. **The user's API key is client-side only.** Never send it to a server we
   control. Never hard-code a key. Never make the operator's key a default.
3. **Every output is a concrete artifact.** Scaffold produces real, downloadable
   files — never abstract advice. If a change makes the output more abstract, stop.
4. **Narrow scope holds.** First working version outputs only CLAUDE.md +
   a slice plan. Do not add presets, file upload, extra governance files, or
   login until the core interview → generate → review → download → revise loop
   works. The preset library is hard-capped at 10 (later).
5. **One vertical slice at a time.** Build and verify a single slice, then stop
   for operator review before the next. See `rules/slice-discipline.md`.

## The slice plan (current target)

1. The interview (conversation design — the heart). No file output yet.
2. Narrow scaffold: generate CLAUDE.md + slice-plan.md, rendered on screen.
3. Download the scaffold as a real folder (zip).
4. Conversational revision (refine any generated file in dialogue).
5. CLAUDE.md + AGENTS.md coexistence (@AGENTS.md import pattern).
6. Skills / rules / workflows generation.
7. Preset gallery + two-path landing.
8. Visual identity (violet on charcoal) + second provider + polish.

Slices are built in order. Each ships deploy-verified. Do not skip ahead.

## Bootstrap

On startup, read all files in `.agent_governance/rules/` — they are mandatory
constraints. Read `.agent_governance/skills/` — those protocols auto-fire on
specific events (e.g. the slice gate fires on any commit request).

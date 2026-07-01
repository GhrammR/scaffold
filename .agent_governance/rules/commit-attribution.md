# Rule: No AI Co-Authorship Trailer

Commits in this repo must not include a `Co-Authored-By: Claude ...` (or any
other AI-agent) trailer.

## The law

- Never add `Co-Authored-By: Claude <...>` or equivalent AI-attribution
  trailers to commit messages.
- This applies regardless of which agent (Claude Code, Codex, etc.) authored
  the change.

## Scope

Applies to every commit created in this repository by any agent.

## Enforcement checklist

- [ ] Commit message has no `Co-Authored-By: Claude` (or other AI) trailer
- [ ] Checked before every `git commit` in this repo

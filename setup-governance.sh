#!/usr/bin/env bash
set -euo pipefail

# Scaffold governance setup — creates the .claude symlinks so Claude Code reads
# the canonical .agent_governance/ folder. Run once from the repo root.

if [ ! -d ".agent_governance" ]; then
  echo "Error: run this from the repo root (where .agent_governance/ lives)." >&2
  exit 1
fi

mkdir -p .claude

# -f so re-running is idempotent (won't error if the links already exist)
ln -sfn ../.agent_governance/rules  .claude/rules
ln -sfn ../.agent_governance/skills .claude/skills

echo "Done. .claude/rules and .claude/skills now point to .agent_governance/."
echo "Claude Code reads CLAUDE.md (which imports AGENTS.md); both point here."

#!/bin/bash
# oracle-gate.sh -- PreToolUse hook for Antigravity CLI.
#
# Purpose: make the ship gate non-fakeable. An agent can claim it ran the
# oracle; it cannot claim a hook's verdict. Any git commit or git push in
# this repo is blocked unless verify.mjs is green AND the sw.js cache
# version was bumped alongside app-code changes (same rule CI enforces).
#
# Contract: always exit 0. Emit JSON on stdout. Non-zero exit is a hook
# failure, not a denial -- it would halt the agent instead of gating it.

set -uo pipefail

# v28: resolved from this script's own location. It used to be a hardcoded absolute
# path; the repo moved under Golf-Bay-Oaks/ and `cd "$REPO" || allow` then PERMITTED
# every commit, silently, for an unknown period. A gate that cannot deny is worse
# than no gate, because the process still reports itself as protected.
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." 2>/dev/null && pwd)"

allow()  { printf '{"allow_tool": true}\n'; exit 0; }
deny()   { printf '{"allow_tool": false, "deny_reason": %s}\n' "$(printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g; s/^/"/; s/$/"/')"; exit 0; }

# The payload schema is not contractually stable; grep the raw text instead
# of parsing a shape that may change under us.
PAYLOAD="$(cat 2>/dev/null || true)"

echo "$PAYLOAD" | grep -qE 'git[[:space:]]+(commit|push)' || allow

# Fail CLOSED. If the repo cannot be resolved the oracle cannot be run, and an
# unverifiable commit is exactly what this hook exists to stop.
if [ -z "$REPO" ] || [ ! -f "$REPO/verify.mjs" ]; then
  deny "Ship gate could not locate the repo from $(dirname "${BASH_SOURCE[0]}") -- verify.mjs not found. Commit blocked. Check .agents/hooks.json paths."
fi
cd "$REPO" || deny "Ship gate could not enter $REPO. Commit blocked."

# One implementation for every path: .agents/gate.mjs exports the STAGED tree and
# runs the oracle plus the sw.js cache-bump rule against that export. This hook used
# to run `node verify.mjs` in the working tree and compute the cache bump from staged
# UNION unstaged changes -- it certified the files on disk, not the files going into
# the commit, so a partial stage passed here and committed red.
GATE_OUT="$(node "$REPO/.agents/gate.mjs" --staged 2>&1)"
if [ $? -ne 0 ]; then
  deny "Ship gate: $(printf '%s' "$GATE_OUT" | tr '\n' ' ')"
fi

allow

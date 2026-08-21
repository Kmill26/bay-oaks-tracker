#!/bin/bash
# oracle-echo.sh -- PostToolUse hook. Runs the oracle after any file write and
# records the verdict where the agent can read it. This is the fast feedback
# loop; oracle-gate.sh is the hard gate. Together: the agent learns it broke
# something within one turn instead of at commit time.
set -uo pipefail
REPO="/Users/kennymiller/Documents/bay-oaks-tracker-v10"
STATUS="$REPO/.agents/oracle-status.txt"

cd "$REPO" 2>/dev/null || { printf '{"allow_tool": true}\n'; exit 0; }

OUT="$(node verify.mjs 2>&1)"
if printf '%s' "$OUT" | grep -q 'RESULT: ALL PASS'; then
  printf 'GREEN -- all checks pass.\n' > "$STATUS"
else
  { printf 'RED -- oracle is failing. Fix before continuing.\n\n'
    printf '%s' "$OUT" | grep '^FAIL ' ; } > "$STATUS"
fi

printf '{"allow_tool": true}\n'
exit 0

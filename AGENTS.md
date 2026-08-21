# AGENTS.md — Bay Oaks Tracker

Personal round tracker and caddy for Bay Oaks CC. Built for Kenny, used on a
phone, on a course. Not a product. There are no other users.

Global operating rules live at `~/.gemini/GEMINI.md` and are canonical for
behaviour. This file is canonical for **this repo**. If they disagree on repo
mechanics, this file wins; on behaviour, the global file wins.

## Confirm before starting

Read `~/.gemini/GEMINI.md`, then reply with one line — `rules loaded, version: N`
— before doing any work. N is the `rules_version` in that file's header.

## The oracle is the ship gate

`npm test` runs `verify.mjs`. It must print `RESULT: ALL PASS`. Nothing ships red.

**Two hooks enforce this. They are not advisory:**

- `.agents/oracle-gate.sh` (PreToolUse) blocks any `git commit` or `git push`
  when the oracle is red, or when app code changed without a `sw.js` cache bump.
- `.agents/oracle-echo.sh` (PostToolUse) re-runs the oracle after every file
  write and records the verdict in `.agents/oracle-status.txt`.

**After any edit, read `.agents/oracle-status.txt` before continuing.** If it
says RED, stop and fix. Do not stack another change on a red oracle.

### Never weaken the check to make it pass

Deleting an assertion, loosening a threshold, or special-casing a test input so
it goes green is the worst possible outcome here — worse than shipping nothing.
The oracle is the only thing standing between a bad build and a wasted round.
If a check seems wrong, say so and stop. Do not edit it.

## Service worker cache discipline

If `index.html`, `js/*`, or `styles.css` change, the `bayoaks-vN` string in
`sw.js` **must** be bumped in the same commit. Otherwise phones serve stale code
from cache and the fix never lands. CI enforces it; the pre-commit hook enforces
it earlier. Bump it as part of the change, not as a follow-up.

## Architecture — do not drift from this

- **Zero dependencies.** Vanilla JS, no framework, no build step, no bundler.
  `package.json` has no `dependencies` block and it stays that way. A new
  dependency requires explicit sign-off from Kenny — do not add one and explain
  afterwards.
- **Classic scripts, explicit load order.** `js/seed.js`, `js/stats.js`,
  `js/course.js`, `js/player.js`, `js/app.js` load as four `<script src>` tags
  and share one global scope. `verify.mjs` concatenates them in that exact order
  to test the same scope the browser runs. **If you add a file or reorder them,
  update `SRC_FILES` in `verify.mjs` in the same commit** or the oracle silently
  tests the wrong thing.
- **`rounds[]` is the canonical round store.** Trends and stats are *computed*
  from it, never hardcoded. If you find yourself typing a stat literal, stop.
- **Node >= 20.** Runtime is Node 26 on this machine.
- `tools-*.mjs` are Kenny's scratch scripts and are gitignored. Do not rely on
  them and do not commit new ones under that name expecting them to persist.

## The ROI gate

**A feature that displays information without changing a decision does not get
built.** This is standing, and it has already killed real features here — the
to-green yardages line was cut the day it shipped because different yardages to
the green didn't change what club came out of the bag. Wind, lie, and
temperature modifiers were declined for the same reason.

If asked to build something that fails this gate, say so and explain why rather
than building it and waiting for it to be cut.

## Ship discipline

- **External proof, never local state.** A push is not done because the command
  exited 0. Confirm with `git ls-remote`, read the CI conclusion from the
  GitHub API, or fetch the live deploy. Report what you observed, not what you
  expect happened.
- Diffs over re-pasted files.
- Commit messages follow the existing `vN: what changed and why` form. Read
  `git log --oneline -5` for the voice before writing one.
- Never `git push --force` on `main`.

## Scope boundaries

- **Do not write anywhere outside this repo.** Specifically: never write to
  `~/Documents/vault/` — that is Claude-canonical and a write from here corrupts
  the single-canonical-writer rule the whole system depends on.
- Surface architectural disagreement rather than routing around it. If the brief
  seems wrong, say it plainly and stop; do not silently pick a different design.
- Do not expand scope beyond what was asked. Necessary scaffolding is fine but
  must be named explicitly in your recap with a justification.

## Privacy — applies to code, comments, and commit messages

- **Kids' names are never written down**, anywhere, in any form. Use "the kids"
  or a relation.
- No API keys, tokens, or secrets in files, commits, or output.
- This repo is public-adjacent (it has a GitHub remote). Nothing about health,
  finances, or Kenny's employer goes in it.

## Known drift — flag, do not silently fix

`package.json` says `"version": "16.1.0"` while commit history is at v18/v19.
The commit-message `vN` is the real version. Do not reconcile these without
asking — the version string may be load-bearing for the service worker or the
export format.

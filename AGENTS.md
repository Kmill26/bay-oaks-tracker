# AGENTS.md — Bay Oaks Tracker

Personal round tracker and caddy for Bay Oaks CC. Built for Kenny, used on a
phone, on a course. Not a product. There are no other users.

Global operating rules for behaviour live at `~/.gemini/GEMINI.md`. **That file
is a condensed copy, not the source** — the canonical rules are
`~/Documents/vault/meta/agent-operating-rules.md`, and the copy exists only
because Antigravity caps a rules file at 12,000 characters. This file is
canonical for **this repo**. If they disagree on repo mechanics, this file wins;
on behaviour, the global file wins.

## Confirm before starting

Read `~/.gemini/GEMINI.md`, then reply with one line — `rules loaded, version: N`
— before doing any work. N is the `rules_version` in that file's header.

**Check that N is current before you trust it.** `head -5
~/Documents/vault/meta/agent-operating-rules.md` gives the canonical version. If
the copy is behind, say so in that same line rather than proceeding quietly —
announcing a stale N reads as a freshness confirmation and is the opposite of
one. The copy sat at 64 against a canonical 75 for seventeen days in Aug-Sep
2026, and every agent that announced "version: 64" in this repo was confirming
rules that had already moved. The vault now checks this on its weekly `--full`
run, but the check is machine-local and weekly; your read is immediate.

## The oracle is the ship gate

`npm test` runs `verify.mjs` (the oracle) and `.agents/gate.test.mjs` (the gate's
own acceptance tests). Both must pass. Nothing ships red.

**The gate has one implementation and every path runs it.** `.agents/gate.mjs`
exports the **staged** tree to a temp directory and runs the oracle there, plus the
`sw.js` cache-bump rule computed from the same tree — so what the gate certifies is
what the commit will contain, not what happens to be on disk.

- `hooks/pre-commit` — a hand-typed `git commit`. **Arm it once per clone with
  `node install-hooks.mjs`** (it sets `core.hooksPath`); a tracked hook does nothing
  until you do. Until 2026-09-06 this path had no gate at all.
- `hooks/pre-push` — validates the committed tip against `origin/main`, catching a
  `--no-verify` commit and a missing cache bump in an earlier commit of a
  multi-commit push, which CI's `HEAD~1..HEAD` window misses.
- `.agents/oracle-gate.sh` (PreToolUse) — the Antigravity path. It resolves the repo
  from its own location, fails closed, and delegates to `gate.mjs --staged`.
- `.agents/oracle-echo.sh` (PostToolUse) re-runs the oracle after every file
  write and records the verdict in `.agents/oracle-status.txt`.

Run it yourself any time: `node .agents/gate.mjs --staged`.

**A partial stage is the case this exists for.** Fix something in the editor, stage
only half of it, and the old gate went green while the commit went red. The gate's
acceptance tests prove the four properties that matter: a staged defect fails even
when the working tree is repaired, an unstaged defect does not invalidate clean
staged content, temp snapshots are removed on both paths, and the hook actually
blocks a real `git commit` rather than only reporting.

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
from cache and the fix never lands. The gate enforces it from the staged tree —
**a bump you edited but did not stage does not count**, because it is not in the
commit — and CI enforces it again after the push. Bump it as part of the change,
not as a follow-up.

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

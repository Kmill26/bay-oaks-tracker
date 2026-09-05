# Bay Oaks tracker: v28 independent follow-up review

Reviewed 2026-09-05. Local commit: `dd7cb97c8e540dee283e68426395851bd854a73b`.
Scope: original tracker, verification of v28 fixes, session and data-integrity edge cases.
This is review evidence, not authorization to implement or deploy changes.

## Verdict

The v28 changes repair the exact resume and clipboard-fallback defects, and bring
summary/export totals onto roundStats. They are worthwhile fixes. They do not yet
establish end-to-end data integrity. Six further failures were reproduced, including
loss of a newly entered score by merely navigating an older open tab.

At the time checked, GitHub main remained at `36ea70a`, and the live Pages service
worker returned `const C='bayoaks-v30';`. Local v28 uses `bayoaks-v31`. The local
fixes were not yet on the published site. This is deployment status, not a defect
in Claude's claim: the commit/addendum explicitly says committed, not pushed.

Production code and actual playing records were not modified. Tests used fresh
localhost browser data and isolated in-memory synthetic rounds. The only added
files are this review and its standalone reproduction script.

## What passed

- Existing `npm test`: `RESULT: ALL PASS` (185 PASS lines reported by the suite).
- Back-nine position survives a fresh VM with shared storage. Independently, a
  real browser selected Back 9, moved to Hole 11, reloaded and stayed on Hole 11.
- The old `execCommand('copy') === false` path no longer marks the round exported.
- Summary and roundStats now both exclude a chip alongside GIR=Yes.
- Recorded putts on an unscored hole count in both summary and roundStats.
- Hook paths now resolve to the actual scripts; the pre-hook resolves its repo
  from its own location and denies an unresolvable repo.
- CI now checks JS/CSS changes and compares cache identifiers for its selected
  range. Remaining gate limitations are described below.

## F1 — P1: an older open tab can erase newer scores on navigation

Evidence: `js/app.js:56`, `js/app.js:143`, `js/app.js:350`.

Browser reproduction, not just a stub:

1. Tab A: enter Hole 1 score 4.
2. Open Tab B; it loads that same round.
3. Tab A: enter Hole 2 score 5. The page shows 2/18 holes and 5 (+1).
4. Tab B: press Next, without editing any score.
5. Reload Tab A: Hole 2 is blank, and the round has fallen back to 1/18 holes.

`setCur` saves the entire in-memory state. Tab B's old copy therefore replaces
Tab A's newer score and potentially its newer archive. There is no revision
comparison or storage-change handling. Multiple-tab overwrite was already possible
on edits; v28 expands the trigger to navigation alone.

Fix direction: enforce one active writer or detect and reject stale revisions
before any whole-state save. Store navigation independently so moving through holes
does not rewrite scores/history. A storage listener alone is not a sufficient
conflict policy if two writers can still race.

Acceptance: two sessions share storage; both new scores and archive additions
survive navigation and attempted edits in the stale session. A conflicting edit
must be surfaced rather than silently overwriting the newer record.

## F2 — P1: Start New Round silently discards data when no score was entered

Evidence: `js/app.js:154-170`.

Reproduction: enter notes and three putts, leave score blank, then Start New Round.
Observed: zero confirmations, zero archived rounds, notes cleared. `played` only
checks scores, even though v28 explicitly treats stats without scores as real data.

Fix direction: distinguish an empty round from a data-bearing incomplete round.
Require an explicit retain/discard choice for any entered notes or diagnostic
data; offer recovery rather than clearing it implicitly. Do not count tee/pin
setup alone as a played hole.

Acceptance: notes-only, putts-only, penalty-only and fairway-only rounds are
protected; truly empty rounds can restart without unnecessary ceremony.

## F3 — P2: switching modes still makes export and archive disagree

Evidence: `js/app.js:92-100`, `js/app.js:162-165`, `js/app.js:452-453`.

Reproduction: record H1=4 and H10=5, switch to Front 9, then summarize and archive.
Observed: export total 4, archive total 9, archived mode `front` with two played
holes including Hole 10. Summary masks holes outside the mode; newRound archives
all 18 slots and roundStats does not use mode to select holes.

This survives the shared-calculation fix because callers give that calculation
different input data. A stray tap on a mode pill after entering data is sufficient.

Fix direction: define mode changes as an explicit round-boundary decision. Prevent
silently excluding entered holes, or show a clear choice that preserves them. Use
the identical included-hole selection for export and archive. Do not solve this
by silently deleting the other nine.

Acceptance: switch Full/Front/Back after entering holes in both nines; exported
and archived scores, stats, modes and included hole numbers must agree.

## F4 — P2: hotspot statistics retain the CHIP6 defect

Evidence: `js/stats.js:12-16` versus `js/stats.js:137-140`.

Reproduction: a scored hole has a previously recorded chip='in', then GIR is
corrected to Yes. roundStats reports CHIP6 0/0, while holeStats reports 1/1.
With two such rounds, the ranked hotspot card can visibly display the stale chips.

The headline/summary fix is correct, but there are still independent per-hole,
segment and lag calculations. These also continue to skip data-bearing unscored
holes, unlike the new per-round policy. Some differing sample populations can be
intentional, but must be explicit rather than accidentally contradictory.

Fix direction: share the validity rules for a hole's diagnostic observations,
including the GIR gate for CHIP6, across every consumer. Each analytic can still
select an appropriate population, with coverage labels where needed.

Acceptance: corrected GIR and missing-score cases agree across the round totals,
hotspots, segment data and lag coverage according to a documented policy.

## F5 — P2: delayed export completion can bless a newer, unexported revision

Evidence: `js/app.js:664`, `js/app.js:678`, `js/app.js:693`,
`js/app.js:729-732`.

Controlled asynchronous reproduction: copy the log with H1=4; before the clipboard
promise settles, change H1 to 5 (touch clears exported); resolve the earlier copy.
Observed: current H1=5, but `state.exported=true` even though copied text contained 4.

The fallback false-return fix is valid. This is a distinct asynchronous-success
bug: completion writes to current mutable state without checking round identity
or revision. New-round transitions while a completion is pending have the same
ownership problem. Native sharing was inspected in source, not exercised on a phone.

Fix direction: capture round identity and data revision at export start; mark
only that exact revision exported if it is still current. Use the same mechanism
for Copy Log, Copy Prompt and both share branches.

Acceptance: successful/rejected delayed copies and shares, intervening edits,
mode changes and new rounds must leave the correct revision's export status.

## F6 — P2: delayed dictation writes to the hole currently displayed

Evidence: `js/app.js:289-294`.

Controlled speech-result reproduction: start dictation on H1, move to H2, deliver
the transcript. Observed: H1 notes empty; H2 contains the H1 note. Callback reads
`holes[cur]` at completion instead of capturing the original destination.

Fix direction: bind dictation to round identity and hole at start. On navigation,
either stop recognition with a clear completion policy, or deliver its result to
the captured hole. Reject stale results after a round transition.

Acceptance: delayed results across navigation, starting another round, errors and
stop/restart cycles never land in a different hole or round. Physical microphone
and browser speech-service behavior still need a device check.

## Gate follow-up — P2: protection remains narrower than its description

Source review; the scenarios below were not executed as real commits or pushes.

- `.agents/oracle-gate.sh:44-57` checks the union of staged and unstaged filenames.
  It still accepts any modification to sw.js, including a comment-only change,
  and can consider an unstaged cache bump sufficient for staged application code.
  It tests the working tree, not necessarily what a commit would contain.
- `.github/workflows/verify.yml:35-39` compares only HEAD~1 to HEAD. A push
  containing an app change without a bump followed by a docs-only commit skips
  the guard. Use the event's previous deployed/pushed SHA or PR base as appropriate.
- The pre-hook is now fail-closed on repo lookup. The post-hook still emits
  allow on a failed cd; it is an informational status writer, not the hard gate.
  The addendum's claim that BOTH hooks deny is stronger than the code.
- A resolved hooks.json path proves the configured script exists. It does not
  prove every agent/client invokes that hook contract. Current review did not
  establish enforcement in every client.

Acceptance: verify the actual staged tree, a comment-only SW edit, an unstaged
bump, and multi-commit push ranges in an isolated fixture. Do not weaken tests to
make the gate look green.

## Previously reported issues still open

- Silent storage-write failures and no full-history backup/restore.
- H17 Blue/White advice contradicting its book note; White uses Blue approach advice.
- Mixed White/Blue labels/export provenance; per-hole tee selections are not
  emitted in the hole lines, so even a combo header cannot reconstruct assignment.
  Raw archived holes retain tee overrides, but the history label uses state.tee.
- Fixed coaching ranking and overconfident fatigue interpretation.
- No round removal, no explicit finish-round action, and archived correction lives
  in Signal rather than the tracker. Signal's implementation was not re-reviewed.

One analytical caution: unanswered short-sided fields still enter its denominator
as missed greens. With no answers the app can show 0/N, which a reader can mistake
for N confirmed safe misses. The existing comment describes avoiding a flattering
rate, but short-sided is a negative outcome. Preserve unknown coverage explicitly;
do not silently change historical semantics or the test without reviewing the policy.

## Suggested next repair slice

1. Data protection: stale-session writes, storage failure reporting, and safe
   handling of stat-only rounds. Preserve a recoverable copy before destructive resets.
2. Round identity: one included-hole policy; export and dictation bound to the
   originating round/revision/hole.
3. Analytics: corrected observations have the same meaning in every display.
4. Gate verification against actual commit/deployment ranges, followed by explicit
   deployment verification. The fixes do not protect the phone until deployed.
5. Resolve remaining caddy/provenance issues, then reduce between-hole scrolling.

Do the regression checks with each repair, not after the entire list. No dependency
is needed for the attached controlled reproductions. Keep real browser sessions
for reload and multiple-tab verification; use device checks for offline install,
service-worker updates, native sharing and dictation.

## Reproduction artifact and limits

Run `node docs/reviews/v28-session-probes.mjs` from the repo, or supply its absolute
path from anywhere. It prints two positive checks and six isolated reproduction
results. `REPRODUCED` means a defect remains, not that product behavior passed.
This is review evidence, not a new shipping oracle and not a replacement for tests.

Verified here: source diff, current npm suite, fresh browser reload, two real tabs
sharing localhost storage, deterministic VM storage/callback cases, GitHub main
and live service-worker version. Not verified: physical phone background suspension,
offline install/update cycle, native share completion or actual microphone capture.

Review basis: original tracker only. No production records, Signal files, vault
files, existing tests, application source, dependencies, hooks or commits changed.

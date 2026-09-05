# v29 independent review: archive recovery and concurrent writes

Reviewed 2026-09-05 at `eb5ae5e7394bfb1cac980576ef4caf97ce1fd894`.
Scope: verify the v29 data-protection slice, including rejected archive/reset,
concurrent saves, and storage-read failure. Review only; no application fixes made.

## Verdict

The original v28 navigation-overwrite and stat-only deletion cases no longer
reproduce. v29 improves both ordinary operation and visibility of failed writes.
Three recovery defects remain. The most direct on-course failure is that a failed
archive still resets the active round, removing the unsaved data from the very
export surface the warning tells the user to use.

## A1 — P1: a failed archive resets the round before it is durably saved

Source: `js/app.js:233-242`; warning text at `js/app.js:193-197`.
Verified with injected write failure and, separately, an actual stale-revision
rejection in isolated VM sessions. Browser confirmation testing was blocked by
the automation dialog interface; this is not claimed as a completed browser repro.

Reproduction:

1. Save Hole 1 score 4 successfully.
2. Refuse subsequent round-storage writes.
3. Change Hole 1 to 5 and add a note. The ordinary save warning works, and the
   current export still contains the unsaved data.
4. Accept Start New Round / archive anyway.

Observed:

- Persisted Hole 1 is still 4; the archive write failed.
- The active hole is blank and the current export no longer contains the note.
- Score 5 and its note exist only in an in-memory archived round.
- The banner says to export now, but export is now for the new blank round.
- A reload loses that in-memory archive and its unsaved additions.

The same reset occurs on a conflict: a stale session's unique note is moved into
an unsaved archive while the newer persisted state is correctly left intact.
The conflict banner then advises reloading, which abandons the stranded note.
There is no existing archive export/detail UI to recover it through normal use.

This is not immediate destruction of every previous score: successfully persisted
data remains on disk, and the tentative archive remains in RAM until reload. The
defect is losing access to unsaved additions through normal recovery controls.

Root cause: newRound mutates state.rounds and replaces state.holes, then ignores
save()'s false result. save() returning a boolean does not make its callers safe.

Fix direction: construct a candidate next state without discarding the active
round; commit it successfully before changing the current screen/cursor. On write
failure or conflict, keep the old editable/exportable round and its notes visible.
If a recovery buffer is used, expose an explicit way to export that exact buffer.

Acceptance:

- Failed write and stale conflict during archive leave the original active round,
  notes, pin, mode, cursor and export content intact.
- A retry after the failure clears archives once, without duplication.
- A rejected retry cannot silently overwrite the competing round.
- Test with both scored rounds and notes/putts-only rounds.

## A2 — P1: overlapping saves can both pass the revision check

Source: `js/app.js:163-184`.
Verified through deterministic interleaving of the real save() function in two
VM sessions sharing storage. This is not a measured simultaneous-save race on the
physical phone or the browser used for the sequential test.

Interleaving:

1. A and B both hold revision 1.
2. A reads stored revision 1, then is paused before writing.
3. B reads revision 1 and successfully saves a new score as revision 2.
4. A resumes and successfully writes its own snapshot as revision 2.
5. Deliver external-write checks to both sessions.

Observed: both sessions and disk have revision 2, B's score has disappeared, and
both conflict flags are false. isStale only asks whether disk.rev > state.rev;
equal revisions with different writers/content are invisible. writer is saved but
never used to detect the collision.

This is a supported risk model: the [HTML Web Storage specification](https://html.spec.whatwg.org/multipage/webstorage.html#the-localstorage-attribute)
explicitly warns authors not to assume locking across windows. Synchronous calls
within a tab do not make its whole read/compare/write sequence a cross-tab transaction.

Fix direction: serialize the entire revision-read and commit operation, or use
a transactional persistence mechanism that detects competing writes. Merely
checking writer afterward can detect damage but cannot undo an overwritten round.
Preserve rejected edits as an exportable branch; automatic merging is not required.

Acceptance: force the interleaving above and require either safe serialization or
explicit rejection with recoverable edits. Never allow both saves to claim success
while one score disappears. Then verify the chosen mechanism in supported browsers.

## A3 — P2: a storage-read failure is treated as an empty store

Source: `js/app.js:163-175`.
Verified with an injected transient read failure while writes remain available.
No claim that a particular phone storage policy commonly allows reads to fail
while writes succeed; this tests the function's fail-open error contract.

readStored catches read and JSON-parse errors and returns null, the same value as
a genuinely absent store. save therefore skips conflict protection and proceeds
to write. In the probe, a stale session overwrote a newer score and reported
neither saveFailed nor saveConflict.

Fix direction: distinguish absent, successfully read, and unreadable/corrupt
storage. An inability to verify the persisted revision must stop the write and
offer export/recovery. Preserve corrupt stored text for recovery instead of
silently treating it as permission to initialize a replacement.

Acceptance: transient read exceptions, malformed stored JSON, and a genuinely
absent key produce separate outcomes. Only a genuinely absent key should permit
new-store initialization. Failure must not destroy the previously stored bytes.

## Confirmed improvements

- GitHub main equals local `eb5ae5e`; GitHub verify and Pages deployment both
  returned success for that SHA. Live sw.js returned `bayoaks-v32`.
  This verifies published deployment, not the installed phone's active worker.
- Existing `npm test` returned `RESULT: ALL PASS` (the suite reports 215 checks).
- The v28 standalone probes clear old F1 and F2 and still reproduce F3-F6.
- Real localhost browser: two tabs share a round; A records H2=5; B navigates and
  makes a stale note edit; A reloads with H2=5 intact. B shows the conflict banner.
- Controlled full 18: score 72 and 36 putts survive archive and a fresh VM reload;
  the new round is blank.
- Controlled stats-only round: notes and three putts survive archive and reload.
- Ordinary write failure leaves unsaved data in the active export and warns.

## Still open from the previous review

These are already acknowledged and are not new discoveries in this pass:

- F3: mode-specific export versus all-hole archive.
- F4: hotspot CHIP6 keeps a chip invalidated by a GIR correction.
- F5: a delayed export callback marks a newer revision exported.
- F6: delayed dictation writes to the currently displayed hole.
- Gate inspection of working versus staged trees and HEAD~1-only CI range.
- Caddy contradictions, tee provenance, full-history recovery and unknown SS coverage.

A shared asynchronous round/revision/hole token helps F5 and F6. It does not by
itself solve F3's included-hole selection or F4's observation-validity policy.

## Next repair boundary

Keep this slice about protecting writes and transitions:

1. Make archive/reset contingent on a successful, conflict-safe commit.
2. Make unreadable storage a rejected write, with data still exportable.
3. Serialize revision validation plus save, and test overlapping writers.

Do not change SS history semantics as part of this repair. Resolve that definition
separately, with unknown-answer coverage displayed explicitly.

## Reproducibility and limits

Run `node docs/reviews/v29-failure-probes.mjs` from the repository or use the
script's absolute path. It creates only in-memory synthetic state and reports
three positive checks plus four reproduced scenarios (A1 has two rejection paths).
REPRODUCED means the defect is present. These review probes do not modify or replace
verify.mjs and are not a shipping gate.

Real browser testing confirmed the sequential stale-navigation/stale-edit fix.
The attempted archive confirmation left the automation interface unresponsive;
confirmation completion and tab cleanup could not be verified. No production
browser records were accessed. Quota failure, interleaving and read exceptions
were controlled tests, not actual browser quota exhaustion or race-frequency tests.
Physical phone offline updates, native sharing and microphone behavior remain untested.

Only this report and its reproduction script were added. Application code, existing
tests, dependencies, hook configuration, playing records and Git history were unchanged.

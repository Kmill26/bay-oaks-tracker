# v30 follow-up: two fixes accepted, collision durability still open

Reviewed 2026-09-05 at `a2245cd329fc69ee7668a1f4ea730e3066e31bb3`.
This is an independent review, not an implementation or deployment change.

## Decision

Accept A1 (failed archive/reset recovery) and A3 (unreadable storage rejects writes)
for the tested cases. Keep A2 open as P1. The new writer comparison detects the
collision, but an acknowledged score still disappears from persistent storage,
and the losing tab's recovery message tells the player to reload and lose the
only remaining in-memory copy.

This is one remaining persistence defect plus misleading recovery guidance, not
three unrelated new defects. The strengthened review script has 11 passing
assertions and three failures concerning that same collision scenario.

## A1 accepted: rejection preserves the exportable round

Source: `js/app.js:280-303`.

The controlled write-failure check saved H1=4, then refused writes while changing
H1 to 5 and adding a note. Start New Round now returns false and preserves:

- The complete pre-transition state, including the current revision/writer.
- The note and score in the current export.
- The selected hole and separate persisted cursor.
- The existing archive array without adding an orphan.

After writes are restored, a retry succeeds. A fresh session sees exactly one
archived round containing H1=5 and its note. The stale-revision rejection variant
also retains the complete draft and export rather than switching to a blank round.

These assertions do not read a nonexistent archive entry to decide whether the
fix works. They directly verify the required outcome and safe retry behavior.

## A3 accepted: read failure does not authorize replacement

Source: `js/app.js:168-174`, `js/app.js:193-195`.

With a read exception, save returns false and the previous stored bytes remain
unchanged. With malformed JSON, save also returns false and preserves the exact
malformed text. Ordinary save after a reload succeeds, so the previous writer id
is not incorrectly treated as a collision in that normal flow.

These are injected failure tests. They do not establish how often storage failures
occur on the physical phone or cover every possible schema-corruption shape.

## A2 still open — P1: collision detection does not preserve acknowledged data

Source: `js/app.js:191-220`.

The test deliberately schedules the same interleaving as the previous review:

1. A and B load revision 1, which contains H1=4.
2. A reads that revision and pauses before its write.
3. B enters H3=6 with a note and saves. Its save returns **true**.
4. A writes its older snapshot plus H2=5. Its save also returns **true**.
5. B receives the external-write check and is correctly marked conflicted.
6. A fresh load from the shared store represents closing/reopening or reloading B.

Observed:

| Value | Result |
|---|---|
| A save result | true |
| B save result | true |
| B conflict after notification | true |
| H3 in B's remaining memory | 6 |
| H3 after fresh load | null |
| B's note after fresh load | empty |

The notification arrived after the successful save, and after persistent data had
been overwritten. That is detection of a lost write, not explicit rejection of
the losing save. A is not entitled to silently discard B's unrelated acknowledged
score merely because A wrote last.

This controlled interleaving verifies the logic, not race frequency on a particular
phone/browser. The [HTML Web Storage specification](https://html.spec.whatwg.org/multipage/webstorage.html#the-localstorage-attribute)
warns against assuming a storage locking mechanism across windows. The whole
read/compare/write operation needs protection, not merely each synchronous call.

### Recovery guidance is unsafe in this collision case

Source: `js/app.js:229-233`.

The current banner says:

> Nothing was overwritten. Reload this tab to pick up the newer version before entering anything else.

In the reproduced case, B's stored score was overwritten. Reloading B destroys its
remaining in-memory score and note. The same message is used for two different
states: refusing a stale write before persistence, and discovering that a completed
write was overwritten. Those need different recovery behavior.

An immediate mitigation should retain/export the losing draft before advising a
reload and accurately describe the conflict. That improves recovery but is not a
substitute for durable write protection: a tab can close or be suspended before
the player acts on the message.

### Correct repair acceptance

- A stale save cannot erase unrelated acknowledged edits from another session.
- If one writer is rejected, its unsaved work remains accessible for recovery.
- Closing/reopening either session cannot silently remove acknowledged work.
- The conflict message distinguishes a rejected write from an already-lost write.
- Normal save, reload, save and archive still work without false conflicts.
- Failed archive transitions remain reversible and retries do not duplicate rounds.

Serialize the revision check and write, or move the commit to transactional
persistence. An independently durable recovery copy can additionally protect
rejected drafts. Merely changing the banner, comparing writer ids again, or making
the old probe's compound condition false does not meet these outcome requirements.

## Why the older probe was too weak

The previous reproduction identified a lost write with both conflict flags false.
Setting B's conflict flag to true changed that compound predicate to false even
though its evidence still showed the lost score. NOT REPRODUCED in that script
meant the exact old symptom changed, not that persistence was safe.

The new script checks the saved score and note after a fresh load and exits
nonzero on a failed requirement. It does not accept a banner as a substitute for
data survival. These stronger assertions supplement the untouched existing oracle.

## Other reviewed behavior

The v28 probes still clear the original stale-navigation and stat-only-round
deletion cases. They continue to reproduce the four deliberately deferred issues:

- F3: different included holes in mode-specific export versus archive.
- F4: stale CHIP6 retained by hotspot calculations.
- F5: delayed copy callback marks a newer revision exported.
- F6: delayed dictation lands on the currently selected hole.

No claim that these four were fixed by v30. Their existing priority remains below
safe persistence. F3 and F4 are calculation/input-selection issues; callback tokens
help F5/F6 but are not a complete solution for F3/F4.

## External proof and validation

- GitHub main: `a2245cd329fc69ee7668a1f4ea730e3066e31bb3`.
- GitHub verify and Pages deployment: success for that SHA.
- Live sw.js: `bayoaks-v33`.
- SHA-256 comparisons were identical for local/live index.html, styles.css,
  js/app.js, js/stats.js, js/course.js, js/player.js and sw.js.
- Existing `npm test`: `RESULT: ALL PASS`.
- New review script: `REVIEW RESULT: 3 FAILED` (11 other assertions pass).

Run `node docs/reviews/v30-durability-checks.mjs`. The script uses synthetic VM
storage only, writes no playing records and deliberately exits 1 while the
durability requirements above remain unmet. It is a review artifact, not a
replacement for verify.mjs. If save becomes asynchronous, adapt the scheduler
and awaits while retaining the outcome requirements.

This pass did not perform a new physical-device or browser UI run. Function-level
session behavior, fault injection and fresh state loads were exercised. Browser
race frequency, physical-phone offline updates, sharing and microphone behavior
remain unverified. Published assets matching does not prove which worker is active
on the installed phone.

Only this report and its new review script were added. Production code, existing
tests, dependencies, hooks, records and Git history were left unchanged.

# v37 recovery review → v38

Independent review of the v37 recovery rework. Seventeen acceptance outcomes were written
from what the player needs on the course **before** reading `js/app.js`'s v37 recovery code;
the only thing taken from the source first was the list of function names to drive. The
runnable form is `docs/reviews/v37-recovery-acceptance.mjs` (`node docs/reviews/v37-recovery-acceptance.mjs`).

v37's oracle was green at 401 checks throughout. That is evidence about what `verify.mjs`
covers, not about what it cannot see: it had no assertion on how many backup entries exist,
so a store that grew without bound was structurally invisible to it.

## What v37 got right, and v38 does not undo

- Independent immutable entries: two tabs stashing concurrently never erase each other.
- A failed or corrupt read of the backup store returns unknown, never an empty collection,
  so it can never license a replacement.
- Legacy `v1`/`v2` collections stay readable and their original bytes are untouched;
  retirement is a per-entry receipt.
- Restore is a swap: the round it displaces is stashed first, and if that stash fails the
  swap does not happen.
- Cleanup identifies a draft by round identity plus hole content, so two rounds that share a
  scorecard are not confused for each other.

## Confirmed defects

Reproduction for all four: nine holes of ordinary entry (score, putts, FIR, GIR) with every
save refused — 36 stashes.

**1. The store never pruned (high).** One immutable entry per stash and nothing removed one.
A later *successful* save retired exactly one entry, the exact-content match; the other 35
persisted. Five such rounds accumulated 180 entries / 468 KB, monotonic. A backup store that
grows without bound eventually becomes the storage failure it exists to survive.

**2. The banner counted entries and called them rounds (high).** Verbatim from the app after
one round: `⚠️ 36 rounds that could not be saved were kept`.

**3. "Discard it" deleted the newest backup first (high).** It retired only entries whose
bytes matched the offered one exactly — one snapshot out of dozens — and the offered one is
the newest. There is no list UI: one button restores `recovered[0]`. Measured: three taps to
clear the banner, after which "Show the kept round" returned the round as of H8 rather than
H9. Clearing the banner meant tapping Discard once per tap of the round.

**4. Ordering ties were unresolved (medium).** `stashedAt` is millisecond-resolution and was
the only sort key, while a monotonic sequence already sat in the storage key. Under burst
stashing all 36 landed within ~2 ms and `recovered[0]` was the *emptiest* snapshot. Real taps
are seconds apart, so this needs a burst to bite — stated as a tie-break correctness gap, not
as an everyday failure.

## v38

Retention is **supersession, not age**. An older snapshot is retired only when a newer one
demonstrably contains everything it held: same round identity, and every recorded field
present and equal. A correction that *clears* a field (GIR No → Yes drops the chip) fails
that test, so that snapshot is kept. `DRAFT_GROUP_CAP` (12) is a backstop for a round of
corrections that never supersede — losing the oldest snapshot of one round beats filling the
origin and losing the ability to save at all. Pruning is scoped to the entry's own group
(`roundId|tab[|slot]`), so the `displaced` slot is structurally out of reach — that is the
draft v35 lost when cleanup deleted by ownership, and Case 28e pins it.

A successful save now retires every draft of that round it supersedes, not only the exact
byte match. Discard retires the offered draft and every snapshot it supersedes. Matching on
round identity instead would be one step too wide: two tabs can hold genuinely different
states of the same round, neither containing the other, and Case 28d's companion assertion
plus probe case G1 both hold that line. The banner counts distinct rounds. `loadRecovery()`
breaks a `stashedAt` tie on the sequence already in the key.

Measured after: 36 refused saves → **1** backup entry (5 KB, was 96 KB); a successful save →
**0**; three rounds → no accumulation; reload offers one entry, it is the newest, and
restoring it returns hole 18; the banner reads `A round that could not be saved was kept`;
one Discard clears it.

## Not defects — do not re-open without a fresh reproduction

- No per-tap cost was measurable from the pile (0.01 ms/tap with 180 drafts in the simulator).
  A real browser's `localStorage` is slower; no user-perceptible cost was demonstrated.
- `loadRecovery()` hiding a backup identical to the round on screen is correct, not a loss.
  Two review cases initially failed on this and were wrong.

## Limits of this review

Simulated (`node`, a stubbed DOM and storage) and browser-tested on an isolated localhost
origin. Not tested on a physical phone: offline launch after closing the app, a service-worker
update landing mid-round, native share, and microphone ownership remain unverified.

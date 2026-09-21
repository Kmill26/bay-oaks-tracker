# Phone acceptance — Pixel 10 Pro, Chrome

Everything the simulator and the desktop browser structurally cannot answer. Roughly 15
minutes. Run it in the driveway, not on the course.

**Why some of this can't be isolated.** Service workers, the microphone and the clipboard
all require a secure context, so the offline, install and dictation checks have to run on
`https://kmill26.github.io/bay-oaks-tracker/` — the same origin that holds your real rounds.
A LAN address served from the Mac would be plain HTTP: no service worker, no microphone, so
it cannot answer these questions.

**Why entering test scores costs something.** A score cannot be set back to blank — the
stepper's floor is 1 — and there is no delete-a-round control. So any hole you tap in on the
real profile stays in the current round until *Start New Round*, which archives it. Part 1
therefore runs in Incognito, where storage is separate and thrown away. Part 2 runs on the
real profile and is written to avoid entering anything.

---

## Part 0 — protect the round you have (2 min)

1. Open the app as you normally do. If a round is in progress: **Copy Log**, paste it into
   Messages to yourself, and send it. That is your backup.
2. Note whether the ⚠️ banner is showing anything. Write down what it says.

`Round in progress: yes / no` · `Banner: ______________________`

---

## Part 1 — Incognito, isolated (no risk to your records)

Chrome → ⋮ → **New Incognito tab** → `https://kmill26.github.io/bay-oaks-tracker/`

**1.1 Service worker installs on a real phone**
Load the page, wait 5 seconds, pull down to reload once.
*Expect:* it loads normally both times.
`PASS / FAIL: ______`

**1.2 Offline launch**
Turn on Airplane Mode. Close the tab. Open a new Incognito tab to the same URL.
*Expect:* the app loads fully — holes, caddy text, buttons — with no browser error page.
This is the one that matters at Bay Oaks; the back nine has no signal.
`PASS / FAIL: ______` · *If it fails, note exactly what the screen shows:* `__________`

**1.3 Scores survive a reload while offline**
Still in Airplane Mode: enter H1 score, putts, FIR, GIR. Reload the page.
*Expect:* all four are still there, and no ⚠️ banner appears.
`PASS / FAIL: ______`

**1.3b Dictate with no signal**
Still in Airplane Mode, tap Dictate.
*Expect:* it does not say Listening. It says dictation needs a connection, so you type the note.
`PASS / FAIL: ______`

**1.4 Microphone ownership**
Airplane Mode off. Dictate should offer itself again. Go to H2, tap it, allow the mic when asked, say
*"driver up the left, one-seventeen in"*. While it is still listening, tap **Next** to H3.
*Expect:* the note lands on **H2**, not H3, and H3's note stays empty. If the mic is blocked or the
recognizer refuses, the hole says so — it does not reset to a quiet Dictate button.
`PASS / FAIL: ______` · *Note landed on H___*

**1.5 Native share**
Tap the share/export control.
*Expect:* the Android share sheet opens with the round text or a file. Cancel it.
*Then check:* does the app still say the round is unexported? Cancelling a share must not
mark it exported.
`Share sheet opened: PASS / FAIL: ______` · `Still unexported after cancel: PASS / FAIL: ______`

Close all Incognito tabs when done — that discards everything above.

---

## Part 2 — the installed app, real profile (no data entry)

**2.1 Install to the home screen**
Normal Chrome → the app. If an **Install** button is in the header, tap it and accept.
If it is not there, Chrome is not offering the prompt: use ⋮ → **Install app / Add to Home screen**.
Open it from the icon.
*Expect:* it opens without browser chrome, and your current round is exactly as you left it.
The header button is that native prompt, not a second checklist, and it hides once used.
`PASS / FAIL: ______`

**2.2 Installed offline launch after a full close**
From the installed app: Airplane Mode on, swipe the app away from Recents, reopen from the
icon.
*Expect:* full app, your round intact. This is the real course scenario — the app has been
closed since the last hole and there is no signal.
`PASS / FAIL: ______`

**2.3 An update lands while a round is open**
The shell you have open stays on that `bayoaks-vN` until you swipe the app away.
A blip of signal must not reload the hole under your thumb. After a deploy that
bumps `sw.js`: back out to Recents, swipe the app away, reopen it.
*Expect:* your round is unchanged, and the reopen is on the new cache. The name
is the `bayoaks-vN` string in `sw.js`.
`Round survived: PASS / FAIL: ______` · `Picked up the new version after a full close: PASS / FAIL: ______`

**2.4 Storage survives a day**
Nothing to do now. Tomorrow, open the app and confirm your round is still there. Android can
evict site storage under pressure, and an installed PWA is more protected than a tab — worth
knowing which you have.
`PASS / FAIL (tomorrow): ______`

---

## Known before you start

- Minus from 1 blanks a mis-tapped score. There is still no delete for an archived round.
- `pvTip` has no per-hole White text yet; from the White tees you get the Blue tip with the
  White yardage and a line saying the clubs above are Blue numbers.
- If the ⚠️ recovery banner appears at any point, screenshot it before tapping anything.

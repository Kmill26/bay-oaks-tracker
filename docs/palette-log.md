# Palette Log

A running record of every palette this app has worn. The monthly swap appends an
entry here so a future one doesn't repeat a past one or an obvious variation of it.

**Append, never rewrite.** Retired palettes stay listed with the version range and
date they were retired.

## Fixed constraints (these do not change between palettes)

- Light default; dark is the option.
- One accent only. Semantic green/red keep their jobs; nothing else gets a color.
- Body text >= 4.5:1 on its ground, aim >= 5:1. Muted text is where palettes fail.
- System font stacks only. No font files, no webfonts.
- Numerals stay monospaced and tabular. The display font may change freely.
- No hardcoded hex. Everything routes through `:root` / theme blocks in `styles.css`.

---

## Navy & Brass — v1 through v20 (retired 2026-08-25)

The original. Dark default with a "sunlight" high-contrast exception.

| Token | Midnight | Sunlight |
|---|---|---|
| ground | `#0b1220` | `#000000` |
| panel | `#141e30` | `#111927` |
| accent | `#c9973f` brass | `#ffea00` |
| text | `#efe6d0` cream | `#ffffff` |
| muted | `#8b96ab` | `#cbd5e1` |

Retired because the palette had gone stale across projects, and because the dark
default was backwards: sunlight was the case that actually worked on a cart.

Known defect, fixed in v22: borders were hardcoded (`#263450`, `#2c3a5c`,
`#334466`, `#374b6e` in CSS; `#22304a` inline in `js/app.js`) and never swapped
with the theme.

---

## Oxblood & Bone — v21 onward (current, from 2026-08-25)

Light default. Oxblood moved from ground to accent when the default flipped.

| Token | Bone (default) | Dusk |
|---|---|---|
| ground | `#EFE9DC` | `#3A1310` |
| panel | `#F7F2E8` | `#4A1A16` |
| panel2 | `#E5DCCB` | `#5C1F1B` |
| accent | `#5C1F1B` oxblood | `#C9A88F` clay |
| ink | `#16181A` | `#EFE9DC` |
| muted | `#6B5A4E` | `#C9A88F` |
| line | `#D6CDBC` | `#5C1F1B` |
| green | `#2E6B4F` | `#6FD3A0` |
| red | `#A32E24` | `#E8836F` |

Measured contrast on bone: ink 14.72:1, oxblood 10.41:1, muted 5.43:1,
green 5.21:1, red 5.84:1. On dusk ground: ink 13.56:1, clay 7.40:1.

Note: the obvious clay for muted (`#A08878`) measured 2.76:1 and was rejected —
unreadable as body text in glare. Muted is the token to check first on any swap.

---

## Parchment & Tobacco — v40 onward (logged 2026-09-21)

Successor to Oxblood & Bone. The stylesheet left that palette on 2026-09-06
(v40 daylight scorecard, v41 parchment/tobacco/brass, v42 score-entry pass).
The log was not updated then, so the heading above still says "current" — this
file appends and does not rewrite. What follows is the palette that has been
shipping, recorded when the override stack was collapsed into the two token
blocks. The collapse did not retint anything.

Light is the default: parchment ground, cream panels, tobacco ink, oxblood
accent, brass trim. Dusk is tobacco surfaces with a brass accent. `--brass`,
`--hero`, and `--hero-ink` are the scorecard chrome (the hero panel behind the
score, brass on the selected score button). `--oxblood` is still the name
generated summary and trend markup uses for the accent; on dusk that accent
is brass, not oxblood.

`--on-brass` and `--brass-edge` are the same in both themes. The selected
score button is a brass face with bone-ink type and a bone-oxblood hairline;
those two do not flip when dusk is on. `--sheen` is the faint corner wash on
the ground, also the same in both themes.

Dusk green, red, and warn are the forest values from the pass before the
surfaces moved to tobacco. They were not retinted with the surfaces, and this
entry does not retint them either.

| Token | Parchment (default) | Dusk |
|---|---|---|
| ground | `#EDE1C9` | `#201A15` |
| panel | `#FFF8E9` | `#30261F` |
| panel2 | `#E8D7B9` | `#443426` |
| ink | `#2C211A` | `#FFF3DB` |
| accent (`--oxblood`) | `#63351F` oxblood | `#E5BD82` brass |
| muted | `#604B38` | `#D7C2A3` |
| line | `#C5AC85` | `#756044` |
| line-strong | `#887052` | `#A58B69` |
| line-soft | `#DBC9A9` | `#574735` |
| on accent (`--on-oxblood`) | `#FFF8E9` | `#2C211A` |
| brass | `#D5B477` | `#CDA66D` |
| hero | `#432B20` | `#35251D` |
| hero-ink | `#FFF3DB` | `#FFF3DB` |
| on-brass | `#2C211A` | `#2C211A` (not flipped) |
| brass-edge | `#63351F` | `#63351F` (not flipped) |
| green | `#17613D` | `#A9E4B5` |
| red | `#A12520` | `#FFB2A5` |
| warn | `#8A3518` | `#FFD09A` |
| sheen | `rgba(255,248,233,.28)` | same |

Measured contrast, parchment: ink/ground 12.10:1, ink/panel 14.82:1,
muted/ground 6.33:1, muted/panel 7.75:1, oxblood/ground 7.87:1,
oxblood/panel 9.64:1, on-oxblood/oxblood 9.64:1, hero-ink/hero 11.90:1,
on-brass/brass 7.93:1, green/ground 5.76:1, red/ground 5.79:1,
warn/ground 6.23:1. Dusk: ink/ground 15.65:1, ink/panel 13.42:1,
muted/ground 9.95:1, muted/panel 8.53:1, accent/ground 9.78:1,
on-accent/accent 8.91:1, hero-ink/hero 13.32:1, on-brass/brass 6.92:1,
green/ground 11.85:1, red/ground 9.97:1, warn/ground 12.08:1.

---

## Lodge dusk — v49 onward (logged 2026-09-21)

Dusk only. Light stays the Parchment & Tobacco sun-cream above, so a phone in
glare still has a cream ground. This entry does not retint `:root`.

The clubhouse option stops being tobacco-brown and becomes the lodge: a
mahogany floor, chocolate leather panels, a lit timber score beam, an amber
lamp for the accent and the selected controls, and cool slate for the lines.
Forest green stays on `--green` (a fairway that still reads as text). It does
not paint the surfaces.

`--oxblood` is still the name the summary and trend markup uses. On dusk that
accent is amber, not oxblood. `--on-brass` (`#2C211A`) and `--brass-edge`
(`#63351F`) stay the shared bone values; the dusk brass face was chosen so
bone ink on it still clears 5:1 and the bone oxblood hairline still clears 3:1.
`--sheen` flips on dusk only — an amber lamp in the top corner, held at 8% so
the floor stays mahogany. At 20% the corner climbed to caramel and the leather
sat darker than the floor. Light keeps the cream wash. Muted on the 8% corner
blend (`#3C2417`) is 8.58:1.

Muted is the token that failed last time (clay `#A08878` at 2.76:1). Lodge
muted is a warm cream, checked on the lightest leather it sits on, not only
on the floor.

| Token | Parchment (unchanged) | Lodge dusk |
|---|---|---|
| ground | `#EDE1C9` | `#2C1812` mahogany |
| panel | `#FFF8E9` | `#43291E` chocolate |
| panel2 | `#E8D7B9` | `#533326` leather |
| ink | `#2C211A` | `#F6EBDC` cream |
| accent (`--oxblood`) | `#63351F` oxblood | `#F0B14E` amber |
| muted | `#604B38` | `#DCC4A8` |
| line | `#C5AC85` | `#8E98A0` slate |
| line-strong | `#887052` | `#A7B0B6` slate |
| line-soft | `#DBC9A9` | `#808890` slate |
| on accent (`--on-oxblood`) | `#FFF8E9` | `#2C1812` |
| brass | `#D5B477` | `#E2B15E` |
| hero | `#432B20` | `#5A3222` timber |
| hero-ink | `#FFF3DB` | `#F6EBDC` |
| on-brass | `#2C211A` | `#2C211A` (not flipped) |
| brass-edge | `#63351F` | `#63351F` (not flipped) |
| green | `#17613D` | `#74C47E` fairway |
| red | `#A12520` | `#FFB3A4` |
| warn | `#8A3518` | `#E89878` |
| sheen | `rgba(255,248,233,.28)` | `rgba(240,177,78,.08)` |

Measured contrast, lodge dusk: ink/ground 14.31:1, ink/panel 11.33:1,
ink/panel2 9.54:1, muted/ground 10.03:1, muted/panel 7.94:1,
muted/panel2 6.69:1, accent/ground 8.91:1, accent/panel 7.05:1,
accent/panel2 5.94:1, on-accent/accent 8.91:1, hero-ink/hero 9.32:1,
on-brass/brass 7.98:1, brass-edge/brass 5.19:1, green/ground 7.97:1,
green/panel 6.31:1, red/ground 9.82:1, red/panel 7.77:1,
on-accent/red 9.82:1, warn/ground 7.38:1, warn/panel 5.84:1.
Slate is non-text: line-strong/panel 6.05:1, line/panel 4.54:1,
line-soft/panel 3.71:1. Tightest body pair is warn on leather at 5.84:1.
Parchment ratios are unchanged from the entry above.

---

## Clubhouse all day — v55 onward (logged 2026-09-28)

Kenny picked this from three mockups. It is not a new palette: both grounds,
both panels, the accent, the muted, the lines, green/red/warn and the brass face
are the values already logged above. What changes is *where the dark surface
goes*. The lodge stops being a dusk-only look and becomes the app's structure in
both themes: the header, the hole panel, the score beam and the footer are one
leather band with brass trim, and the parchment is reserved for what he reads in
the sun — the game plan and every answer button.

Two tokens moved and two were added.

| Token | Was (v54) | Now (v55) | Why |
|---|---|---|---|
| `--hero` light | `#432B20` | `#3A2117` | The band is now four surfaces, not one panel. Deeper leather so brass trim and cream type both sit up off it. |
| `--hero` dusk | `#5A3222` | `#1A0D08` | v54's timber was *lighter* than the mahogany floor. A band lighter than the room reads as a raised box; at dusk the clubhouse bands go darker than the floor and the lamp-brass rule draws the edge. |
| `--hero-muted` | (new) | `#E8D3AE` / `#DCC4A8` | The date/holes line sits on leather now. `--muted` is tuned for parchment and is unreadable there. |
| `--serif` | (new) | `Georgia,"Noto Serif","Times New Roman",serif` | One numeral face, named once. |

Nothing else was retinted. `--brass` does all the trim work; no second gold was
added, so the one-accent rule holds.

**Numerals, amending the fixed constraint above.** "Numerals stay monospaced and
tabular" was written when the only numbers on screen were in the export block.
Every number the app *shows* — hole number, score, putts, steppers, trend
metrics, summary values — is now `--serif` with `tabular-nums`, because a serif
scorecard with a monospace score reads like two documents. The constraint keeps
its force where it was earned: `pre` / `#exportText` stay on `--numerals`, since
that block is a log meant to be pasted and its columns have to line up.

Measured contrast, parchment (daylight): hero-ink/hero 13.54:1,
brass/hero 7.54:1, hero-muted/hero 10.19:1, on-brass/brass 7.93:1,
brass-edge/brass 5.16:1, ink/panel 14.82:1, ink/ground 12.10:1,
muted/ground 6.33:1, muted/panel 7.75:1, oxblood/panel 9.64:1,
oxblood/panel2 7.21:1. Dusk: hero-ink/hero 16.14:1, brass/hero 9.67:1,
hero-muted/hero 11.32:1, on-brass/brass 7.98:1, brass-edge/brass 5.19:1,
ink/panel 11.33:1, ink/panel2 9.54:1, ink/ground 14.31:1, muted/ground 10.03:1,
muted/panel 7.94:1, oxblood/panel 7.05:1, oxblood/panel2 5.94:1. Tightest body
pair either theme is dusk accent on leather at 5.94:1.

Two non-text separations are deliberately low and the brass rule carries them
instead. Brass on the parchment ground is 1.53:1, so the band's *outer* edge is
soft in daylight — it reads against the leather it trims, which is 7.54:1. At
dusk leather on mahogany is 1.13:1 for the same reason in reverse: the boundary
is the 2px brass rule, not a luminance step. Both were checked on screen at
390x844 before being accepted.

Muted is still the token to check first, and it is still the one that moved a
behaviour: locked rows (Short-sided, Chip) used to be the whole row at 35%
opacity, which measured 2.04:1 and was simply unreadable in glare. They are now
full-opacity muted type in a dashed outline — 6.33:1 in daylight, 10.03:1 at
dusk — and they still read as locked.

---

## Carbon & Paper — v58 (2026-09-30)

Successor to the unlogged v57 quiet ivory. v57 flattened `--oxblood` to charcoal
on a warm stone ground, so every selected control and the hole beam went soft.
This entry is the Grok scoreboard: cool paper, true black ink, hairline sheets,
no radius, no shadow. Dusk is the same drawing flipped — black floor, white
board, white selected controls.

One accent. It is the ink. `--oxblood` keeps its name because summary and trend
markup paint with it; on this palette that accent is black by day and paper by
dusk, not a second hue. `--brass` is the same ink, so the selected score cell
matches every other selected control. Green, red, and warn stay semantic and
do not paint surfaces.

Numerals on screen stay the system grotesque with tabular figures. The export
log stays `--numerals` (monospace) so pasted columns still line up. No webfont.

| Token | Paper (default) | Dusk |
|---|---|---|
| ground | `#F4F4F2` | `#0A0A0A` |
| panel | `#FFFFFF` | `#141414` |
| panel2 | `#ECECEA` | `#1C1C1C` |
| ink | `#111111` | `#F5F5F4` |
| accent (`--oxblood`) | `#111111` | `#F5F5F4` |
| muted | `#595957` | `#ABABAA` |
| line | `#D2D2D0` | `#2A2A2A` |
| line-strong | `#6E6E6C` | `#6A6A68` |
| line-soft | `#E4E4E2` | `#222222` |
| on accent | `#FFFFFF` | `#111111` |
| brass | `#111111` | `#F5F5F4` |
| hero | `#111111` | `#F5F5F4` |
| hero-ink | `#FFFFFF` | `#111111` |
| hero-muted | `#C6C6C4` | `#4E4E4C` |
| hero-line | `#6A6A68` | `#111111` |
| on-brass | `#FFFFFF` | `#111111` |
| brass-edge | `#111111` | `#D0D0CE` |
| green | `#0E6A3C` | `#9BE3BC` |
| red | `#B4232C` | `#FFB4B6` |
| warn | `#8A4510` | `#F2C48A` |

Measured contrast, paper: ink/ground 17.15:1, ink/panel 18.88:1, ink/panel2 15.96:1,
muted/ground 6.37:1, muted/panel 7.02:1, muted/panel2 5.93:1, on-accent/accent 18.88:1,
hero-ink/hero 18.88:1, hero-muted/hero 11.04:1, on-brass/brass 18.88:1,
green/ground 6.06:1, green/panel 6.68:1, red/ground 5.93:1, red/panel 6.53:1,
warn/ground 6.49:1, warn/panel 7.14:1.
Dusk: ink/ground 18.15:1, ink/panel 16.89:1, ink/panel2 15.62:1,
muted/ground 8.61:1, muted/panel 8.02:1, muted/panel2 7.42:1, on-accent/accent 17.31:1,
hero-ink/hero 17.31:1, hero-muted/hero 7.64:1, on-brass/brass 17.31:1,
green/ground 13.30:1, green/panel 12.38:1, red/ground 11.74:1, red/panel 10.93:1,
warn/ground 12.29:1, warn/panel 11.44:1.
Tightest text pair is muted on panel2 in daylight at 5.93:1.

---

## Fairway — v60 (2026-09-30)

Carbon & Paper read as a blank form. The card goes back to a course: mist paper,
a dark hole board, one green. Deep green (`--oxblood`) paints the mark, the
section titles, and every selected answer on the paper, where a light green
would sit too close to white. The same hue, lamp-bright (`--brass` `#3DDC97`),
is the stripe on the board and the selected score, with near-black type on it.
Dusk does not flip the board white. The floor goes to night green and the lamp
stays the accent, so a selected score still glows.

`--serif` is Georgia / Iowan / Palatino for the name, the hole number, and the
score. Body stays the system sans. The export log stays `--numerals`. No webfont.
`--hero-good` and `--hero-bad` are the semantic green and red lifted so they
read on the dark board. They do not paint surfaces.

| Token | Mist (default) | Dusk |
|---|---|---|
| ground | `#EEF3EF` | `#0A100E` |
| panel | `#FFFFFF` | `#141C18` |
| panel2 | `#E3EFE7` | `#1E2A24` |
| ink | `#102018` | `#E8F4EC` |
| accent (`--oxblood`) | `#0E6B45` | `#3DDC97` |
| muted | `#3C5246` | `#A9C2B4` |
| line | `#C5D5CB` | `#2C3D34` |
| line-strong | `#567066` | `#6E8A7C` |
| line-soft | `#E4EEE8` | `#24332C` |
| on accent | `#F4FBF7` | `#062117` |
| brass | `#3DDC97` | `#3DDC97` |
| hero | `#0C1612` | `#07110E` |
| hero-ink | `#F3FAF6` | `#F2FBF6` |
| hero-muted | `#B4C9BC` | `#9BB5A8` |
| hero-line | `#2C4036` | `#1C2C24` |
| hero-good | `#8EE0B4` | `#3DDC97` |
| hero-bad | `#FFB8B2` | `#FFB4AE` |
| on-brass | `#062117` | `#062117` |
| brass-edge | `#062117` | `#062117` |
| green | `#0E6B45` | `#3DDC97` |
| red | `#9C2B24` | `#FFB4AE` |
| warn | `#8A4B12` | `#F0C48A` |

Measured contrast, mist: ink/ground 15.06:1, ink/panel 16.91:1, ink/panel2 14.31:1,
muted/ground 7.52:1, muted/panel 8.44:1, muted/panel2 7.14:1, accent/ground 5.83:1,
accent/panel 6.55:1, on-accent/accent 6.23:1, hero-ink/hero 17.40:1,
hero-muted/hero 10.55:1, on-brass/brass 9.60:1, green/ground 5.83:1, green/panel 6.55:1,
red/ground 6.72:1, red/panel 7.54:1, warn/ground 6.04:1, warn/panel 6.78:1,
hero-good/hero 11.83:1, hero-bad/hero 11.19:1.
Dusk: ink/ground 17.00:1, ink/panel 15.37:1, ink/panel2 13.16:1, muted/ground 10.12:1,
muted/panel 9.15:1, muted/panel2 7.84:1, accent/ground 10.87:1, accent/panel 9.83:1,
on-accent/accent 9.60:1, hero-ink/hero 18.17:1, hero-muted/hero 8.73:1,
on-brass/brass 9.60:1, green/ground 10.87:1, green/panel 9.83:1, red/ground 11.33:1,
red/panel 10.25:1, warn/ground 11.86:1, warn/panel 10.73:1, hero-good/hero 10.85:1,
hero-bad/hero 11.31:1.
Tightest text pair is accent on the mist ground at 5.83:1.


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

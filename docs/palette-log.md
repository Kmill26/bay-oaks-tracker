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

# Design system — VSW Future Planning

The house style for anything visual this project produces: published artifacts, HTML docs, reports, decks.

## Typeface

**Neue Montreal** (Pangram Pangram Foundry) is the project face. A neo-grotesque with slightly tighter proportions than Helvetica, which is what gives it the more contemporary read.

### Files

Live in `assets/fonts/`, subset to Latin and converted to WOFF2:

| File | Weight | Style | Size |
|---|---|---|---|
| `NeueMontreal-regular.woff2` | 400 | normal | 11 KB |
| `NeueMontreal-italic.woff2` | 400 | italic | 13 KB |
| `NeueMontreal-medium.woff2` | 500 | normal | 12 KB |
| `NeueMontreal-bold.woff2` | 700 | normal | 12 KB |

Source OTFs came from a Pangram Pangram family download. Subsetting covers Basic Latin, Latin-1 Supplement, and the typographic punctuation actually used (en/em dashes, curly quotes, middot, arrows, minus). Kerning, ligatures, contextual alternates and both numeral styles are retained.

**Available weights are 400, 500 and 700 only.** There is no 600. Any CSS that reaches for `font-weight: 600` will synthesize a fake bold, so map semibold intent onto 500 or 700 explicitly.

### Using it in an Artifact

Artifacts run under a strict CSP that blocks external font URLs, so the face has to be inlined as a base64 data URI. `assets/fonts/neue-montreal.css` holds the ready-made `@font-face` block (65 KB) and is designed to be pasted or injected verbatim into an artifact's `<style>`.

The build script does the injection so the artifact source stays readable:

```bash
npx tsx scripts/build-artifact.ts <source.html> <output.html>
```

It replaces the marker `/* @font-face:neue-montreal */` in the source with the full font CSS. Write artifact sources with that marker as the first line of the stylesheet, then publish the built output.

### Font stack

```css
font-family: "Neue Montreal", "Helvetica Neue", Helvetica, Arial, sans-serif;
```

The fallbacks matter: `font-display: swap` means text renders in the fallback before the face loads, and Helvetica Neue has close enough metrics that the swap is not jarring.

### Regenerating

If the weights or the subset range need to change:

```bash
python3 -m fontTools.subset <source.otf> \
  --unicodes="U+0020-007E,U+00A0-00FF,U+2010-2027,U+2030,U+2032-2033,U+2039-203A,U+2044,U+20AC,U+2122,U+2190-2193,U+2212" \
  --layout-features='kern,liga,calt,tnum,onum' \
  --flavor=woff2 --no-hinting --desubroutinize \
  --output-file=assets/fonts/NeueMontreal-<weight>.woff2
```

Then rebuild `neue-montreal.css` by base64-encoding each file into a `@font-face` rule.

### Licensing status

⚠️ The source files are the **Demo / Trial** cut redistributed via befonts.com, not a purchased licence. The embedded licence-description field is stripped; vendor ID still reads Pangram Pangram Foundry.

Inlining the face as a data URI ships the font binary inside every published page, so a viewer can extract it. On client-facing work that is redistribution of a commercial foundry's font under a trial licence.

Tej was walked through this on 2026-07-27 and directed that the trial files be used anyway. Recorded here so the decision is visible rather than buried, and so it is easy to reverse: buying the web licence from [pangrampangram.com](https://pangrampangram.com) and re-running the subset command above swaps in licensed files with no other change.

## Colour

Tokens are defined per artifact rather than centrally, but the established palette from the week-plan artifact is the reference:

| Token | Light | Dark | Role |
|---|---|---|---|
| `--paper` | `#FBFBFC` | `#0F1013` | Page ground |
| `--panel` | `#FFFFFF` | `#16181D` | Card surface |
| `--sunk` | `#F4F5F7` | `#1B1E24` | Recessed surface |
| `--ink` | `#17191F` | `#ECEDF0` | Primary text |
| `--muted` | `#666C7A` | `#9BA1AE` | Secondary text |
| `--faint` | `#9AA0AD` | `#6B7280` | Labels, captions |
| `--rule` | `#E7E9ED` | `#24272E` | Hairline dividers |
| `--rule-strong` | `#D6D9DF` | `#333741` | Container borders |
| `--accent` | `#2F55D4` | `#7C97FF` | Accent |
| `--accent-ink` | `#1E3FAE` | `#A9BCFF` | Accent text |
| `--accent-tint` | `#EEF2FE` | `#191E2C` | Accent fill |
| `--ship` | `#1B7F5A` | `#5FCB9C` | Shipped / done state |
| `--ship-tint` | `#E8F5EF` | `#12241D` | Shipped fill |

Semantic state colour (`--ship`) is deliberately separate from the accent so "done" and "emphasis" never compete.

## Conventions

- Both themes are always designed. Redefine tokens under `@media (prefers-color-scheme: dark)` **and** under `:root[data-theme="dark"]` / `:root[data-theme="light"]`, since the viewer's theme toggle stamps `data-theme` on the root and must win in both directions.
- `font-variant-numeric: tabular-nums` on anything where digits align in columns.
- Wide content (tables, code) gets its own `overflow-x: auto` container so the page body never scrolls sideways.
- Uppercase labels get letter-spacing around `0.13em`; headings get `text-wrap: balance`.

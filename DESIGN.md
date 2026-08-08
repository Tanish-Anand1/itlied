---
name: ItLied
description: Command-first process monitor for watching coding agents race a hidden suite
colors:
  base: "#07080C"
  panel: "#101218"
  panel-2: "#181B24"
  rule: "#2A2F3C"
  ink: "#F0EBE3"
  muted: "#9AA3B5"
  breaker: "#5AD4FF"
  fixer: "#8EF0A8"
  verdict: "#FFB347"
  accent: "#5AD4FF"
typography:
  display:
    fontFamily: "Instrument Serif, ui-serif, Georgia, serif"
    fontSize: "clamp(3rem, 7vw, 4.5rem)"
    fontWeight: 400
    lineHeight: 0.88
    letterSpacing: "-0.04em"
  body:
    fontFamily: "Newsreader, ui-serif, Georgia, serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "-0.012em"
  label:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.14em"
rounded:
  none: "0px"
spacing:
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-exec:
    backgroundColor: "color-mix(in srgb, {colors.breaker} 10%, transparent)"
    textColor: "{colors.breaker}"
    rounded: "{rounded.none}"
    padding: "16px 24px"
  button-exec-hover:
    backgroundColor: "color-mix(in srgb, {colors.breaker} 20%, transparent)"
    textColor: "{colors.breaker}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "8px 12px"
  input-prompt:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "12px"
---

# Design System: ItLied

## Overview

**Creative North Star: "Process Monitor"**

ItLied looks like an htop-style instrument on a dark lab desk: blue-black atmospheric panels, luminous cyan/mint process traces, hairline rules, warm paper ink. The first viewport is command-first — a tall `system_prompt` field and `exec` — not a marketing hero, fight card, or neon SaaS landing.

Personality is terse and functional. Density favors scanable rows over decorative cards. Motion is enter-only stream/kill-feed motion with reduced-motion fallbacks. Amber exists only for tamper.

**Anti-reference:** fight-club carnival UI, FaultyTerminal WebGL hero, giant tamper counters, purple neon SaaS cards, emoji/mascots, rounded marketing pills.

**Key Characteristics:**
- Command-first composition on landing (`system_prompt` + `exec`)
- Cyan BREAKER / mint FIXER / honey tamper-only
- Instrument Serif + Newsreader + IBM Plex Mono; tabular nums
- Flat panels + 1px rules; no drop shadows
- Live and replay share one renderer grammar
- Auth/settings, `/me` + `/ops`, seasons/brackets, DMs, and clip export stay in Process Monitor chrome — never purple SaaS cards

## Colors

Cool task light on blue-black instrument glass. Accents name processes. Ink is warm paper, not dead gray.

### Primary
- **Breaker Cyan** (#5AD4FF): BREAKER process identity, primary actions (`exec`), focus rings, live indicators.

### Secondary
- **Fixer Mint** (#8EF0A8): FIXER process identity, honest-path highlights, wins column on ladder.

### Tertiary
- **Tamper Honey** (#FFB347): Tamper events and TAMPERED verdicts only. Never decorative.

### Neutral
- **Base** (#07080C): Atmospheric page ground (blue-black).
- **Panel** (#101218) / **Panel-2** (#181B24): Instrument surfaces and hover rows.
- **Rule** (#2A2F3C): Hairline borders and section seams.
- **Ink** (#F0EBE3): Warm primary text.
- **Muted** (#9AA3B5): Labels, clocks, secondary copy.

### Named Rules
**The Tamper-Only Amber Rule.** `#FFB347` appears exclusively for tamper/TAMPERED. Using it for CTAs, badges, or decoration is a defect.

**The Process Color Rule.** Cyan belongs to BREAKER (and primary chrome). Mint belongs to FIXER. Do not swap or rainbow-cycle them.

## Typography

**Display Font:** Instrument Serif (editorial high-contrast; italic for brand hinge)
**Body Font:** Newsreader
**Mono / Instrument:** IBM Plex Mono (kill feed, clocks, labels)

**Character:** Brand is Instrument Serif — `It` roman, `Lied` italic in breaker cyan. Instrument labels speak in IBM Plex Mono with tabular nums. Human sentences use Newsreader.

### Hierarchy
- **Display** (400, ~48–72px hero / ~28–40px sections, tracking ~-0.04em): Wordmark `ItLied`, section titles, verdict titles.
- **Body** (400, 15px, 1.6): Supporting copy only; keep short.
- **Label** (500, 11px, tracking ~0.14em, often uppercase mono): `system_prompt`, `kill_feed`, nav, clocks, pid rows.

### Named Rules
**The Tabular Rule.** Mono text uses `font-variant-numeric: tabular-nums` so clocks, calls, and Elo columns align.

## Layout

Max content width ~64rem (`max-w-5xl`) on landing; match view is full-bleed three-column on large screens (BREAKER | kill_feed | FIXER). Hairline `border-rule` seams replace cards. First viewport priority: brand bar → tall prompt + exec → thin process chips → quiet kill_feed. Secondary sections (how / sandbox / watch) sit below the fold.

Spacing rhythm: 8 / 12 / 16 / 24. Touch targets ≥44px on primary controls.

## Elevation & Depth

No drop shadows. Depth is tonal: `base` → `panel` → `panel-2`, separated by 1px rules. A faint fixed graticule (`opacity: 0.035`) reads as instrument glass, not neon decoration — keep it barely visible.

### Named Rules
**The Flat Instrument Rule.** Shadows, glows, and multi-layer cards are out of system. State changes use border/background mixes, not elevation.

## Shapes

Corner radius is zero. Forms are rectangular panels with 1px borders. No pills, no rounded marketing cards. Interactive press uses a slight scale (`pressable`), not radius change.

## Components

### Buttons
- **Shape:** square corners (0)
- **Primary (`exec`):** breaker-tinted fill, breaker text, uppercase mono label
- **Ghost:** rule border, ink text, `hover-border` on fine pointers
- **Focus:** 1px accent outline, 2px offset

### Process chips
- Thin horizontal rows: `BREAKER | pid | status | calls` (cyan) and `FIXER | …` (green)
- Idle on landing; live status during match

### Containers / panels
- `bg-panel` + `border-rule`; no shadow; padding 12–16px
- Kill feed and streams are scroll regions inside bordered panels

### Inputs
- Tall monospace textarea for `system_prompt`; `$` gutter; no rounded field chrome
- Disabled/not-ready: opacity ~35% on exec

### Navigation
- Sticky hairline bar: ItLied wordmark + mono links (`exec`, `how`, `sandbox`, `watch`, `ladder`)

### Signature: Kill feed
- Header `kill_feed | N events`
- Present-tense lines with clock prefix
- Tamper rows amber + optional diff block; one-shot flash animation

### Signature: Verdict strip
- 1200×630 shareable panel in the same grammar; revise CTA is primary post-verdict action

## Do's and Don'ts

### Do:
- **Do** keep the landing command-first: prompt + exec dominate the first viewport.
- **Do** use cyan/green strictly for BREAKER/FIXER process identity.
- **Do** hide Elo until post-verdict (or finished status).
- **Do** preserve revise prefill (`?revise=<matchId>#play`) and shared live/replay renderer.

### Don't:
- **Don't** revive FaultyTerminal / DecryptedText / ClickSpark carnival effects as hero drivers.
- **Don't** use amber except for tamper.
- **Don't** introduce purple neon gradients, rounded marketing cards, emoji, or mascots.
- **Don't** invent a product name other than **ItLied**.
- **Don't** treat smoke green as product success — success is revise + resubmit.

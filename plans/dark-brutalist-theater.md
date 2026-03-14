# Plan: Dark Brutalist Theater — "Machine Dialogues"

## Problem

The brutalist redesign (`brutalist-ui-redesign.md`) killed the soul of the project. It replaced a cinematic dark theater with warm paper, red ink, and a government-form aesthetic. The generated avatars — luminous wireframe faces on pure black — look absurd on `#f8f6f1`. The original plan's dark theater concept (`conversational-transcript-viewer.md`) had the right energy but overdid it with scroll-triggered GSAP animations on every message, glassmorphism panels, Three.js particles, and floating gradient blobs.

This plan merges both: **dark cinematic stage + brutalist structural bones + purposeful restraint**.

## Design Philosophy

Two AI minds debating on a dark stage. The avatars are the actors. Typography is the architecture. Hard borders give structural honesty. Color comes from the agents, not from decoration. Motion exists only where it serves function.

Think: a private screening room where declassified AI conversations are projected. Not a nightclub. Not a government archive. A theater.

## Design System

### Colors (CSS Variables)

| Token               | Value     | Usage                                                   |
| ------------------- | --------- | ------------------------------------------------------- |
| `--bg`              | `#0a0a0f` | Page background (near-black, deep theater)              |
| `--bg-raised`       | `#111116` | Cards, panels, elevated surfaces                        |
| `--bg-inset`        | `#08080c` | Inset areas (code blocks, classified body)              |
| `--text`            | `#e8e6e1` | Primary text (warm off-white)                           |
| `--text-muted`      | `#8a8880` | Secondary text, metadata                                |
| `--text-faint`      | `#4a4845` | Tertiary, disabled, labels                              |
| `--border`          | `#2a2a2e` | Structural borders (muted, not screaming)               |
| `--border-emphasis` | `#444`    | Emphasized borders (section rules, active states)       |
| `--accent-claude`   | `#d4a574` | Claude agent identity (warm amber, matches avatar glow) |
| `--accent-gemini`   | `#7eb8da` | Gemini agent identity (cool blue, matches avatar)       |
| `--accent-gpt`      | `#3abf7a` | GPT agent identity (emerald, matches avatar)            |
| `--surface`         | `#111116` | Card/panel backgrounds                                  |

### Typography (Google Fonts — keep current stack)

- **Display**: Instrument Serif (italic) — dramatic headings, turn numbers
- **Body**: Syne (400, 600, 700) — readable body text
- **Mono**: DM Mono (400) — metadata, model IDs, costs, classified labels

No font changes needed. The typography already works. It just needs a dark canvas.

### Spatial Rules (retained from brutalist)

- `border-radius: 0` everywhere — this is the brutalist core
- `border: 1px solid var(--border)` structural, `2px` for emphasis
- No shadows, no blur, no glassmorphism, no gradients on panels
- Generous whitespace (4rem+ section gaps)
- Max-width 1100px container
- Zero `box-shadow` except on the TTS settings modal (functional overlay)

### Motion Rules

- **Zero** scroll-triggered entrance animations on messages
- **Zero** page-load GSAP timelines
- **Zero** Three.js particles or gradient mesh
- **Yes**: CSS transitions for hover states (150ms)
- **Yes**: CSS transition on active playback message highlight (background tint + border glow)
- **Yes**: Subtle CSS `animation` for avatar glow pulse on active speaker during playback (a slow, breathing box-shadow pulse in the agent's color, ~3s cycle)
- **Yes**: Smooth `transition: width` on conversion meter fill (already exists, 600ms)
- All animation via CSS. No GSAP dependency needed at runtime.

## Component Changes

### global.css — Complete Rewrite

Invert the entire color system from light to dark. Keep the grain overlay but make it lighter on dark (opacity ~0.02). Update selection colors. Update scrollbar to dark scheme. Update `.prose` styles for light-on-dark text. Update `.label`, `.small-caps`, `.mono` utilities.

Key changes:

- `--bg: #0a0a0f` (was `#f8f6f1`)
- `--text: #e8e6e1` (was `--ink: #111`)
- All `rgba(0,0,0,...)` to `rgba(255,255,255,...)`
- Prose `code` background: `rgba(255,255,255,0.06)` with `rgba(255,255,255,0.08)` border
- Prose `blockquote` border-left: agent-color or `var(--text-faint)`
- Selection: `background: var(--text); color: var(--bg)`
- Scrollbar thumb: `var(--text-faint)`, hover `var(--text-muted)`
- Add new CSS custom property `--glow-claude`, `--glow-gemini`, `--glow-gpt` for avatar box-shadow glows (e.g. `0 0 20px rgba(212, 165, 116, 0.3)`)
- Add `@keyframes avatar-breathe` — a subtle box-shadow pulse that scales glow opacity from 0.2 to 0.5 and back over 3s

### LandingPage.tsx — Avatar Lineup Hero

Current state: "Machine Dialogues" in giant serif + subtitle on the right.

New design:

- Keep "Machine Dialogues" in giant Instrument Serif italic on dark background
- Below the title: **avatar lineup row** — all unique avatars from loaded transcripts, displayed as 64x64 squares with no border-radius (brutalist), 1px border in each agent's accent color, and a subtle glow on hover
- Deduplicate by model name so each avatar appears once
- Subtitle and transcript count below the avatar row
- Hero rule: 2px line in `var(--border-emphasis)` instead of `var(--ink)`
- Card grid background: `var(--bg)`, card backgrounds: `var(--bg-raised)`

Implementation:

- Extract unique agents from all transcripts (by model name to avatar path)
- Render avatar images in a flex row with gap: 1rem
- Each avatar: 64px x 64px, `object-fit: cover`, `border: 1px solid {agentColor}`
- On hover: glow intensifies (box-shadow in agent color)

### TranscriptCard.tsx — Dark Cards with Avatar Thumbnails

Current state: White cards, 1px black borders, hover inverts to black bg.

New design:

- Background: `var(--bg-raised)`, border: `1px solid var(--border)`
- Top stripe remains (4px in agent-A color)
- **Add**: small avatar image (32px) next to each agent name in the matchup row
- Hover: border brightens to agent-A color, subtle background shift to `var(--bg-inset)`. No full-color inversion (too aggressive for dark theme).
- Text: `var(--text)` primary, `var(--text-muted)` for metadata
- Agent names colored in their accent color
- "Evaluated" badge: border in `var(--text-faint)`, text in `var(--text-muted)`

### TranscriptViewer.tsx — Hero Avatars + Structural Dark Layout

Current state: Header with small color squares (14px), agent name/model, then transcript.

New design for header:

- **Face-off layout**: Two large avatars (120px) facing each other with "vs" between them
- Each avatar has a subtle glow in its agent color (`box-shadow: 0 0 30px rgba(accent, 0.25)`)
- Agent names below their respective avatars, model ID in mono underneath
- Experiment name as the h1 above the face-off
- Section rules: `1px solid var(--border)` (not `var(--ink)`)
- All metadata text: `var(--text-muted)`

Rest of page:

- All `var(--ink)` references become `var(--text)` / `var(--text-muted)` / `var(--text-faint)`
- All `var(--surface)` references become `var(--bg-raised)`
- Section rules in `var(--border)` or `var(--border-emphasis)`

### MessageBubble.tsx — Full-Width Entries with Avatar

Current state: Full-width entry blocks with 2px top border in agent color, giant turn number.

New design (mostly keeping the structure, adding avatar):

- **Add**: small avatar image (40px) in the entry header, between the turn number and attribution text
- Avatar has a `1px solid var(--border)` border by default
- On active playback state:
  - Avatar gets glow in agent color (`box-shadow: 0 0 15px rgba(accent, 0.4)`)
  - Avatar glow pulses via `animation: avatar-breathe 3s ease-in-out infinite`
  - Entry background: very subtle agent-color tint (`rgba(accent, 0.04)`)
  - Left border: `3px solid {agentColor}` added to the entry itself
- Top border (entry\_\_border): kept, `2px` in agent color
- Content text: `var(--text)`, prose styles adapted for dark
- `entry--active` background: `rgba(accent, 0.04)` instead of `rgba(0,0,0,0.03)`

### SystemPromptReveal.tsx — Dark Classified Panel

Current state: Black header bar (works), light body `#f2f0ea` (doesn't work on dark).

New design:

- Header: `var(--bg-raised)` with `var(--text)` text, border `1px solid var(--border)`. Keep `[CLASSIFIED]` badge.
- On hover: header background brightens slightly to `#1a1a1f`
- Body (expanded): `var(--bg-inset)` background, `var(--text-muted)` monospace text
- Border: `1px solid var(--border)`
- Feels like a redacted terminal readout, not a government paper document

### EvaluationSummary.tsx — Dark Data Table

Current state: Works structurally, just needs color inversion.

Changes:

- Score numbers: `var(--text)` (already Instrument Serif italic — perfect)
- Table headers: `var(--text-muted)`, border-bottom `2px solid var(--border-emphasis)`
- Table cells: border-bottom `1px solid var(--border)`
- Category names: `var(--text)`, font-weight 700
- Rationale text: `var(--text-muted)`
- Evidence quotes: `var(--text-faint)`, border-left `2px solid var(--text-faint)`
- Overall assessment box: `2px solid var(--border-emphasis)`, text in `var(--text)`

### ConversionMeter.tsx — Dark Track with Agent Color Fill

Current state: Black border track, black fill. Needs inversion.

Changes:

- Track border: `2px solid var(--border-emphasis)`
- Track background: `var(--bg-inset)`
- Fill: solid agent color (pass as prop or determine from context) instead of black
- Notch: `var(--text-faint)`
- Labels: `var(--text-faint)`
- Score value: `var(--text)`

### PlaybackControls.tsx — Dark Bottom Bar

Current state: White bg, black top border.

Changes:

- Background: `var(--bg-raised)`
- Top border: `1px solid var(--border-emphasis)`
- Buttons: `border: 1px solid var(--border)`, text `var(--text-muted)`
- Button hover: `background: var(--border-emphasis)`, text `var(--text)`
- Active speed button: `background: var(--text)`, `color: var(--bg)`
- Progress bar track: `rgba(255,255,255,0.08)`, fill: `var(--text-muted)`
- Provider badge: `border: 1px solid var(--border)`, `background: rgba(255,255,255,0.03)`

### TTSSettingsPanel.tsx — Dark Modal

Current state: Semi-transparent white panels with backdrop blur.

Changes:

- Modal overlay: `rgba(0,0,0,0.6)` with `backdrop-filter: blur(8px)` (keep blur here — it's functional for modal focus, not decorative)
- Panel: `var(--bg-raised)`, `border: 1px solid var(--border)`
- Provider cards: `background: rgba(255,255,255,0.03)`, `border: 1px solid var(--border)`
- Inputs/selects: `background: var(--bg-inset)`, `color: var(--text)`, `border: 1px solid var(--border)`
- Active pill: `background: var(--text)`, `color: var(--bg)`
- Close button: `border: 1px solid var(--border)`, `color: var(--text-muted)`

### ProviderConfig.tsx — Dark Form Controls

Changes:

- All form inputs: dark background `var(--bg-inset)`, light text `var(--text)`
- Range input styling: needs custom CSS for dark track/thumb
- Buttons: match PlaybackControls button style

### Toast.tsx — Already Dark

The toast component already uses dark backgrounds per severity level. Minor tweaks:

- Border: `1px solid rgba(255,255,255,0.15)` (reduce from 0.3)
- Ensure it sits above the dark page without looking disconnected

### ErrorBoundary.tsx — Already Dark

Shows red-on-black error screen. No changes needed.

## Files Changed

### Modified (in implementation order)

| #   | File                                           | Change Summary                                                                                                                                    |
| --- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `src/styles/global.css`                        | Complete color inversion: all CSS variables, grain overlay, selection, scrollbar, prose styles. Add glow variables + `@keyframes avatar-breathe`. |
| 2   | `src/components/landing/LandingPage.tsx`       | Add avatar lineup row in hero. Extract unique avatars from transcripts. Dark bg/text colors in styles.                                            |
| 3   | `src/components/landing/TranscriptCard.tsx`    | Dark card colors. Add small avatar thumbnails per agent. Softer hover (border glow, not full inversion).                                          |
| 4   | `src/components/viewer/TranscriptViewer.tsx`   | Face-off avatar layout in header (120px). Dark color updates throughout. Section rules use `--border`.                                            |
| 5   | `src/components/viewer/MessageBubble.tsx`      | Add 40px avatar in entry header. Active state: avatar glow pulse, subtle agent-color background tint, left border. Dark color updates.            |
| 6   | `src/components/viewer/SystemPromptReveal.tsx` | Dark header/body colors. Terminal readout feel.                                                                                                   |
| 7   | `src/components/viewer/EvaluationSummary.tsx`  | Dark table colors, border updates.                                                                                                                |
| 8   | `src/components/viewer/ConversionMeter.tsx`    | Dark track, agent-color fill instead of black.                                                                                                    |
| 9   | `src/components/audio/PlaybackControls.tsx`    | Dark bar, dark buttons, inverted hover states.                                                                                                    |
| 10  | `src/components/settings/TTSSettingsPanel.tsx` | Dark modal overlay, dark panel/card/input colors.                                                                                                 |
| 11  | `src/components/settings/ProviderConfig.tsx`   | Dark form controls to match panel.                                                                                                                |
| 12  | `src/components/shared/Toast.tsx`              | Minor border opacity tweak.                                                                                                                       |

### No Changes Needed

- `src/types/*` — interfaces unchanged
- `src/stores/*` — state management unchanged
- `src/lib/*` — parser, TTS unchanged
- `src/hooks/*` — hooks unchanged
- `scripts/parse-transcripts.ts` — build script unchanged
- `src/data/transcripts.json` — data unchanged
- `index.html` — fonts already correct, no changes
- `vite.config.ts` — build config unchanged
- `package.json` — no new deps (avatars already exist, animations are CSS-only)
- `public/avatars/*` — avatars already generated, already dark-themed
- `src/components/shared/ErrorBoundary.tsx` — already dark

### Deletable (cleanup, not blocking)

- `gsap` dependency in package.json — unused
- `three` dependency in package.json — unused
- `@types/three` dev dependency — unused
- `src/assets/hero.png` — isometric wireframe, doesn't fit the concept
- `src/assets/react.svg`, `src/assets/vite.svg` — scaffolding leftovers

## What Makes This Awwwards-Worthy

1. **The avatars carry the visual weight** — luminous AI faces on pure black. No site does this. The face-off layout in transcript headers is immediately striking.
2. **Typography does the architecture** — giant italic serif turn numbers, tight letter-spacing, dramatic scale contrasts between numbers and metadata. This is the brutalist contribution.
3. **Zero border-radius** — everything is cut sharp. Panels, buttons, avatars, progress bars. Distinctive without needing to explain itself.
4. **Color discipline** — the page is near-monochrome until agent colors appear. Amber and blue emerge from the darkness like stage lighting. Every splash of color is earned.
5. **Purposeful stillness** — the only animation is the active speaker's avatar breathing with a soft glow during playback. In a sea of sites with scroll-triggered everything, deliberate stillness is a statement.
6. **No decoration without function** — no particles, no blobs, no glassmorphism, no gradients. The grain overlay adds analog texture at near-imperceptible levels. Everything you see is content or structure.

## Verification

1. `npm run dev` — landing page shows dark background, avatar lineup hero, dark transcript cards
2. Avatar images render correctly on all cards and in transcript headers
3. Face-off layout looks correct with two large avatars flanking "vs"
4. Transcript entries show small avatar + turn number + attribution
5. Click play — active message gets subtle glow, avatar pulses
6. Classified panels open/close with correct dark theme
7. TTS settings modal renders correctly on dark backdrop
8. All text is legible on dark backgrounds (check contrast ratios)
9. Responsive: test at 768px and 600px breakpoints
10. No GSAP, Three.js, or heavy JS animation libs loaded at runtime

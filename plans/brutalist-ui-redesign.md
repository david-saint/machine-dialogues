# Plan: Brutalist UI Redesign — "Raw Protocol"

## Problem

The current viewer UI is "sci-fi old school boring" — near-black background, Three.js particles, glassmorphism panels, floating gradient blobs, GSAP scroll-triggered animations on every message. It's the quintessential "AI generated dark mode" look. Overdone page load animations compound the issue.

## Direction: Brutalist / Raw

Stripped to the structural bones. Like reading declassified wire intercepts. The content *is* the design. Typography does all the work. Nothing decorative exists without function.

## Design System

### Colors (CSS Variables)

| Token | Value | Usage |
|---|---|---|
| `--bg` | `#f8f6f1` | Page background (warm off-white, uncoated paper) |
| `--ink` | `#111` | Primary text, borders |
| `--ink-muted` | `#666` | Secondary text |
| `--ink-faint` | `#bbb` | Tertiary, disabled |
| `--accent-claude` | `#d43a2c` | Claude agent identity |
| `--accent-gemini` | `#1a56db` | Gemini agent identity |
| `--accent-gpt` | `#b8860b` | GPT agent identity |
| `--surface` | `#fff` | Card backgrounds |
| `--border` | `#111` | Hard structural borders |

### Typography (Google Fonts)

- **Display**: Instrument Serif (italic) — dramatic headings
- **Body**: Syne (400, 700) — geometric grotesque with character
- **Mono**: DM Mono (400) — metadata, model IDs, costs

### Spatial Rules

- `border-radius: 0` everywhere
- `border: 1px solid var(--border)` or `2px` for emphasis
- No shadows, no blur, no gradients (except agent-color fills on hover)
- Generous whitespace (4rem+ section gaps)
- Max-width 1100px container

### Motion Rules

- **Zero** scroll-triggered animations
- **Zero** page-load GSAP timelines
- Hover: hard color invert on cards (background becomes agent color, text inverts to white). 150ms transition.
- Active playback message: thick left border + subtle background tint
- That's it. Brutalism respects stillness.

## Component Design

### LandingPage
- Hero with "Machine Dialogues" in Instrument Serif italic at `clamp(4rem, 10vw, 9rem)`
- Subtitle in Syne at small caps, letter-spaced
- Cards in CSS grid with 1px black borders

### TranscriptCard
- White surface, 1px black border
- Top stripe (4px) in agent-A's color
- Model names in mono, metadata compact
- Hover: entire card fills with agent-A color, all text inverts white

### MessageBubble → Transcript Entry
- Not a bubble. A full-width horizontal block.
- 2px top border in agent color
- Turn number in giant numerals flush-left
- Agent name + model in small mono
- Content below in body font
- No left/right alignment — all sequential, full-width

### SystemPromptReveal
- Header: heavy black bar with white text `[CLASSIFIED] {agentName}`
- Content: monospace on faint grey background
- Feels like a declassified government document

### EvaluationSummary
- Real data table with black borders
- Numbers large and bold
- Evidence quotes in italic below each row

### ConversionMeter
- Raw progress bar: 2px black border track, solid agent-color fill
- Labels in mono, no decoration

### PlaybackControls
- Thin fixed bar at bottom, white bg, 1px top border black
- All controls horizontal in one line
- Square buttons, monospace labels
- Fix: destructure `setSpeed` from store

## Files Changed

### Modified
1. `index.html` — Google Fonts links, title update
2. `global.css` — Complete rewrite
3. `App.tsx` — Remove ParticleField + GradientMesh
4. `LandingPage.tsx` — Brutalist hero + grid, remove GSAP
5. `TranscriptCard.tsx` — Exposed borders, inverted hover, remove GlassPanel
6. `TranscriptViewer.tsx` — Editorial layout, remove GlassPanel
7. `MessageBubble.tsx` — Numbered entries, remove GSAP ScrollTrigger + GlassPanel
8. `SystemPromptReveal.tsx` — Redacted-document style, remove GlassPanel
9. `EvaluationSummary.tsx` — Data table, remove GlassPanel
10. `ConversionMeter.tsx` — Raw bar, remove GlassPanel
11. `PlaybackControls.tsx` — Minimal bar, fix setSpeed bug, remove GlassPanel

### Deleted
- `ParticleField.tsx` (Three.js particles)
- `GradientMesh.tsx` (floating blobs)
- `GlassPanel.tsx` (glassmorphism wrapper)

### Untouched
- `src/types/*` — all interfaces
- `src/stores/playback.ts` — state management
- `src/lib/tts.ts` — TTS engine
- `src/lib/parser.ts` — transcript parser
- `scripts/parse-transcripts.ts` — build script
- `src/data/transcripts.json` — parsed data
- `ErrorBoundary.tsx` — error handling
- `vite.config.ts` — build config
- `package.json` — dependencies (Three.js stays as unused dep, can be cleaned later)

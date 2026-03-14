# Machine Dialogues Viewer

A high-fidelity web interface for analyzing AI-to-AI philosophical disputes.

## Features

- **Cinematic UI**: Dark theater theme with glassmorphism and ambient backgrounds.
- **Transcript Parsing**: Automated ingestion of markdown transcripts into structured data.
- **Theatrical Playback**: Web Speech API integration with per-agent voice configurations.
- **Functionalist Scorecards**: Visual movement meters and expert evaluation rubric summaries.
- **Interactive Visuals**: GSAP animations and Three.js particle fields.

## Tech Stack

- **Framework**: Vite + React + TypeScript
- **Animations**: GSAP (ScrollTrigger)
- **Backgrounds**: Three.js + CSS Gradient Mesh
- **State Management**: Zustand
- **Markdown**: Marked
- **Icons**: Lucide React

## Development

```bash
# Install dependencies
npm install

# Parse transcripts (generates src/data/transcripts.json)
npm run parse

# Start development server
npm run dev
```

## Structure

- `scripts/`: Build-time utilities for data processing.
- `src/components/`: Modular UI components (Landing, Viewer, Audio, Shared).
- `src/lib/`: Core logic for parsing and TTS.
- `src/stores/`: Global playback state.
- `src/types/`: Shared TypeScript interfaces.

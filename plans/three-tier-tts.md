# Plan: Three-Tier TTS System for Machine Dialogues Viewer

## Context
The Machine Dialogues viewer has a basic Web Speech API integration (62 lines in `src/lib/tts.ts`). The user wants a three-tier TTS system: Web Speech API (free baseline) → Kokoro (open-source, self-hosted) → ElevenLabs (premium, best quality). No OpenAI involvement.

## Architecture: Provider Abstraction

A `TTSProvider` interface that all three backends implement, behind a `TTSOrchestrator` facade. PlaybackControls consumes via a `useTTS()` hook and never knows which backend is active.

```
PlaybackControls → useTTS() hook → TTSOrchestrator → active TTSProvider
                                        ↓ on failure
                                   WebSpeechProvider (fallback)
```

## Files to Create

| File | Purpose |
|---|---|
| `src/lib/tts/types.ts` | `TTSProvider` interface, `ProviderVoiceConfig` discriminated union, `TTSEvents`, `WordTimestamp` |
| `src/lib/tts/defaults.ts` | Default voice configs per agent per provider |
| `src/lib/tts/providers/webspeech.ts` | `WebSpeechProvider` wrapping existing `TTSManager` singleton |
| `src/lib/tts/providers/kokoro.ts` | `KokoroProvider` — fetch to local server, HTMLAudioElement playback |
| `src/lib/tts/providers/elevenlabs.ts` | `ElevenLabsProvider` — REST API, word timestamps, voice browser |
| `src/lib/tts/cache.ts` | `AudioCache` — IndexedDB for caching generated audio blobs (LRU eviction) |
| `src/lib/tts/index.ts` | `TTSOrchestrator` — provider registry, fallback logic, cache coordination |
| `src/stores/ttsSettings.ts` | Zustand + `persist` — selected provider, API keys, voice prefs in localStorage |
| `src/stores/toast.ts` | Simple toast notification state |
| `src/hooks/useTTS.ts` | React hook bridging TTSOrchestrator to component layer |
| `src/components/settings/TTSSettingsPanel.tsx` | Modal for provider selection + config |
| `src/components/settings/ProviderConfig.tsx` | Per-provider config forms |
| `src/components/shared/Toast.tsx` | Self-dismissing notification component |

## Files to Modify

| File | Changes |
|---|---|
| `src/lib/tts.ts` | Add optional `onBoundary` callback param to `speak()` (1 additive line) |
| `src/stores/playback.ts` | Add `isLoading`, `highlightPosition` fields + setters |
| `src/components/audio/PlaybackControls.tsx` | Switch to `useTTS()` hook, add gear icon, loading state, provider badge |
| `src/components/viewer/MessageBubble.tsx` | Consume `highlightPosition` for word highlighting during playback |

## Provider Details

### Web Speech API (existing, wrap only)
- `WebSpeechProvider` delegates to existing `TTSManager` singleton
- Voice config: `{ pitch, rate, voiceName }` — Claude: Daniel/0.9/0.85, Gemini: Samantha/1.1/0.95
- Supports `onboundary` events for sentence-level highlighting
- No caching needed (local, instant, free)

### Kokoro (self-hosted)
- User runs Kokoro server locally (Python FastAPI, typically port 8880)
- API: `POST /v1/audio/speech` with `{ model, input, voice, response_format }`
- Returns audio binary (MP3/WAV) → play via `HTMLAudioElement`
- Default voices: Claude → `am_adam`, Gemini → `af_heart`
- Availability check: `GET /v1/models` with 3s timeout
- Cache audio in IndexedDB keyed by `kokoro:{voiceId}:{SHA256(text)}`

### ElevenLabs (premium)
- API: `POST /v1/text-to-speech/{voice_id}` with `{ text, model_id, voice_settings }`
- With-timestamps endpoint for word-level highlighting
- Voice settings: `{ stability, similarity_boost, style, use_speaker_boost }`
- Voice browser: `GET /v1/voices` to populate settings dropdown
- Cache audio in IndexedDB keyed by `elevenlabs:{voiceId}:{SHA256(text)}`

## Caching Strategy
- **IndexedDB** (not localStorage) — handles binary blobs natively, ~50% of disk quota
- Cache at speed=1 always, apply speed via `HTMLAudioElement.playbackRate` — maximizes cache hits
- Cache key: `{provider}:{voiceId}:{SHA256(text)}`
- LRU eviction at 100MB
- Web Speech is never cached
- "Clear Cache" button in settings panel shows current cache size

## Fallback Logic
If Kokoro/ElevenLabs fails (unreachable, invalid key, rate limit, playback error):
1. Log warning
2. Show toast: "{provider} unavailable, using Web Speech API"
3. Speak with WebSpeechProvider for that turn
4. Don't permanently switch — retry the selected provider on next turn

## Settings Panel
Gear icon in PlaybackControls opens a glassmorphism modal:
- Three-way provider selector (pill buttons)
- **Web Speech**: pitch/rate sliders per agent
- **Kokoro**: server URL input, voice dropdowns, "Test Connection" button
- **ElevenLabs**: API key input (stored in localStorage), voice browser dropdown (populated after key validation), "Validate Key" button
- "Clear Audio Cache" with size display
- All settings persisted via Zustand `persist` middleware

## Playback Store Additions
```typescript
// Added to existing PlaybackState
isLoading: boolean;
highlightPosition: { charIndex: number; charLength: number } | null;
setLoading: (loading: boolean) => void;
setHighlightPosition: (pos: { charIndex: number; charLength: number } | null) => void;
```

## Implementation Sequence

### Phase 1 — Foundation (no behavior change)
1. Create `src/lib/tts/types.ts` — all interfaces
2. Create `src/lib/tts/defaults.ts` — voice config defaults
3. Create `src/lib/tts/providers/webspeech.ts` — wrap existing TTSManager
4. Add `onBoundary` param to `src/lib/tts.ts` (1 line)
5. Create `src/lib/tts/index.ts` — TTSOrchestrator with webspeech only
6. Create `src/stores/ttsSettings.ts` — persisted settings store
7. Create `src/hooks/useTTS.ts` — React bridge hook
8. Update `src/stores/playback.ts` — add `isLoading`, `highlightPosition`
9. Update `PlaybackControls.tsx` — switch to `useTTS()` hook
10. **Verify**: Web Speech still works identically

### Phase 2 — Infrastructure
11. Create `src/lib/tts/cache.ts` — IndexedDB AudioCache
12. Create `src/components/shared/Toast.tsx` + `src/stores/toast.ts`

### Phase 3 — Kokoro
13. Create `src/lib/tts/providers/kokoro.ts`
14. Register in TTSOrchestrator, wire fallback logic
15. **Verify**: select Kokoro in settings, plays audio from local server, falls back gracefully

### Phase 4 — ElevenLabs
16. Create `src/lib/tts/providers/elevenlabs.ts`
17. Register in TTSOrchestrator
18. **Verify**: key validation, voice fetching, audio generation, timestamp highlighting, caching

### Phase 5 — Settings UI
19. Create `src/components/settings/TTSSettingsPanel.tsx` + `ProviderConfig.tsx`
20. Add gear icon + loading spinner + provider badge to PlaybackControls

### Phase 6 — Polish
21. Word highlighting in MessageBubble via `highlightPosition`
22. Cache management UI (size display, clear button)
23. Live speed changes via `HTMLAudioElement.playbackRate`

## Critical Files to Reference
- `viewer/src/lib/tts.ts` — existing 62-line TTSManager to wrap (not rewrite)
- `viewer/src/stores/playback.ts` — existing Zustand store to extend
- `viewer/src/components/audio/PlaybackControls.tsx` — primary consumer, minimal changes
- `viewer/src/components/viewer/MessageBubble.tsx` — for word highlight integration
- `viewer/src/components/shared/GlassPanel.tsx` — reuse for settings panel

## Verification
1. Web Speech still works after refactor (Phase 1 checkpoint)
2. Kokoro: start local server → select in settings → plays audio → cache hit on replay → server down → falls back to Web Speech with toast
3. ElevenLabs: enter API key → voices populate → plays audio with timestamps → word highlighting works → cache hit on replay → invalid key → falls back with toast
4. Settings persist across page reloads (localStorage)
5. Cache: inspect IndexedDB in devtools, verify blob storage, clear cache button works
6. Speed changes apply live during API-provider playback

import { AudioCache, buildAudioCacheKey } from '../cache';
import { GEMINI_VOICES } from '../defaults';
import { chunkSpeakableText, toSpeakableText } from '../speakable';
import type {
  GeminiVoiceConfig,
  SpeakerContext,
  TTSEvents,
  TTSProvider,
  TTSProviderVoice,
  TTSRequest,
} from '../types';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

// How far synthesis runs ahead of playback within a turn, and how many chunks
// of the *next* turn prefetch() warms while the current turn is playing.
const PIPELINE_AHEAD = 2;
const PREFETCH_NEXT_TURN_CHUNKS = 2;

type GeminiGenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        inlineData?: {
          mimeType?: string;
          data?: string;
        };
      }>;
    };
  }>;
  error?: { message?: string };
};

export class GeminiProvider implements TTSProvider {
  readonly id = 'gemini' as const;

  private readonly cache: AudioCache;
  // One reused element: Safari is likelier to allow chained chunk playback on
  // an element that already played from a user gesture.
  private audio: HTMLAudioElement | null = null;
  private objectUrl: string | null = null;
  // Bumped by every speak()/stop() so in-flight synthesis loops from a
  // superseded utterance notice they are stale and bail before playing.
  private generation = 0;
  private playbackRate = 1;
  private paused = false;
  private resumeGate: (() => void) | null = null;
  private settlePlayback: (() => void) | null = null;
  // Dedupes concurrent synthesis of the same chunk (playback pipeline vs
  // next-turn prefetch racing on the same prompt).
  private readonly inflight = new Map<string, Promise<Blob>>();

  constructor(cache: AudioCache) {
    this.cache = cache;
  }

  async speak(request: TTSRequest, events: TTSEvents = {}): Promise<void> {
    if (request.config.provider !== 'gemini') {
      throw new Error('GeminiProvider received non-gemini config');
    }
    const config: GeminiVoiceConfig = request.config;
    const apiKey = request.apiKey;
    if (!apiKey) {
      throw new Error('Gemini API key is required');
    }

    const generation = ++this.generation;
    this.paused = false;
    this.releaseResumeGate();
    this.haltAudio();
    this.playbackRate = request.speed;

    const prompts = buildChunkPrompts(request.text, config, request.context);
    if (prompts.length === 0) {
      events.onStart?.();
      events.onEnd?.();
      return;
    }

    // Synthesis runs PIPELINE_AHEAD chunks ahead of playback so chunk
    // boundaries stay gapless.
    const pending = new Map<number, Promise<Blob>>();
    const queueSynthesis = (index: number) => {
      if (index < prompts.length && !pending.has(index)) {
        const promise = this.fetchChunkAudio(prompts[index], config, apiKey);
        promise.catch(() => {}); // silence unhandled rejection if we bail before awaiting
        pending.set(index, promise);
      }
    };

    try {
      for (let index = 0; index < prompts.length; index += 1) {
        for (let ahead = 0; ahead <= PIPELINE_AHEAD; ahead += 1) {
          queueSynthesis(index + ahead);
        }
        events.onLoadingChange?.(true);
        const blob = await pending.get(index)!;
        if (generation !== this.generation) return;
        events.onLoadingChange?.(false);

        await this.waitWhilePaused();
        if (generation !== this.generation) return;

        if (index === 0) {
          events.onStart?.();
        }
        await this.playBlob(blob, events);
        if (generation !== this.generation) return;
      }
      events.onEnd?.();
    } finally {
      events.onLoadingChange?.(false);
    }
  }

  // Warm the audio cache for an upcoming request without touching playback
  // state. There is no explicit queue to invalidate: cache keys embed the
  // model, voice, and full prompt (style instruction included), so changed
  // settings simply produce different keys and stale entries are never played.
  async prefetch(request: TTSRequest): Promise<void> {
    if (request.config.provider !== 'gemini') {
      return;
    }
    const config: GeminiVoiceConfig = request.config;
    const apiKey = request.apiKey;
    if (!apiKey) {
      return;
    }

    const prompts = buildChunkPrompts(request.text, config, request.context).slice(0, PREFETCH_NEXT_TURN_CHUNKS);
    await Promise.all(
      prompts.map((prompt) => this.fetchChunkAudio(prompt, config, apiKey).catch(() => {})),
    );
  }

  private async fetchChunkAudio(prompt: string, config: GeminiVoiceConfig, apiKey: string): Promise<Blob> {
    const cacheKey = await buildAudioCacheKey(this.id, `${config.model}:${config.voiceName}`, prompt);
    const inflight = this.inflight.get(cacheKey);
    if (inflight) {
      return inflight;
    }
    const promise = this.fetchChunkAudioUncached(cacheKey, prompt, config, apiKey).finally(() => {
      this.inflight.delete(cacheKey);
    });
    this.inflight.set(cacheKey, promise);
    return promise;
  }

  private async fetchChunkAudioUncached(
    cacheKey: string,
    prompt: string,
    config: GeminiVoiceConfig,
    apiKey: string,
  ): Promise<Blob> {
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const response = await fetch(
      `${GEMINI_API_BASE}/models/${config.model}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: config.voiceName },
              },
            },
          },
        }),
      },
    );

    const payload = (await response.json().catch(() => null)) as GeminiGenerateContentResponse | null;

    if (!response.ok) {
      const detail = payload?.error?.message ?? `status ${response.status}`;
      throw new Error(`Gemini TTS request failed (${detail})`);
    }

    const inlineData = payload?.candidates?.[0]?.content?.parts?.find((part) => part.inlineData?.data)?.inlineData;
    if (!inlineData?.data) {
      throw new Error('Gemini TTS response contained no audio');
    }

    const blob = pcmBase64ToWavBlob(inlineData.data, parseSampleRate(inlineData.mimeType));
    await this.cache.set(cacheKey, blob);
    return blob;
  }

  async checkAvailability(opts?: { apiKey?: string }): Promise<boolean> {
    if (!opts?.apiKey) {
      return false;
    }

    try {
      const response = await fetch(`${GEMINI_API_BASE}/models?pageSize=1`, {
        headers: { 'x-goog-api-key': opts.apiKey },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async getVoices(): Promise<TTSProviderVoice[]> {
    return GEMINI_VOICES;
  }

  stop(): void {
    this.generation += 1;
    this.paused = false;
    this.releaseResumeGate();
    this.haltAudio();
  }

  pause(): void {
    this.paused = true;
    this.audio?.pause();
  }

  resume(): void {
    this.paused = false;
    this.releaseResumeGate();
    if (this.audio && this.objectUrl && !this.audio.ended) {
      void this.audio.play();
    }
  }

  setPlaybackRate(rate: number): void {
    this.playbackRate = rate;
    if (this.audio) {
      this.audio.playbackRate = rate;
    }
  }

  private async waitWhilePaused(): Promise<void> {
    while (this.paused) {
      await new Promise<void>((resolve) => {
        this.resumeGate = resolve;
      });
    }
  }

  private releaseResumeGate(): void {
    const release = this.resumeGate;
    this.resumeGate = null;
    release?.();
  }

  private haltAudio(): void {
    this.audio?.pause();
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
    // Settle any pending playback promise (without onEnd) so callers awaiting
    // a stopped utterance are not left hanging forever.
    const settle = this.settlePlayback;
    this.settlePlayback = null;
    settle?.();
  }

  private playBlob(blob: Blob, events: TTSEvents): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.haltAudio();
      const audio = this.audio ?? new Audio();
      this.audio = audio;

      this.settlePlayback = resolve;
      audio.onended = () => {
        this.settlePlayback = null;
        resolve();
      };
      audio.onerror = () => {
        this.settlePlayback = null;
        const error = new Error('Gemini audio playback failed');
        events.onError?.(error);
        reject(error);
      };

      this.objectUrl = URL.createObjectURL(blob);
      audio.src = this.objectUrl;
      audio.playbackRate = this.playbackRate;

      void audio.play().catch((error) => {
        this.settlePlayback = null;
        const e = error instanceof Error ? error : new Error('Gemini audio playback failed');
        events.onError?.(e);
        reject(e);
      });
    });
  }
}

const buildChunkPrompts = (
  rawText: string,
  config: GeminiVoiceConfig,
  context?: SpeakerContext,
): string[] => {
  const text = toSpeakableText(rawText);
  if (!text) {
    return [];
  }
  return chunkSpeakableText(text).map((chunk, index) =>
    buildDebatePrompt(config.styleInstruction, chunk, context, index > 0),
  );
};

// Vague prompts can make the model read the style direction aloud; the docs'
// mitigation is a synthesis preamble plus an explicit label marking where the
// spoken transcript begins.
export const buildDebatePrompt = (
  styleInstruction: string,
  text: string,
  context?: SpeakerContext,
  isContinuation = false,
): string => {
  const instruction = styleInstruction
    .replaceAll('{speaker}', context?.speakerName ?? 'a debater')
    .replaceAll('{opponent}', context?.opponentName ?? 'your opponent')
    .trim()
    .replace(/[:\s]+$/, '');

  if (!instruction) {
    return text;
  }
  const continuation = isContinuation
    ? ' You are already mid-speech: this passage continues the same turn, so keep exactly the same voice, volume, energy, and pacing as the passage before it, and do not add any introduction or greeting.'
    : '';
  return [
    "Synthesize speech for one debater's turn in a live debate. Read aloud ONLY the text under TRANSCRIPT.",
    '',
    "### DIRECTOR'S NOTES",
    `${instruction}.${continuation}`,
    '',
    '#### TRANSCRIPT',
    text,
  ].join('\n');
};

// Gemini TTS returns mimeType like "audio/L16;codec=pcm;rate=24000".
const parseSampleRate = (mimeType?: string): number => {
  const match = mimeType?.match(/rate=(\d+)/);
  return match ? Number(match[1]) : 24000;
};

// The API returns headerless 16-bit mono PCM; HTMLAudioElement needs a RIFF/WAV wrapper.
const pcmBase64ToWavBlob = (base64: string, sampleRate: number): Blob => {
  const bytes = atob(base64);
  const pcm = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i += 1) {
    pcm[i] = bytes.charCodeAt(i);
  }

  const numChannels = 1;
  const bytesPerSample = 2;
  const byteRate = sampleRate * numChannels * bytesPerSample;
  const header = new ArrayBuffer(44);
  const view = new DataView(header);

  const writeAscii = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };

  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + pcm.length, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, numChannels * bytesPerSample, true);
  view.setUint16(34, bytesPerSample * 8, true);
  writeAscii(36, 'data');
  view.setUint32(40, pcm.length, true);

  return new Blob([header, pcm], { type: 'audio/wav' });
};

import { AudioCache, buildAudioCacheKey } from '../cache';
import { GEMINI_VOICES } from '../defaults';
import type {
  GeminiVoiceConfig,
  SpeakerContext,
  TTSEvents,
  TTSProvider,
  TTSProviderVoice,
  TTSRequest,
} from '../types';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

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
  private currentAudio: HTMLAudioElement | null = null;
  private currentObjectUrl: string | null = null;

  constructor(cache: AudioCache) {
    this.cache = cache;
  }

  async speak(request: TTSRequest, events: TTSEvents = {}): Promise<void> {
    if (request.config.provider !== 'gemini') {
      throw new Error('GeminiProvider received non-gemini config');
    }
    const config: GeminiVoiceConfig = request.config;
    if (!request.apiKey) {
      throw new Error('Gemini API key is required');
    }

    events.onLoadingChange?.(true);

    const prompt = buildDebatePrompt(config.styleInstruction, request.text, request.context);
    const cacheKey = await buildAudioCacheKey(this.id, `${config.model}:${config.voiceName}`, prompt);
    let blob = await this.cache.get(cacheKey);

    if (!blob) {
      const response = await fetch(
        `${GEMINI_API_BASE}/models/${config.model}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': request.apiKey,
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

      blob = pcmBase64ToWavBlob(inlineData.data, parseSampleRate(inlineData.mimeType));
      await this.cache.set(cacheKey, blob);
    }

    events.onLoadingChange?.(false);
    await this.playBlob(blob, request.speed, events);
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
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    if (this.currentObjectUrl) {
      URL.revokeObjectURL(this.currentObjectUrl);
      this.currentObjectUrl = null;
    }
  }

  pause(): void {
    this.currentAudio?.pause();
  }

  resume(): void {
    if (this.currentAudio) {
      void this.currentAudio.play();
    }
  }

  setPlaybackRate(rate: number): void {
    if (this.currentAudio) {
      this.currentAudio.playbackRate = rate;
    }
  }

  private async playBlob(blob: Blob, playbackRate: number, events: TTSEvents = {}): Promise<void> {
    this.stop();
    this.currentObjectUrl = URL.createObjectURL(blob);
    const audio = new Audio(this.currentObjectUrl);
    audio.playbackRate = playbackRate;
    this.currentAudio = audio;

    events.onStart?.();

    await new Promise<void>((resolve, reject) => {
      audio.onended = () => {
        events.onEnd?.();
        resolve();
      };
      audio.onerror = () => {
        const error = new Error('Gemini audio playback failed');
        events.onError?.(error);
        reject(error);
      };

      void audio.play().catch((error) => {
        const e = error instanceof Error ? error : new Error('Gemini audio playback failed');
        events.onError?.(e);
        reject(e);
      });
    });
  }
}

// Vague prompts can make the model read the style direction aloud; the docs'
// mitigation is a synthesis preamble plus an explicit label marking where the
// spoken transcript begins.
export const buildDebatePrompt = (
  styleInstruction: string,
  text: string,
  context?: SpeakerContext,
): string => {
  const instruction = styleInstruction
    .replaceAll('{speaker}', context?.speakerName ?? 'a debater')
    .replaceAll('{opponent}', context?.opponentName ?? 'your opponent')
    .trim()
    .replace(/[:\s]+$/, '');

  if (!instruction) {
    return text;
  }
  return [
    "Synthesize speech for one debater's turn in a live debate. Read aloud ONLY the text under TRANSCRIPT.",
    '',
    "### DIRECTOR'S NOTES",
    `${instruction}.`,
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

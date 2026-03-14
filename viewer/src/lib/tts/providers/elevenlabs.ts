import { AudioCache, buildAudioCacheKey } from '../cache';
import type {
  ElevenLabsVoiceConfig,
  TTSEvents,
  TTSProvider,
  TTSProviderVoice,
  TTSRequest,
  WordTimestamp,
} from '../types';

type ElevenLabsTimestampResponse = {
  audio_base64: string;
  alignment?: {
    characters: string[];
    character_start_times_seconds: number[];
    character_end_times_seconds: number[];
  };
};

type ElevenLabsVoicesResponse = {
  voices?: Array<{ voice_id: string; name: string }>;
};

export class ElevenLabsProvider implements TTSProvider {
  readonly id = 'elevenlabs' as const;

  private readonly cache: AudioCache;
  private currentAudio: HTMLAudioElement | null = null;
  private currentObjectUrl: string | null = null;

  constructor(cache: AudioCache) {
    this.cache = cache;
  }

  async speak(request: TTSRequest, events: TTSEvents = {}): Promise<void> {
    if (request.config.provider !== 'elevenlabs') {
      throw new Error('ElevenLabsProvider received non-elevenlabs config');
    }
    const config: ElevenLabsVoiceConfig = request.config;
    if (!request.apiKey) {
      throw new Error('ElevenLabs API key is required');
    }

    events.onLoadingChange?.(true);

    const cacheKey = await buildAudioCacheKey(this.id, config.voiceId, request.text);
    let blob = await this.cache.get(cacheKey);
    let timestamps: WordTimestamp[] = [];

    if (!blob) {
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${config.voiceId}/with-timestamps`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'xi-api-key': request.apiKey,
          },
          body: JSON.stringify({
            text: request.text,
            model_id: config.modelId,
            voice_settings: config.voiceSettings,
            output_format: 'mp3_44100_128',
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`ElevenLabs request failed (${response.status})`);
      }

      const payload = (await response.json()) as ElevenLabsTimestampResponse;
      blob = this.base64ToBlob(payload.audio_base64, 'audio/mpeg');
      timestamps = this.buildWordTimestamps(payload.alignment, request.text);
      await this.cache.set(cacheKey, blob);
    }

    events.onLoadingChange?.(false);
    await this.playBlob(blob, request.speed, events, timestamps);
  }

  async checkAvailability(opts?: { apiKey?: string }): Promise<boolean> {
    if (!opts?.apiKey) {
      return false;
    }

    try {
      const response = await fetch('https://api.elevenlabs.io/v1/voices', {
        headers: {
          'xi-api-key': opts.apiKey,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async getVoices(opts?: { apiKey?: string }): Promise<TTSProviderVoice[]> {
    if (!opts?.apiKey) {
      return [];
    }

    const response = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: {
        'xi-api-key': opts.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ElevenLabs voices (${response.status})`);
    }

    const payload = (await response.json()) as ElevenLabsVoicesResponse;
    return (payload.voices ?? []).map((voice) => ({ id: voice.voice_id, name: voice.name }));
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

  private async playBlob(blob: Blob, playbackRate: number, events: TTSEvents = {}, timestamps: WordTimestamp[] = []): Promise<void> {
    this.stop();
    this.currentObjectUrl = URL.createObjectURL(blob);
    const audio = new Audio(this.currentObjectUrl);
    audio.playbackRate = playbackRate;
    this.currentAudio = audio;

    if (timestamps.length > 0) {
      audio.ontimeupdate = () => {
        const current = audio.currentTime;
        const active = timestamps.find((word) => current >= word.start && current <= word.end);
        if (active) {
          events?.onWordBoundary?.(active);
          events?.onBoundary?.({ charIndex: active.charIndex, charLength: active.charLength });
        }
      };
    }

    events?.onStart?.();

    await new Promise<void>((resolve, reject) => {
      audio.onended = () => {
        events?.onEnd?.();
        resolve();
      };
      audio.onerror = () => {
        const error = new Error('ElevenLabs audio playback failed');
        events?.onError?.(error);
        reject(error);
      };

      void audio.play().catch((error) => {
        const e = error instanceof Error ? error : new Error('ElevenLabs audio playback failed');
        events?.onError?.(e);
        reject(e);
      });
    });
  }

  private base64ToBlob(base64: string, mimeType: string): Blob {
    const bytes = atob(base64);
    const array = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i += 1) {
      array[i] = bytes.charCodeAt(i);
    }
    return new Blob([array], { type: mimeType });
  }

  private buildWordTimestamps(
    alignment: ElevenLabsTimestampResponse['alignment'],
    text: string,
  ): WordTimestamp[] {
    if (!alignment) {
      return [];
    }

    const result: WordTimestamp[] = [];
    let wordStartIndex = -1;
    let currentWord = '';

    for (let i = 0; i < alignment.characters.length; i += 1) {
      const ch = alignment.characters[i] ?? text[i] ?? '';
      const isWhitespace = /\s/.test(ch);

      if (!isWhitespace && wordStartIndex === -1) {
        wordStartIndex = i;
        currentWord = ch;
      } else if (!isWhitespace) {
        currentWord += ch;
      }

      const nextChar = alignment.characters[i + 1] ?? text[i + 1] ?? ' ';
      const nextIsWhitespace = /\s/.test(nextChar);
      if (!isWhitespace && nextIsWhitespace && wordStartIndex !== -1) {
        result.push({
          word: currentWord,
          start: alignment.character_start_times_seconds[wordStartIndex] ?? 0,
          end: alignment.character_end_times_seconds[i] ?? 0,
          charIndex: wordStartIndex,
          charLength: i - wordStartIndex + 1,
        });
        wordStartIndex = -1;
        currentWord = '';
      }
    }

    return result;
  }
}

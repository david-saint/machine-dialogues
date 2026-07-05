import { AudioCache, buildAudioCacheKey } from '../cache';
import type { KokoroVoiceConfig, TTSEvents, TTSProvider, TTSRequest } from '../types';

export class KokoroProvider implements TTSProvider {
  readonly id = 'kokoro' as const;

  private readonly cache: AudioCache;
  private currentAudio: HTMLAudioElement | null = null;
  private currentObjectUrl: string | null = null;
  // Bumped by every speak()/stop() so a stale in-flight fetch doesn't start
  // playing after the user stopped or skipped to another turn.
  private generation = 0;
  private settlePlayback: (() => void) | null = null;

  constructor(cache: AudioCache) {
    this.cache = cache;
  }

  async speak(request: TTSRequest, events: TTSEvents = {}): Promise<void> {
    if (request.config.provider !== 'kokoro') {
      throw new Error('KokoroProvider received non-kokoro config');
    }
    const config: KokoroVoiceConfig = request.config;
    if (!request.serverUrl) {
      throw new Error('Kokoro server URL is required');
    }

    const generation = ++this.generation;
    events.onLoadingChange?.(true);

    try {
      const cacheKey = await buildAudioCacheKey(this.id, config.voiceId, request.text);
      let blob = await this.cache.get(cacheKey);

      if (!blob) {
        const response = await fetch(`${request.serverUrl.replace(/\/$/, '')}/v1/audio/speech`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: config.model,
            input: request.text,
            voice: config.voiceId,
            response_format: config.responseFormat,
          }),
        });

        if (!response.ok) {
          throw new Error(`Kokoro request failed (${response.status})`);
        }

        blob = await response.blob();
        await this.cache.set(cacheKey, blob);
      }

      if (generation !== this.generation) {
        return;
      }
      events.onLoadingChange?.(false);
      await this.playBlob(blob, request.speed, events);
    } finally {
      events.onLoadingChange?.(false);
    }
  }

  async checkAvailability(opts?: { serverUrl?: string }): Promise<boolean> {
    const serverUrl = opts?.serverUrl;
    if (!serverUrl) {
      return false;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 3000);
    try {
      const response = await fetch(`${serverUrl.replace(/\/$/, '')}/v1/models`, {
        method: 'GET',
        signal: controller.signal,
      });
      return response.ok;
    } catch {
      return false;
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  stop(): void {
    this.generation += 1;
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    if (this.currentObjectUrl) {
      URL.revokeObjectURL(this.currentObjectUrl);
      this.currentObjectUrl = null;
    }
    // Settle any pending playback promise (without onEnd) so callers awaiting
    // a stopped utterance are not left hanging forever.
    const settle = this.settlePlayback;
    this.settlePlayback = null;
    settle?.();
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
      this.settlePlayback = resolve;
      audio.onended = () => {
        this.settlePlayback = null;
        events.onEnd?.();
        resolve();
      };
      audio.onerror = () => {
        this.settlePlayback = null;
        const error = new Error('Kokoro audio playback failed');
        events.onError?.(error);
        reject(error);
      };

      void audio.play().catch((error) => {
        this.settlePlayback = null;
        const e = error instanceof Error ? error : new Error('Kokoro audio playback failed');
        events.onError?.(e);
        reject(e);
      });
    });
  }
}

import { tts } from '../../tts';
import type { TTSEvents, TTSProvider, TTSRequest, WebSpeechVoiceConfig } from '../types';

export class WebSpeechProvider implements TTSProvider {
  readonly id = 'webspeech' as const;

  async speak(request: TTSRequest, events: TTSEvents = {}): Promise<void> {
    if (request.config.provider !== 'webspeech') {
      throw new Error('WebSpeechProvider received non-webspeech config');
    }
    const config: WebSpeechVoiceConfig = request.config;

    events.onLoadingChange?.(false);
    events.onStart?.();

    await new Promise<void>((resolve, reject) => {
      try {
        tts.speak(
          request.text,
          {
            pitch: config.pitch,
            rate: config.rate * request.speed,
            voiceName: config.voiceName,
          },
          () => {
            events.onEnd?.();
            resolve();
          },
          (event) => {
            const charIndex = event.charIndex ?? 0;
            const charLength = event.charLength ?? 1;
            events.onBoundary?.({ charIndex, charLength });
          },
        );
      } catch (error) {
        const e = error instanceof Error ? error : new Error('Web Speech failed');
        events.onError?.(e);
        reject(e);
      }
    });
  }

  stop(): void {
    tts.stop();
  }

  pause(): void {
    tts.pause();
  }

  resume(): void {
    tts.resume();
  }
}

export const webSpeechProvider = new WebSpeechProvider();

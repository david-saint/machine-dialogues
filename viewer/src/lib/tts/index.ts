import {
  DEFAULT_ELEVENLABS_CONFIG,
  DEFAULT_KOKORO_CONFIG,
  DEFAULT_WEBSPEECH_CONFIG,
  getProviderVoiceConfig,
} from './defaults';
import { AudioCache } from './cache';
import { ElevenLabsProvider } from './providers/elevenlabs';
import { KokoroProvider } from './providers/kokoro';
import { webSpeechProvider } from './providers/webspeech';
import type {
  AgentKey,
  ElevenLabsVoiceConfig,
  KokoroVoiceConfig,
  TTSEvents,
  TTSProvider,
  TTSProviderId,
  TTSProviderVoice,
  WebSpeechVoiceConfig,
} from './types';

export type TTSOrchestratorSettings = {
  provider: TTSProviderId;
  webspeech: Record<AgentKey, WebSpeechVoiceConfig>;
  kokoro: Record<AgentKey, KokoroVoiceConfig>;
  elevenlabs: Record<AgentKey, ElevenLabsVoiceConfig>;
  kokoroServerUrl: string;
  elevenLabsApiKey: string;
};

type TTSOrchestratorEvents = TTSEvents & {
  onFallback?: (provider: TTSProviderId, error: Error) => void;
};

type SpeakArgs = {
  text: string;
  speed: number;
  agent: AgentKey;
  settings: TTSOrchestratorSettings;
};

export class TTSOrchestrator {
  private readonly providers: Map<TTSProviderId, TTSProvider>;
  private activeProvider: TTSProvider;
  private readonly cache: AudioCache;

  constructor() {
    this.cache = new AudioCache();
    this.providers = new Map<TTSProviderId, TTSProvider>([
      ['webspeech', webSpeechProvider],
      ['kokoro', new KokoroProvider(this.cache)],
      ['elevenlabs', new ElevenLabsProvider(this.cache)],
    ]);
    this.activeProvider = webSpeechProvider;
  }

  async speak(args: SpeakArgs, events: TTSOrchestratorEvents = {}): Promise<void> {
    const selectedProvider = this.providers.get(args.settings.provider) ?? webSpeechProvider;
    const config = getProviderVoiceConfig(args.settings.provider, args.agent, {
      webspeech: args.settings.webspeech,
      kokoro: args.settings.kokoro,
      elevenlabs: args.settings.elevenlabs,
    });

    const runProvider = async (provider: TTSProvider, providerId: TTSProviderId) => {
      this.activeProvider = provider;
      await provider.speak(
        {
          text: args.text,
          speed: args.speed,
          agent: args.agent,
          config: providerId === args.settings.provider
            ? config
            : getProviderVoiceConfig(providerId, args.agent, {
                webspeech: args.settings.webspeech,
                kokoro: args.settings.kokoro,
                elevenlabs: args.settings.elevenlabs,
              }),
          apiKey: args.settings.elevenLabsApiKey,
          serverUrl: args.settings.kokoroServerUrl,
        },
        events,
      );
    };

    if (selectedProvider.id === 'webspeech') {
      await runProvider(selectedProvider, 'webspeech');
      return;
    }

    try {
      await runProvider(selectedProvider, selectedProvider.id);
    } catch (error) {
      const err = error instanceof Error ? error : new Error('TTS provider failed');
      console.warn(`[tts] ${selectedProvider.id} unavailable, falling back to webspeech`, err);
      events.onFallback?.(selectedProvider.id, err);
      await runProvider(webSpeechProvider, 'webspeech');
    }
  }

  stop(): void {
    this.activeProvider.stop();
    webSpeechProvider.stop();
  }

  pause(): void {
    this.activeProvider.pause();
  }

  resume(): void {
    this.activeProvider.resume();
  }

  setPlaybackRate(rate: number): void {
    if (this.activeProvider.setPlaybackRate) {
      this.activeProvider.setPlaybackRate(rate);
    }
  }

  async checkKokoroConnection(serverUrl: string): Promise<boolean> {
    const provider = this.providers.get('kokoro');
    if (!provider?.checkAvailability) {
      return false;
    }
    return provider.checkAvailability({ serverUrl });
  }

  async validateElevenLabsKey(apiKey: string): Promise<boolean> {
    const provider = this.providers.get('elevenlabs');
    if (!provider?.checkAvailability) {
      return false;
    }
    return provider.checkAvailability({ apiKey });
  }

  async getElevenLabsVoices(apiKey: string): Promise<TTSProviderVoice[]> {
    const provider = this.providers.get('elevenlabs');
    if (!provider?.getVoices) {
      return [];
    }
    return provider.getVoices({ apiKey });
  }

  async clearCache(): Promise<void> {
    await this.cache.clear();
  }

  async getCacheSizeBytes(): Promise<number> {
    return this.cache.getSizeBytes();
  }
}

export const ttsOrchestrator = new TTSOrchestrator();

export const getDefaultTTSSettings = (): TTSOrchestratorSettings => ({
  provider: 'webspeech',
  webspeech: DEFAULT_WEBSPEECH_CONFIG,
  kokoro: DEFAULT_KOKORO_CONFIG,
  elevenlabs: DEFAULT_ELEVENLABS_CONFIG,
  kokoroServerUrl: 'http://localhost:8880',
  elevenLabsApiKey: '',
});

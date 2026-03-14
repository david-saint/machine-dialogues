import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  DEFAULT_ELEVENLABS_CONFIG,
  DEFAULT_KOKORO_CONFIG,
  DEFAULT_KOKORO_SERVER_URL,
  DEFAULT_PROVIDER,
  DEFAULT_WEBSPEECH_CONFIG,
} from '../lib/tts/defaults';
import type {
  AgentKey,
  ElevenLabsVoiceConfig,
  ElevenLabsVoiceSettings,
  KokoroVoiceConfig,
  TTSProviderId,
  WebSpeechVoiceConfig,
} from '../lib/tts/types';

type ElevenLabsUpdate = Partial<Omit<ElevenLabsVoiceConfig, 'provider' | 'voiceSettings'>> & {
  voiceSettings?: Partial<ElevenLabsVoiceSettings>;
};

interface TTSSettingsState {
  provider: TTSProviderId;
  webspeech: Record<AgentKey, WebSpeechVoiceConfig>;
  kokoro: Record<AgentKey, KokoroVoiceConfig>;
  elevenlabs: Record<AgentKey, ElevenLabsVoiceConfig>;
  kokoroServerUrl: string;
  elevenLabsApiKey: string;
  setProvider: (provider: TTSProviderId) => void;
  updateWebSpeech: (agent: AgentKey, patch: Partial<Omit<WebSpeechVoiceConfig, 'provider'>>) => void;
  updateKokoro: (agent: AgentKey, patch: Partial<Omit<KokoroVoiceConfig, 'provider'>>) => void;
  updateElevenLabs: (agent: AgentKey, patch: ElevenLabsUpdate) => void;
  setKokoroServerUrl: (url: string) => void;
  setElevenLabsApiKey: (key: string) => void;
}

const initialWebSpeech = (): Record<AgentKey, WebSpeechVoiceConfig> => ({
  claude: { ...DEFAULT_WEBSPEECH_CONFIG.claude },
  gemini: { ...DEFAULT_WEBSPEECH_CONFIG.gemini },
});

const initialKokoro = (): Record<AgentKey, KokoroVoiceConfig> => ({
  claude: { ...DEFAULT_KOKORO_CONFIG.claude },
  gemini: { ...DEFAULT_KOKORO_CONFIG.gemini },
});

const initialElevenLabs = (): Record<AgentKey, ElevenLabsVoiceConfig> => ({
  claude: {
    ...DEFAULT_ELEVENLABS_CONFIG.claude,
    voiceSettings: { ...DEFAULT_ELEVENLABS_CONFIG.claude.voiceSettings },
  },
  gemini: {
    ...DEFAULT_ELEVENLABS_CONFIG.gemini,
    voiceSettings: { ...DEFAULT_ELEVENLABS_CONFIG.gemini.voiceSettings },
  },
});

export const useTTSSettingsStore = create<TTSSettingsState>()(
  persist(
    (set) => ({
      provider: DEFAULT_PROVIDER,
      webspeech: initialWebSpeech(),
      kokoro: initialKokoro(),
      elevenlabs: initialElevenLabs(),
      kokoroServerUrl: DEFAULT_KOKORO_SERVER_URL,
      elevenLabsApiKey: '',
      setProvider: (provider) => set({ provider }),
      updateWebSpeech: (agent, patch) =>
        set((state) => ({
          webspeech: {
            ...state.webspeech,
            [agent]: {
              ...state.webspeech[agent],
              ...patch,
            },
          },
        })),
      updateKokoro: (agent, patch) =>
        set((state) => ({
          kokoro: {
            ...state.kokoro,
            [agent]: {
              ...state.kokoro[agent],
              ...patch,
            },
          },
        })),
      updateElevenLabs: (agent, patch) =>
        set((state) => ({
          elevenlabs: {
            ...state.elevenlabs,
            [agent]: {
              ...state.elevenlabs[agent],
              ...patch,
              voiceSettings: {
                ...state.elevenlabs[agent].voiceSettings,
                ...(patch.voiceSettings ?? {}),
              },
            },
          },
        })),
      setKokoroServerUrl: (url) => set({ kokoroServerUrl: url }),
      setElevenLabsApiKey: (key) => set({ elevenLabsApiKey: key }),
    }),
    {
      name: 'tts-settings-v1',
      partialize: (state) => ({
        provider: state.provider,
        webspeech: state.webspeech,
        kokoro: state.kokoro,
        elevenlabs: state.elevenlabs,
        kokoroServerUrl: state.kokoroServerUrl,
        elevenLabsApiKey: state.elevenLabsApiKey,
      }),
    },
  ),
);

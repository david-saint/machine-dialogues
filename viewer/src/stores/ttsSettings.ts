import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  DEFAULT_ELEVENLABS_CONFIG,
  DEFAULT_GEMINI_CONFIG,
  DEFAULT_KOKORO_CONFIG,
  DEFAULT_KOKORO_SERVER_URL,
  DEFAULT_PROVIDER,
  DEFAULT_WEBSPEECH_CONFIG,
} from '../lib/tts/defaults';
import type {
  AgentKey,
  ElevenLabsVoiceConfig,
  ElevenLabsVoiceSettings,
  GeminiVoiceConfig,
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
  gemini: Record<AgentKey, GeminiVoiceConfig>;
  kokoroServerUrl: string;
  elevenLabsApiKey: string;
  geminiApiKey: string;
  setProvider: (provider: TTSProviderId) => void;
  updateWebSpeech: (agent: AgentKey, patch: Partial<Omit<WebSpeechVoiceConfig, 'provider'>>) => void;
  updateKokoro: (agent: AgentKey, patch: Partial<Omit<KokoroVoiceConfig, 'provider'>>) => void;
  updateElevenLabs: (agent: AgentKey, patch: ElevenLabsUpdate) => void;
  updateGemini: (agent: AgentKey, patch: Partial<Omit<GeminiVoiceConfig, 'provider'>>) => void;
  setKokoroServerUrl: (url: string) => void;
  setElevenLabsApiKey: (key: string) => void;
  setGeminiApiKey: (key: string) => void;
}

const initialWebSpeech = (): Record<AgentKey, WebSpeechVoiceConfig> => ({
  agentA: { ...DEFAULT_WEBSPEECH_CONFIG.agentA },
  agentB: { ...DEFAULT_WEBSPEECH_CONFIG.agentB },
});

const initialKokoro = (): Record<AgentKey, KokoroVoiceConfig> => ({
  agentA: { ...DEFAULT_KOKORO_CONFIG.agentA },
  agentB: { ...DEFAULT_KOKORO_CONFIG.agentB },
});

const initialGemini = (): Record<AgentKey, GeminiVoiceConfig> => ({
  agentA: { ...DEFAULT_GEMINI_CONFIG.agentA },
  agentB: { ...DEFAULT_GEMINI_CONFIG.agentB },
});

const initialElevenLabs = (): Record<AgentKey, ElevenLabsVoiceConfig> => ({
  agentA: {
    ...DEFAULT_ELEVENLABS_CONFIG.agentA,
    voiceSettings: { ...DEFAULT_ELEVENLABS_CONFIG.agentA.voiceSettings },
  },
  agentB: {
    ...DEFAULT_ELEVENLABS_CONFIG.agentB,
    voiceSettings: { ...DEFAULT_ELEVENLABS_CONFIG.agentB.voiceSettings },
  },
});

export const useTTSSettingsStore = create<TTSSettingsState>()(
  persist(
    (set) => ({
      provider: DEFAULT_PROVIDER,
      webspeech: initialWebSpeech(),
      kokoro: initialKokoro(),
      elevenlabs: initialElevenLabs(),
      gemini: initialGemini(),
      kokoroServerUrl: DEFAULT_KOKORO_SERVER_URL,
      elevenLabsApiKey: '',
      geminiApiKey: '',
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
      updateGemini: (agent, patch) =>
        set((state) => ({
          gemini: {
            ...state.gemini,
            [agent]: {
              ...state.gemini[agent],
              ...patch,
            },
          },
        })),
      setKokoroServerUrl: (url) => set({ kokoroServerUrl: url }),
      setElevenLabsApiKey: (key) => set({ elevenLabsApiKey: key }),
      setGeminiApiKey: (key) => set({ geminiApiKey: key }),
    }),
    {
      name: 'tts-settings-v1',
      partialize: (state) => ({
        provider: state.provider,
        webspeech: state.webspeech,
        kokoro: state.kokoro,
        elevenlabs: state.elevenlabs,
        gemini: state.gemini,
        kokoroServerUrl: state.kokoroServerUrl,
        elevenLabsApiKey: state.elevenLabsApiKey,
        geminiApiKey: state.geminiApiKey,
      }),
    },
  ),
);

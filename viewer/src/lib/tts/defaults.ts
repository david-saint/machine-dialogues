import type {
  AgentKey,
  ElevenLabsVoiceConfig,
  ElevenLabsVoiceSettings,
  KokoroVoiceConfig,
  ProviderVoiceConfig,
  TTSProviderId,
  WebSpeechVoiceConfig,
} from './types';

export const DEFAULT_PROVIDER: TTSProviderId = 'webspeech';

export const DEFAULT_WEBSPEECH_CONFIG: Record<AgentKey, WebSpeechVoiceConfig> = {
  claude: { provider: 'webspeech', pitch: 0.9, rate: 0.85, voiceName: 'Daniel' },
  gemini: { provider: 'webspeech', pitch: 1.1, rate: 0.95, voiceName: 'Samantha' },
};

export const DEFAULT_KOKORO_CONFIG: Record<AgentKey, KokoroVoiceConfig> = {
  claude: { provider: 'kokoro', voiceId: 'am_adam', model: 'kokoro', responseFormat: 'mp3' },
  gemini: { provider: 'kokoro', voiceId: 'af_heart', model: 'kokoro', responseFormat: 'mp3' },
};

export const DEFAULT_KOKORO_SERVER_URL = 'http://localhost:8880';

export const DEFAULT_ELEVENLABS_VOICE_SETTINGS: ElevenLabsVoiceSettings = {
  stability: 0.5,
  similarity_boost: 0.75,
  style: 0,
  use_speaker_boost: true,
};

export const DEFAULT_ELEVENLABS_CONFIG: Record<AgentKey, ElevenLabsVoiceConfig> = {
  claude: {
    provider: 'elevenlabs',
    voiceId: 'EXAVITQu4vr4xnSDxMaL',
    modelId: 'eleven_multilingual_v2',
    voiceSettings: DEFAULT_ELEVENLABS_VOICE_SETTINGS,
  },
  gemini: {
    provider: 'elevenlabs',
    voiceId: '21m00Tcm4TlvDq8ikWAM',
    modelId: 'eleven_multilingual_v2',
    voiceSettings: DEFAULT_ELEVENLABS_VOICE_SETTINGS,
  },
};

export const getProviderVoiceConfig = (
  provider: TTSProviderId,
  agent: AgentKey,
  configs: {
    webspeech: Record<AgentKey, WebSpeechVoiceConfig>;
    kokoro: Record<AgentKey, KokoroVoiceConfig>;
    elevenlabs: Record<AgentKey, ElevenLabsVoiceConfig>;
  },
): ProviderVoiceConfig => {
  if (provider === 'webspeech') {
    return configs.webspeech[agent];
  }
  if (provider === 'kokoro') {
    return configs.kokoro[agent];
  }
  return configs.elevenlabs[agent];
};

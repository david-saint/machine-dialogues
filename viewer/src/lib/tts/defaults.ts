import type {
  AgentKey,
  ElevenLabsVoiceConfig,
  ElevenLabsVoiceSettings,
  GeminiVoiceConfig,
  KokoroVoiceConfig,
  ProviderVoiceConfig,
  TTSProviderId,
  WebSpeechVoiceConfig,
} from './types';

export const DEFAULT_PROVIDER: TTSProviderId = 'webspeech';

export const DEFAULT_WEBSPEECH_CONFIG: Record<AgentKey, WebSpeechVoiceConfig> = {
  agentA: { provider: 'webspeech', pitch: 0.9, rate: 0.85, voiceName: 'Daniel' },
  agentB: { provider: 'webspeech', pitch: 1.1, rate: 0.95, voiceName: 'Samantha' },
};

export const DEFAULT_KOKORO_CONFIG: Record<AgentKey, KokoroVoiceConfig> = {
  agentA: { provider: 'kokoro', voiceId: 'am_adam', model: 'kokoro', responseFormat: 'mp3' },
  agentB: { provider: 'kokoro', voiceId: 'af_heart', model: 'kokoro', responseFormat: 'mp3' },
};

export const DEFAULT_KOKORO_SERVER_URL = 'http://localhost:8880';

export const DEFAULT_ELEVENLABS_VOICE_SETTINGS: ElevenLabsVoiceSettings = {
  stability: 0.5,
  similarity_boost: 0.75,
  style: 0,
  use_speaker_boost: true,
};

export const DEFAULT_ELEVENLABS_CONFIG: Record<AgentKey, ElevenLabsVoiceConfig> = {
  agentA: {
    provider: 'elevenlabs',
    voiceId: 'EXAVITQu4vr4xnSDxMaL',
    modelId: 'eleven_multilingual_v2',
    voiceSettings: DEFAULT_ELEVENLABS_VOICE_SETTINGS,
  },
  agentB: {
    provider: 'elevenlabs',
    voiceId: '21m00Tcm4TlvDq8ikWAM',
    modelId: 'eleven_multilingual_v2',
    voiceSettings: DEFAULT_ELEVENLABS_VOICE_SETTINGS,
  },
};

export const GEMINI_TTS_MODELS = [
  'gemini-3.1-flash-tts-preview',
  'gemini-2.5-flash-preview-tts',
  'gemini-2.5-pro-preview-tts',
] as const;

export const DEFAULT_GEMINI_MODEL = GEMINI_TTS_MODELS[0];

export const GEMINI_VOICES: Array<{ id: string; name: string }> = [
  { id: 'Zephyr', name: 'Zephyr — Bright' },
  { id: 'Puck', name: 'Puck — Upbeat' },
  { id: 'Charon', name: 'Charon — Informative' },
  { id: 'Kore', name: 'Kore — Firm' },
  { id: 'Fenrir', name: 'Fenrir — Excitable' },
  { id: 'Leda', name: 'Leda — Youthful' },
  { id: 'Orus', name: 'Orus — Firm' },
  { id: 'Aoede', name: 'Aoede — Breezy' },
  { id: 'Callirrhoe', name: 'Callirrhoe — Easy-going' },
  { id: 'Autonoe', name: 'Autonoe — Bright' },
  { id: 'Enceladus', name: 'Enceladus — Breathy' },
  { id: 'Iapetus', name: 'Iapetus — Clear' },
  { id: 'Umbriel', name: 'Umbriel — Easy-going' },
  { id: 'Algieba', name: 'Algieba — Smooth' },
  { id: 'Despina', name: 'Despina — Smooth' },
  { id: 'Erinome', name: 'Erinome — Clear' },
  { id: 'Algenib', name: 'Algenib — Gravelly' },
  { id: 'Rasalgethi', name: 'Rasalgethi — Informative' },
  { id: 'Laomedeia', name: 'Laomedeia — Upbeat' },
  { id: 'Achernar', name: 'Achernar — Soft' },
  { id: 'Alnilam', name: 'Alnilam — Firm' },
  { id: 'Schedar', name: 'Schedar — Even' },
  { id: 'Gacrux', name: 'Gacrux — Mature' },
  { id: 'Pulcherrima', name: 'Pulcherrima — Forward' },
  { id: 'Achird', name: 'Achird — Friendly' },
  { id: 'Zubenelgenubi', name: 'Zubenelgenubi — Casual' },
  { id: 'Vindemiatrix', name: 'Vindemiatrix — Gentle' },
  { id: 'Sadachbia', name: 'Sadachbia — Lively' },
  { id: 'Sadaltager', name: 'Sadaltager — Knowledgeable' },
  { id: 'Sulafat', name: 'Sulafat — Warm' },
];

// Kept for the settings-store migration: users who still have this persisted
// get upgraded to the calmer default below.
export const LEGACY_GEMINI_STYLE_INSTRUCTION =
  'You are {speaker}, locked in a heated live debate against {opponent}. ' +
  'Deliver the following argument exactly as written, as a real debater would — impassioned and insistent, ' +
  'with rising intensity on key points, sharp rhetorical emphasis, and the urgency of someone who must win ' +
  'over the room right now';

export const DEFAULT_GEMINI_STYLE_INSTRUCTION =
  'You are {speaker}, in a live debate against {opponent}. Speak with the calm, measured confidence ' +
  'of a seasoned debater: composed, conversational, deliberate pacing, letting quiet conviction carry ' +
  'the argument. Keep the delivery even and natural throughout, and reserve genuine passion for the one ' +
  'or two moments where the point truly hinges — a brief rise in intensity, then settle back to composure. ' +
  'Never theatrical, never breathless';

export const DEFAULT_GEMINI_CONFIG: Record<AgentKey, GeminiVoiceConfig> = {
  agentA: {
    provider: 'gemini',
    voiceName: 'Kore',
    model: DEFAULT_GEMINI_MODEL,
    styleInstruction: DEFAULT_GEMINI_STYLE_INSTRUCTION,
  },
  agentB: {
    provider: 'gemini',
    voiceName: 'Fenrir',
    model: DEFAULT_GEMINI_MODEL,
    styleInstruction: DEFAULT_GEMINI_STYLE_INSTRUCTION,
  },
};

export const getProviderVoiceConfig = (
  provider: TTSProviderId,
  agent: AgentKey,
  configs: {
    webspeech: Record<AgentKey, WebSpeechVoiceConfig>;
    kokoro: Record<AgentKey, KokoroVoiceConfig>;
    elevenlabs: Record<AgentKey, ElevenLabsVoiceConfig>;
    gemini: Record<AgentKey, GeminiVoiceConfig>;
  },
): ProviderVoiceConfig => {
  if (provider === 'webspeech') {
    return configs.webspeech[agent];
  }
  if (provider === 'kokoro') {
    return configs.kokoro[agent];
  }
  if (provider === 'gemini') {
    return configs.gemini[agent];
  }
  return configs.elevenlabs[agent];
};

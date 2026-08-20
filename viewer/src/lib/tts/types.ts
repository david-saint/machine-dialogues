export type TTSProviderId = 'webspeech' | 'kokoro' | 'elevenlabs' | 'gemini';

export type AgentKey = 'agentA' | 'agentB';

export type HighlightPosition = {
  charIndex: number;
  charLength: number;
};

export type WordTimestamp = {
  word: string;
  start: number;
  end: number;
  charIndex: number;
  charLength: number;
};

export type WebSpeechVoiceConfig = {
  provider: 'webspeech';
  pitch: number;
  rate: number;
  voiceName?: string;
};

export type KokoroVoiceConfig = {
  provider: 'kokoro';
  voiceId: string;
  model: string;
  responseFormat: 'mp3' | 'wav';
};

export type ElevenLabsVoiceSettings = {
  stability: number;
  similarity_boost: number;
  style: number;
  use_speaker_boost: boolean;
};

export type ElevenLabsVoiceConfig = {
  provider: 'elevenlabs';
  voiceId: string;
  modelId: string;
  voiceSettings: ElevenLabsVoiceSettings;
};

export type GeminiVoiceConfig = {
  provider: 'gemini';
  voiceName: string;
  model: string;
  styleInstruction: string;
};

export type ProviderVoiceConfig =
  | WebSpeechVoiceConfig
  | KokoroVoiceConfig
  | ElevenLabsVoiceConfig
  | GeminiVoiceConfig;

export type TTSEvents = {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: Error) => void;
  onLoadingChange?: (loading: boolean) => void;
  onBoundary?: (position: HighlightPosition) => void;
  onWordBoundary?: (word: WordTimestamp) => void;
};

export type SpeakerContext = {
  speakerName?: string;
  opponentName?: string;
};

export type TTSRequest = {
  text: string;
  speed: number;
  agent: AgentKey;
  config: ProviderVoiceConfig;
  apiKey?: string;
  serverUrl?: string;
  context?: SpeakerContext;
};

export type TTSProviderVoice = {
  id: string;
  name: string;
};

/**
 * Outcome of a credential or connection check. The message is written for the
 * settings panel, so a rejected key and an unreachable host read differently
 * instead of both collapsing to "invalid".
 */
export type ProviderCheck = {
  ok: boolean;
  message: string;
};

export interface TTSProvider {
  readonly id: TTSProviderId;
  speak(request: TTSRequest, events?: TTSEvents): Promise<void>;
  /** Warm caches for an upcoming request without touching playback state. */
  prefetch?(request: TTSRequest): Promise<void>;
  stop(): void;
  pause(): void;
  resume(): void;
  setPlaybackRate?(rate: number): void;
  checkAvailability?(opts?: { apiKey?: string; serverUrl?: string }): Promise<ProviderCheck>;
  getVoices?(opts?: { apiKey?: string; serverUrl?: string }): Promise<TTSProviderVoice[]>;
}

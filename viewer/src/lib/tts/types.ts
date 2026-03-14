export type TTSProviderId = 'webspeech' | 'kokoro' | 'elevenlabs';

export type AgentKey = 'claude' | 'gemini';

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

export type ProviderVoiceConfig = WebSpeechVoiceConfig | KokoroVoiceConfig | ElevenLabsVoiceConfig;

export type TTSEvents = {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: Error) => void;
  onLoadingChange?: (loading: boolean) => void;
  onBoundary?: (position: HighlightPosition) => void;
  onWordBoundary?: (word: WordTimestamp) => void;
};

export type TTSRequest = {
  text: string;
  speed: number;
  agent: AgentKey;
  config: ProviderVoiceConfig;
  apiKey?: string;
  serverUrl?: string;
};

export type TTSProviderVoice = {
  id: string;
  name: string;
};

export interface TTSProvider {
  readonly id: TTSProviderId;
  speak(request: TTSRequest, events?: TTSEvents): Promise<void>;
  stop(): void;
  pause(): void;
  resume(): void;
  setPlaybackRate?(rate: number): void;
  checkAvailability?(opts?: { apiKey?: string; serverUrl?: string }): Promise<boolean>;
  getVoices?(opts?: { apiKey?: string; serverUrl?: string }): Promise<TTSProviderVoice[]>;
}

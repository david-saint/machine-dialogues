import { useCallback, useMemo } from 'react';
import { ttsOrchestrator } from '../lib/tts/index';
import type { AgentKey } from '../lib/tts/types';
import type { TranscriptTurn } from '../types/transcript';
import { usePlaybackStore } from '../stores/playback';
import { useToastStore } from '../stores/toast';
import { useTTSSettingsStore } from '../stores/ttsSettings';

type SpeakTurnArgs = {
  turn: TranscriptTurn;
  speed: number;
  agentKey: AgentKey;
  speakerName?: string;
  opponentName?: string;
  onEnd?: () => void;
};

const PROVIDER_LABELS: Record<string, string> = {
  webspeech: 'Web Speech',
  kokoro: 'Kokoro',
  elevenlabs: 'ElevenLabs',
  gemini: 'Gemini',
};

export const useTTS = () => {
  const setLoading = usePlaybackStore((state) => state.setLoading);
  const setHighlightPosition = usePlaybackStore((state) => state.setHighlightPosition);
  const pushToast = useToastStore((state) => state.pushToast);
  const provider = useTTSSettingsStore((state) => state.provider);
  const webspeech = useTTSSettingsStore((state) => state.webspeech);
  const kokoro = useTTSSettingsStore((state) => state.kokoro);
  const elevenlabs = useTTSSettingsStore((state) => state.elevenlabs);
  const gemini = useTTSSettingsStore((state) => state.gemini);
  const kokoroServerUrl = useTTSSettingsStore((state) => state.kokoroServerUrl);
  const elevenLabsApiKey = useTTSSettingsStore((state) => state.elevenLabsApiKey);
  const geminiApiKey = useTTSSettingsStore((state) => state.geminiApiKey);

  const settings = useMemo(
    () => ({
      provider,
      webspeech,
      kokoro,
      elevenlabs,
      gemini,
      kokoroServerUrl,
      elevenLabsApiKey,
      geminiApiKey,
    }),
    [elevenLabsApiKey, elevenlabs, gemini, geminiApiKey, kokoro, kokoroServerUrl, provider, webspeech],
  );

  const speakTurn = useCallback(async ({ turn, speed, agentKey, speakerName, opponentName, onEnd }: SpeakTurnArgs) => {
    await ttsOrchestrator.speak(
      {
        text: turn.content,
        speed,
        agent: agentKey,
        settings,
        context: { speakerName: speakerName ?? turn.agentName, opponentName },
      },
      {
        onLoadingChange: (loading) => setLoading(loading),
        onBoundary: (position) => setHighlightPosition(position),
        onEnd: () => {
          setHighlightPosition(null);
          if (onEnd) {
            onEnd();
          }
        },
        onError: (error) => {
          pushToast({
            message: error.message,
            level: 'error',
            durationMs: 3200,
          });
        },
        onFallback: (failedProvider) => {
          const label = PROVIDER_LABELS[failedProvider] ?? failedProvider;
          pushToast({
            message: `${label} unavailable, using Web Speech API`,
            level: 'warning',
            durationMs: 3200,
          });
        },
      },
    );
  }, [pushToast, setHighlightPosition, setLoading, settings]);

  const stop = useCallback(() => {
    setLoading(false);
    setHighlightPosition(null);
    ttsOrchestrator.stop();
  }, [setHighlightPosition, setLoading]);

  const pause = useCallback(() => ttsOrchestrator.pause(), []);
  const resume = useCallback(() => ttsOrchestrator.resume(), []);
  const setPlaybackRate = useCallback((rate: number) => ttsOrchestrator.setPlaybackRate(rate), []);
  const checkKokoroConnection = useCallback((serverUrl: string) => ttsOrchestrator.checkKokoroConnection(serverUrl), []);
  const validateElevenLabsKey = useCallback((apiKey: string) => ttsOrchestrator.validateElevenLabsKey(apiKey), []);
  const validateGeminiKey = useCallback((apiKey: string) => ttsOrchestrator.validateGeminiKey(apiKey), []);
  const getElevenLabsVoices = useCallback((apiKey: string) => ttsOrchestrator.getElevenLabsVoices(apiKey), []);
  const clearAudioCache = useCallback(() => ttsOrchestrator.clearCache(), []);
  const getCacheSizeBytes = useCallback(() => ttsOrchestrator.getCacheSizeBytes(), []);

  const api = useMemo(() => ({
    provider,
    speakTurn,
    stop,
    pause,
    resume,
    setPlaybackRate,
    checkKokoroConnection,
    validateElevenLabsKey,
    validateGeminiKey,
    getElevenLabsVoices,
    clearAudioCache,
    getCacheSizeBytes,
  }), [
    checkKokoroConnection,
    clearAudioCache,
    getCacheSizeBytes,
    getElevenLabsVoices,
    pause,
    provider,
    resume,
    setPlaybackRate,
    speakTurn,
    stop,
    validateElevenLabsKey,
    validateGeminiKey,
  ]);

  return api;
};

import { useCallback, useMemo } from 'react';
import { ttsOrchestrator } from '../lib/tts/index';
import type { AgentInfo, TranscriptTurn } from '../types/transcript';
import { usePlaybackStore } from '../stores/playback';
import { useToastStore } from '../stores/toast';
import { useTTSSettingsStore } from '../stores/ttsSettings';

const getAgentKey = (agentName: string): 'claude' | 'gemini' => {
  if (agentName.toLowerCase().includes('claude')) {
    return 'claude';
  }
  return 'gemini';
};

type SpeakTurnArgs = {
  turn: TranscriptTurn;
  speed: number;
  onEnd?: () => void;
};

export const useTTS = () => {
  const setLoading = usePlaybackStore((state) => state.setLoading);
  const setHighlightPosition = usePlaybackStore((state) => state.setHighlightPosition);
  const pushToast = useToastStore((state) => state.pushToast);
  const provider = useTTSSettingsStore((state) => state.provider);
  const webspeech = useTTSSettingsStore((state) => state.webspeech);
  const kokoro = useTTSSettingsStore((state) => state.kokoro);
  const elevenlabs = useTTSSettingsStore((state) => state.elevenlabs);
  const kokoroServerUrl = useTTSSettingsStore((state) => state.kokoroServerUrl);
  const elevenLabsApiKey = useTTSSettingsStore((state) => state.elevenLabsApiKey);

  const settings = useMemo(
    () => ({
      provider,
      webspeech,
      kokoro,
      elevenlabs,
      kokoroServerUrl,
      elevenLabsApiKey,
    }),
    [elevenLabsApiKey, elevenlabs, kokoro, kokoroServerUrl, provider, webspeech],
  );

  const speakTurn = useCallback(async ({ turn, speed, onEnd }: SpeakTurnArgs) => {
    await ttsOrchestrator.speak(
      {
        text: turn.content,
        speed,
        agent: getAgentKey(turn.agentName),
        settings,
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
          const label = failedProvider === 'kokoro' ? 'Kokoro' : 'ElevenLabs';
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
  ]);

  return api;
};

export const agentKeyFromInfo = (agent: AgentInfo): 'claude' | 'gemini' => getAgentKey(agent.name);

import React, { useEffect, useState } from 'react';
import { GEMINI_TTS_MODELS, GEMINI_VOICES } from '../../lib/tts/defaults';
import type { AgentKey, ProviderCheck, TTSProviderId, TTSProviderVoice } from '../../lib/tts/types';
import { useTTSSettingsStore } from '../../stores/ttsSettings';

type ProviderConfigProps = {
  provider: TTSProviderId;
  cacheSizeLabel: string;
  onCheckKokoro: (serverUrl: string) => Promise<ProviderCheck>;
  onValidateElevenLabs: (apiKey: string) => Promise<ProviderCheck>;
  onValidateGemini: (apiKey: string) => Promise<ProviderCheck>;
  onLoadElevenLabsVoices: (apiKey: string) => Promise<TTSProviderVoice[]>;
  onClearCache: () => Promise<void>;
};

const agentLabel = (agent: AgentKey) => (agent === 'agentA' ? 'Agent A' : 'Agent B');

type Status = {
  tone: 'pending' | 'ok' | 'error';
  text: string;
};

export const ProviderConfig: React.FC<ProviderConfigProps> = ({
  provider,
  cacheSizeLabel,
  onCheckKokoro,
  onValidateElevenLabs,
  onValidateGemini,
  onLoadElevenLabsVoices,
  onClearCache,
}) => {
  const webspeech = useTTSSettingsStore((state) => state.webspeech);
  const kokoro = useTTSSettingsStore((state) => state.kokoro);
  const elevenlabs = useTTSSettingsStore((state) => state.elevenlabs);
  const gemini = useTTSSettingsStore((state) => state.gemini);
  const kokoroServerUrl = useTTSSettingsStore((state) => state.kokoroServerUrl);
  const elevenLabsApiKey = useTTSSettingsStore((state) => state.elevenLabsApiKey);
  const geminiApiKey = useTTSSettingsStore((state) => state.geminiApiKey);
  const updateWebSpeech = useTTSSettingsStore((state) => state.updateWebSpeech);
  const updateKokoro = useTTSSettingsStore((state) => state.updateKokoro);
  const updateElevenLabs = useTTSSettingsStore((state) => state.updateElevenLabs);
  const updateGemini = useTTSSettingsStore((state) => state.updateGemini);
  const setKokoroServerUrl = useTTSSettingsStore((state) => state.setKokoroServerUrl);
  const setElevenLabsApiKey = useTTSSettingsStore((state) => state.setElevenLabsApiKey);
  const setGeminiApiKey = useTTSSettingsStore((state) => state.setGeminiApiKey);

  const [status, setStatus] = useState<Status | null>(null);
  const [voices, setVoices] = useState<TTSProviderVoice[]>([]);
  const [busy, setBusy] = useState(false);

  // A result stops describing the current inputs the moment they change.
  useEffect(() => {
    setStatus(null);
  }, [provider, elevenLabsApiKey, geminiApiKey, kokoroServerUrl]);

  const getVoiceNameById = (voiceId: string): string => {
    const match = voices.find((voice) => voice.id === voiceId);
    return match ? `${match.name} (${match.id})` : voiceId;
  };

  // Every action reports something: a pending line while it runs, then the
  // outcome — including thrown errors, which used to leave the panel silent.
  const run = async (pendingText: string, job: () => Promise<ProviderCheck>) => {
    setBusy(true);
    setStatus({ tone: 'pending', text: pendingText });
    try {
      const result = await job();
      setStatus({ tone: result.ok ? 'ok' : 'error', text: result.message });
    } catch (error) {
      setStatus({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Unexpected error',
      });
    } finally {
      setBusy(false);
    }
  };

  const statusLine = status ? (
    <p className={`provider-status provider-status--${status.tone}`} role="status" aria-live="polite">
      {status.text}
    </p>
  ) : null;

  if (provider === 'webspeech') {
    return (
      <div className="provider-grid">
        {(['agentA', 'agentB'] as AgentKey[]).map((agent) => (
          <div key={agent} className="provider-card">
            <p className="provider-title">{agentLabel(agent)} Voice</p>
            <label>
              Pitch
              <input
                type="range"
                min="0.5"
                max="1.5"
                step="0.05"
                value={webspeech[agent].pitch}
                onChange={(event) => updateWebSpeech(agent, { pitch: Number(event.target.value) })}
              />
            </label>
            <label>
              Rate
              <input
                type="range"
                min="0.6"
                max="1.4"
                step="0.05"
                value={webspeech[agent].rate}
                onChange={(event) => updateWebSpeech(agent, { rate: Number(event.target.value) })}
              />
            </label>
            <label>
              Voice Name
              <input
                value={webspeech[agent].voiceName ?? ''}
                onChange={(event) => updateWebSpeech(agent, { voiceName: event.target.value })}
                placeholder={agent === 'agentA' ? 'Daniel' : 'Samantha'}
              />
            </label>
          </div>
        ))}
      </div>
    );
  }

  if (provider === 'kokoro') {
    return (
      <div className="provider-grid">
        <div className="provider-card provider-card--full">
          <p className="provider-title">Kokoro Server</p>
          <label>
            Server URL
            <input
              value={kokoroServerUrl}
              onChange={(event) => setKokoroServerUrl(event.target.value)}
              placeholder="http://localhost:8880"
            />
          </label>
          <button
            disabled={busy}
            onClick={() => run('Testing connection…', () => onCheckKokoro(kokoroServerUrl))}
          >
            Test Connection
          </button>
          {statusLine}
        </div>

        {(['agentA', 'agentB'] as AgentKey[]).map((agent) => (
          <div key={agent} className="provider-card">
            <p className="provider-title">{agentLabel(agent)} Voice</p>
            <label>
              Voice ID
              <input
                value={kokoro[agent].voiceId}
                onChange={(event) => updateKokoro(agent, { voiceId: event.target.value })}
              />
            </label>
            <label>
              Model
              <input
                value={kokoro[agent].model}
                onChange={(event) => updateKokoro(agent, { model: event.target.value })}
              />
            </label>
            <label>
              Format
              <select
                value={kokoro[agent].responseFormat}
                onChange={(event) =>
                  updateKokoro(agent, { responseFormat: event.target.value as 'mp3' | 'wav' })
                }
              >
                <option value="mp3">mp3</option>
                <option value="wav">wav</option>
              </select>
            </label>
          </div>
        ))}

        <div className="provider-card provider-card--full">
          <p className="provider-title">Audio Cache</p>
          <p className="provider-meta">Current cache size: {cacheSizeLabel}</p>
          <button
            disabled={busy}
            onClick={() =>
              run('Clearing cache…', async () => {
                await onClearCache();
                return { ok: true, message: 'Audio cache cleared' };
              })
            }
          >
            Clear Audio Cache
          </button>
        </div>
      </div>
    );
  }

  if (provider === 'gemini') {
    return (
      <div className="provider-grid">
        <div className="provider-card provider-card--full">
          <p className="provider-title">Gemini API</p>
          <label>
            API Key
            <input
              type="password"
              value={geminiApiKey}
              onChange={(event) => setGeminiApiKey(event.target.value)}
              placeholder="AIza..."
            />
          </label>
          <button
            disabled={busy || !geminiApiKey.trim()}
            onClick={() => run('Validating key…', () => onValidateGemini(geminiApiKey))}
          >
            Validate Key
          </button>
          {statusLine}
          <p className="provider-meta">
            Each turn is voiced in character — use {'{speaker}'} and {'{opponent}'} in the debate
            direction to reference the agents by name.
          </p>
        </div>

        {(['agentA', 'agentB'] as AgentKey[]).map((agent) => (
          <div key={agent} className="provider-card">
            <p className="provider-title">{agentLabel(agent)} Voice</p>
            <label>
              Voice
              <select
                value={gemini[agent].voiceName}
                onChange={(event) => updateGemini(agent, { voiceName: event.target.value })}
              >
                {GEMINI_VOICES.map((voice) => (
                  <option key={voice.id} value={voice.id}>
                    {voice.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Model
              <select
                value={gemini[agent].model}
                onChange={(event) => updateGemini(agent, { model: event.target.value })}
              >
                {GEMINI_TTS_MODELS.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Debate Direction
              <textarea
                rows={5}
                value={gemini[agent].styleInstruction}
                onChange={(event) => updateGemini(agent, { styleInstruction: event.target.value })}
              />
            </label>
          </div>
        ))}

        <div className="provider-card provider-card--full">
          <p className="provider-title">Audio Cache</p>
          <p className="provider-meta">Current cache size: {cacheSizeLabel}</p>
          <button
            disabled={busy}
            onClick={() =>
              run('Clearing cache…', async () => {
                await onClearCache();
                return { ok: true, message: 'Audio cache cleared' };
              })
            }
          >
            Clear Audio Cache
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="provider-grid">
      <div className="provider-card provider-card--full">
        <p className="provider-title">ElevenLabs Account</p>
        <label>
          API Key
          <input
            type="password"
            value={elevenLabsApiKey}
            onChange={(event) => setElevenLabsApiKey(event.target.value)}
            placeholder="xi-..."
          />
        </label>
        <div className="provider-actions">
          <button
            disabled={busy || !elevenLabsApiKey.trim()}
            onClick={() => run('Validating key…', () => onValidateElevenLabs(elevenLabsApiKey))}
          >
            Validate Key
          </button>
          <button
            disabled={busy || !elevenLabsApiKey.trim()}
            onClick={() =>
              run('Loading voices…', async () => {
                const fetched = await onLoadElevenLabsVoices(elevenLabsApiKey);
                setVoices(fetched);
                return fetched.length > 0
                  ? { ok: true, message: `Loaded ${fetched.length} voices` }
                  : { ok: false, message: 'No voices returned' };
              })
            }
          >
            Fetch Voices
          </button>
        </div>
        {statusLine}
      </div>

      {(['agentA', 'agentB'] as AgentKey[]).map((agent) => (
        <div key={agent} className="provider-card">
          <p className="provider-title">{agentLabel(agent)} Voice</p>
          <label>
            Voice
            <select
              value={elevenlabs[agent].voiceId}
              onChange={(event) => updateElevenLabs(agent, { voiceId: event.target.value })}
            >
              <option value={elevenlabs[agent].voiceId}>
                Current ({getVoiceNameById(elevenlabs[agent].voiceId)})
              </option>
              {voices.map((voice) => (
                <option key={voice.id} value={voice.id}>
                  {voice.name} ({voice.id})
                </option>
              ))}
            </select>
          </label>
          <label>
            Stability
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={elevenlabs[agent].voiceSettings.stability}
              onChange={(event) =>
                updateElevenLabs(agent, { voiceSettings: { stability: Number(event.target.value) } })
              }
            />
          </label>
          <label>
            Similarity
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={elevenlabs[agent].voiceSettings.similarity_boost}
              onChange={(event) =>
                updateElevenLabs(agent, { voiceSettings: { similarity_boost: Number(event.target.value) } })
              }
            />
          </label>
          <label>
            Style
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={elevenlabs[agent].voiceSettings.style}
              onChange={(event) => updateElevenLabs(agent, { voiceSettings: { style: Number(event.target.value) } })}
            />
          </label>
        </div>
      ))}

      <div className="provider-card provider-card--full">
        <p className="provider-title">Audio Cache</p>
        <p className="provider-meta">Current cache size: {cacheSizeLabel}</p>
        <button
          disabled={busy}
          onClick={() =>
            run('Clearing cache…', async () => {
              await onClearCache();
              return { ok: true, message: 'Audio cache cleared' };
            })
          }
        >
          Clear Audio Cache
        </button>
      </div>
    </div>
  );
};

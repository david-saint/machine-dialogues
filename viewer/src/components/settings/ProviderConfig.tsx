import React, { useState } from 'react';
import type { AgentKey, TTSProviderId, TTSProviderVoice } from '../../lib/tts/types';
import { useTTSSettingsStore } from '../../stores/ttsSettings';

type ProviderConfigProps = {
  provider: TTSProviderId;
  cacheSizeLabel: string;
  onCheckKokoro: (serverUrl: string) => Promise<boolean>;
  onValidateElevenLabs: (apiKey: string) => Promise<boolean>;
  onLoadElevenLabsVoices: (apiKey: string) => Promise<TTSProviderVoice[]>;
  onClearCache: () => Promise<void>;
};

const agentLabel = (agent: AgentKey) => (agent === 'agentA' ? 'Agent A' : 'Agent B');

export const ProviderConfig: React.FC<ProviderConfigProps> = ({
  provider,
  cacheSizeLabel,
  onCheckKokoro,
  onValidateElevenLabs,
  onLoadElevenLabsVoices,
  onClearCache,
}) => {
  const webspeech = useTTSSettingsStore((state) => state.webspeech);
  const kokoro = useTTSSettingsStore((state) => state.kokoro);
  const elevenlabs = useTTSSettingsStore((state) => state.elevenlabs);
  const kokoroServerUrl = useTTSSettingsStore((state) => state.kokoroServerUrl);
  const elevenLabsApiKey = useTTSSettingsStore((state) => state.elevenLabsApiKey);
  const updateWebSpeech = useTTSSettingsStore((state) => state.updateWebSpeech);
  const updateKokoro = useTTSSettingsStore((state) => state.updateKokoro);
  const updateElevenLabs = useTTSSettingsStore((state) => state.updateElevenLabs);
  const setKokoroServerUrl = useTTSSettingsStore((state) => state.setKokoroServerUrl);
  const setElevenLabsApiKey = useTTSSettingsStore((state) => state.setElevenLabsApiKey);

  const [status, setStatus] = useState<string>('');
  const [voices, setVoices] = useState<TTSProviderVoice[]>([]);
  const [busy, setBusy] = useState(false);

  const getVoiceNameById = (voiceId: string): string => {
    const match = voices.find((voice) => voice.id === voiceId);
    return match ? `${match.name} (${match.id})` : voiceId;
  };

  const withBusy = async (job: () => Promise<void>) => {
    setBusy(true);
    try {
      await job();
    } finally {
      setBusy(false);
    }
  };

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
            onClick={() =>
              withBusy(async () => {
                const ok = await onCheckKokoro(kokoroServerUrl);
                setStatus(ok ? 'Connected to Kokoro server' : 'Unable to reach Kokoro server');
              })
            }
          >
            Test Connection
          </button>
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
          <button disabled={busy} onClick={() => withBusy(onClearCache)}>
            Clear Audio Cache
          </button>
        </div>

        {status && <p className="provider-status">{status}</p>}
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
            onClick={() =>
              withBusy(async () => {
                const ok = await onValidateElevenLabs(elevenLabsApiKey);
                setStatus(ok ? 'API key validated' : 'API key invalid');
              })
            }
          >
            Validate Key
          </button>
          <button
            disabled={busy || !elevenLabsApiKey.trim()}
            onClick={() =>
              withBusy(async () => {
                const fetched = await onLoadElevenLabsVoices(elevenLabsApiKey);
                setVoices(fetched);
                setStatus(fetched.length > 0 ? `Loaded ${fetched.length} voices` : 'No voices returned');
              })
            }
          >
            Fetch Voices
          </button>
        </div>
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
        <button disabled={busy} onClick={() => withBusy(onClearCache)}>
          Clear Audio Cache
        </button>
      </div>

      {status && <p className="provider-status">{status}</p>}
    </div>
  );
};

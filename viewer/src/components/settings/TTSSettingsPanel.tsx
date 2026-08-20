import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { ProviderConfig } from './ProviderConfig';
import { useTTS } from '../../hooks/useTTS';
import { useTTSSettingsStore } from '../../stores/ttsSettings';
import type { TTSProviderId } from '../../lib/tts/types';

type TTSSettingsPanelProps = {
  open: boolean;
  onClose: () => void;
};

const formatBytes = (bytes: number): string => {
  if (bytes <= 0) {
    return '0 B';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const TTSSettingsPanel: React.FC<TTSSettingsPanelProps> = ({ open, onClose }) => {
  const provider = useTTSSettingsStore((state) => state.provider);
  const setProvider = useTTSSettingsStore((state) => state.setProvider);
  const {
    checkKokoroConnection,
    validateElevenLabsKey,
    validateGeminiKey,
    getElevenLabsVoices,
    clearAudioCache,
    getCacheSizeBytes,
  } = useTTS();

  const [cacheSize, setCacheSize] = useState('0 B');

  useEffect(() => {
    if (!open) {
      return;
    }

    void getCacheSizeBytes().then((bytes) => setCacheSize(formatBytes(bytes))).catch(() => setCacheSize('Unknown'));
  }, [getCacheSizeBytes, open]);

  const providerOptions: Array<{ id: TTSProviderId; label: string }> = useMemo(
    () => [
      { id: 'webspeech', label: 'Web Speech' },
      { id: 'kokoro', label: 'Kokoro' },
      { id: 'elevenlabs', label: 'ElevenLabs' },
      { id: 'gemini', label: 'Gemini' },
    ],
    [],
  );

  if (!open) {
    return null;
  }

  return (
    <div className="tts-modal" role="dialog" aria-modal="true" aria-label="TTS Settings">
      <div className="tts-panel">
        <div className="tts-head">
          <div>
            <p className="tts-kicker">Audio Settings</p>
            <h3>TTS Provider</h3>
          </div>
          <button className="tts-close" onClick={onClose} aria-label="Close settings">
            <X size={15} />
          </button>
        </div>

        <div className="tts-provider-picker" role="tablist" aria-label="Provider selection">
          {providerOptions.map((option) => (
            <button
              key={option.id}
              className={`tts-pill ${provider === option.id ? 'tts-pill--active' : ''}`}
              onClick={() => setProvider(option.id)}
              role="tab"
              aria-selected={provider === option.id}
            >
              {option.label}
            </button>
          ))}
        </div>

        <ProviderConfig
          provider={provider}
          cacheSizeLabel={cacheSize}
          onCheckKokoro={checkKokoroConnection}
          onValidateElevenLabs={validateElevenLabsKey}
          onValidateGemini={validateGeminiKey}
          onLoadElevenLabsVoices={getElevenLabsVoices}
          onClearCache={async () => {
            await clearAudioCache();
            const size = await getCacheSizeBytes();
            setCacheSize(formatBytes(size));
          }}
        />
      </div>

      <style>{`
        .tts-modal {
          position: fixed;
          inset: 0;
          z-index: 180;
          background: rgba(11, 9, 6, 0.6);
          backdrop-filter: blur(6px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
        }

        .tts-panel {
          width: min(860px, 100%);
          max-height: min(90vh, 860px);
          overflow: auto;
          background: var(--panel);
          border: 1px solid var(--line);
          border-radius: 8px;
          padding: 1.25rem;
        }

        .tts-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 1rem;
          margin-bottom: 1.25rem;
        }

        .tts-head h3 {
          color: var(--ink);
          font-size: 1.3rem;
        }

        .tts-kicker {
          font-family: var(--mono);
          text-transform: uppercase;
          font-size: 0.625rem;
          letter-spacing: 0.14em;
          color: var(--muted);
          margin-bottom: 0.35rem;
        }

        .tts-close {
          background: none;
          border: 1px solid var(--line);
          border-radius: 4px;
          color: var(--muted);
          width: 30px;
          height: 30px;
          display: grid;
          place-items: center;
          cursor: pointer;
          transition: color 150ms ease, border-color 150ms ease;
        }

        .tts-close:hover {
          color: var(--ink);
          border-color: var(--line-strong);
        }

        .tts-provider-picker {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 1.25rem;
          flex-wrap: wrap;
        }

        .tts-pill {
          background: transparent;
          border: 1px solid var(--line);
          border-radius: 4px;
          color: var(--muted);
          padding: 0.4rem 0.8rem;
          font-family: var(--mono);
          font-size: 0.625rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          cursor: pointer;
          transition: background 150ms ease, color 150ms ease, border-color 150ms ease;
        }

        .tts-pill:hover:not(.tts-pill--active) {
          background: var(--panel-2);
          color: var(--ink);
        }

        .tts-pill--active {
          background: var(--ink);
          color: var(--bg);
          border-color: var(--ink);
        }

        .provider-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.8rem;
        }

        .provider-card {
          background: var(--panel-2);
          border: 1px solid var(--line);
          border-radius: 6px;
          padding: 0.9rem;
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
        }

        .provider-card--full {
          grid-column: 1 / -1;
        }

        .provider-title {
          font-family: var(--mono);
          font-size: 0.625rem;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: var(--muted);
        }

        .provider-meta,
        .provider-status {
          font-family: var(--mono);
          font-size: 0.6875rem;
          color: var(--muted);
        }

        .provider-actions {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .provider-card label {
          display: flex;
          flex-direction: column;
          gap: 0.3rem;
          font-family: var(--mono);
          font-size: 0.6875rem;
          color: var(--muted);
        }

        .provider-card input,
        .provider-card select,
        .provider-card textarea {
          border: 1px solid var(--line);
          border-radius: 4px;
          background: var(--bg);
          color: var(--ink);
          font-family: var(--mono);
          font-size: 0.72rem;
          padding: 0.4rem 0.5rem;
        }

        .provider-card input:focus-visible,
        .provider-card select:focus-visible,
        .provider-card textarea:focus-visible {
          outline: 2px solid var(--agent-a);
          outline-offset: 1px;
        }

        .provider-card textarea {
          resize: vertical;
          line-height: 1.45;
        }

        .provider-card button {
          border: 1px solid var(--line);
          border-radius: 4px;
          background: transparent;
          color: var(--muted);
          font-family: var(--mono);
          font-size: 0.72rem;
          padding: 0.4rem 0.65rem;
          width: fit-content;
          cursor: pointer;
          transition: background 150ms ease, color 150ms ease, border-color 150ms ease;
        }

        .provider-card button:hover:not(:disabled) {
          background: var(--panel);
          border-color: var(--line-strong);
          color: var(--ink);
        }

        .provider-card button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .provider-card input[type="range"] {
          background: transparent;
          border: none;
          border-radius: 0;
          padding: 0;
          accent-color: var(--agent-a);
        }

        @media (max-width: 768px) {
          .provider-grid {
            grid-template-columns: 1fr;
          }

          .tts-panel {
            max-height: 95vh;
          }
        }

        @media (max-width: 600px) {
          .tts-modal {
            padding: 0.75rem;
            align-items: flex-start;
            padding-top: 1.25rem;
          }

          /* iOS Safari zooms the page when a focused field is under 16px,
             which strands the panel off-screen mid-edit. */
          .provider-card input,
          .provider-card select,
          .provider-card textarea {
            font-size: 1rem;
          }

          .provider-card input[type="range"] {
            height: 32px;
          }

          .provider-card button {
            min-height: 36px;
          }
        }
      `}</style>
    </div>
  );
};

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
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
        }

        .tts-panel {
          width: min(860px, 100%);
          max-height: min(90vh, 860px);
          overflow: auto;
          background: var(--bg-raised);
          border: 1px solid var(--border);
          padding: 1.1rem;
        }

        .tts-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 1rem;
          margin-bottom: 1rem;
        }

        .tts-head h3 {
          color: var(--text);
        }

        .tts-kicker {
          font-family: var(--font-mono);
          text-transform: uppercase;
          font-size: 0.62rem;
          letter-spacing: 0.05em;
          color: var(--text-muted);
          margin-bottom: 0.25rem;
        }

        .tts-close {
          background: none;
          border: 1px solid var(--border);
          color: var(--text-muted);
          width: 30px;
          height: 30px;
          display: grid;
          place-items: center;
          cursor: pointer;
          transition: color 150ms, border-color 150ms;
        }

        .tts-close:hover {
          color: var(--text);
          border-color: var(--border-emphasis);
        }

        .tts-provider-picker {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 1rem;
          flex-wrap: wrap;
        }

        .tts-pill {
          background: transparent;
          border: 1px solid var(--border);
          color: var(--text-muted);
          padding: 0.4rem 0.8rem;
          font-family: var(--font-mono);
          font-size: 0.65rem;
          text-transform: uppercase;
          cursor: pointer;
          transition: background 150ms, color 150ms;
        }

        .tts-pill:hover:not(.tts-pill--active) {
          background: rgba(255, 255, 255, 0.05);
        }

        .tts-pill--active {
          background: var(--text);
          color: var(--bg);
        }

        .provider-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.8rem;
        }

        .provider-card {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--border);
          padding: 0.75rem;
          display: flex;
          flex-direction: column;
          gap: 0.55rem;
        }

        .provider-card--full {
          grid-column: 1 / -1;
        }

        .provider-title {
          font-family: var(--font-mono);
          font-size: 0.66rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-muted);
        }

        .provider-meta,
        .provider-status {
          font-family: var(--font-mono);
          font-size: 0.7rem;
          color: var(--text-muted);
        }

        .provider-actions {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .provider-card label {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          font-family: var(--font-mono);
          font-size: 0.67rem;
          color: var(--text-muted);
        }

        .provider-card input,
        .provider-card select {
          border: 1px solid var(--border);
          background: var(--bg-inset);
          color: var(--text);
          font-family: var(--font-mono);
          font-size: 0.72rem;
          padding: 0.36rem 0.5rem;
        }

        .provider-card button {
          border: 1px solid var(--border);
          background: transparent;
          color: var(--text-muted);
          font-family: var(--font-mono);
          font-size: 0.72rem;
          padding: 0.36rem 0.5rem;
          width: fit-content;
          cursor: pointer;
          transition: background 150ms, color 150ms;
        }

        .provider-card button:hover:not(:disabled) {
          background: var(--border-emphasis);
          color: var(--text);
        }

        .provider-card button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .provider-card input[type="range"] {
          background: transparent;
          border: none;
          padding: 0;
          accent-color: var(--text-muted);
        }

        @media (max-width: 768px) {
          .provider-grid {
            grid-template-columns: 1fr;
          }

          .tts-panel {
            max-height: 95vh;
          }
        }
      `}</style>
    </div>
  );
};

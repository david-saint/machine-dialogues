import React, { useEffect, useMemo, useState } from 'react';
import { Settings2 } from 'lucide-react';
import type { AgentKey } from '../../lib/tts/types';
import { usePlaybackStore } from '../../stores/playback';
import type { Transcript } from '../../types/transcript';
import { useTTS } from '../../hooks/useTTS';
import { TTSSettingsPanel } from '../settings/TTSSettingsPanel';

interface PlaybackControlsProps {
  transcript: Transcript;
}

export const PlaybackControls: React.FC<PlaybackControlsProps> = ({ transcript }) => {
  const {
    isPlaying,
    isLoading,
    currentTurnIndex,
    speed,
    isMuted,
    setPlaying,
    setCurrentTurnIndex,
    setSpeed,
    nextTurn,
    prevTurn,
    setMuted,
  } = usePlaybackStore();
  const { speakTurn, stop, setPlaybackRate, provider } = useTTS();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const providerLabel = useMemo(() => {
    if (provider === 'webspeech') return 'Web Speech';
    if (provider === 'kokoro') return 'Kokoro';
    return 'ElevenLabs';
  }, [provider]);

  const getAgentKeyForTurn = (turnAgentName: string): AgentKey =>
    turnAgentName === transcript.agentA?.name ? 'agentA' : 'agentB';

  useEffect(() => {
    if (isPlaying && currentTurnIndex >= 0 && currentTurnIndex < transcript.turns.length) {
      const turn = transcript.turns[currentTurnIndex];

      if (!isMuted) {
        void speakTurn({
          turn,
          speed,
          agentKey: getAgentKeyForTurn(turn.agentName),
          onEnd: () => {
            if (currentTurnIndex < transcript.turns.length - 1) {
              nextTurn();
            } else {
              setPlaying(false);
            }
          },
        });
      }
    } else if (!isPlaying) {
      stop();
    }
  }, [isMuted, isPlaying, currentTurnIndex, nextTurn, setPlaying, speakTurn, speed, stop, transcript.turns]);

  useEffect(() => {
    setPlaybackRate(speed);
  }, [setPlaybackRate, speed]);

  useEffect(() => {
    return () => stop();
  }, [stop]);

  const togglePlay = () => {
    if (!isPlaying && currentTurnIndex === -1) {
      setCurrentTurnIndex(0);
    }
    setPlaying(!isPlaying);
  };

  const progress = transcript.turns.length > 0
    ? ((currentTurnIndex + 1) / transcript.turns.length) * 100
    : 0;

  return (
    <>
      <div className="playbar">
        <div className="playbar__inner">
        {/* Info */}
        <div className="playbar__info">
          <span className="playbar__status">
            {currentTurnIndex >= 0 ? `Turn ${transcript.turns[currentTurnIndex].turnNumber}` : 'Ready'}
          </span>
          <div className="playbar__progress">
            <div className="playbar__progress-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* Transport */}
        <div className="playbar__transport">
          <button
            className="playbar__btn"
            onClick={prevTurn}
            disabled={currentTurnIndex <= 0}
            aria-label="Previous turn"
          >
            &laquo;
          </button>
          <button
            className="playbar__btn playbar__btn--play"
            onClick={togglePlay}
            disabled={isLoading}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isLoading ? '...' : isPlaying ? '\u2016' : '\u25B6'}
          </button>
          <button
            className="playbar__btn"
            onClick={nextTurn}
            disabled={currentTurnIndex >= transcript.turns.length - 1}
            aria-label="Next turn"
          >
            &raquo;
          </button>
        </div>

        {/* Speed + Mute */}
        <div className="playbar__controls">
          <span className="playbar__provider-badge">{providerLabel}</span>
          <button
            className="playbar__btn playbar__btn--mute"
            onClick={() => setMuted(!isMuted)}
            aria-label={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? 'MUTED' : 'VOL'}
          </button>
          <div className="playbar__speed">
            {[1, 1.25, 1.5, 2].map(s => (
              <button
                key={s}
                className={`playbar__speed-btn ${speed === s ? 'playbar__speed-btn--active' : ''}`}
                onClick={() => setSpeed(s)}
              >
                {s}x
              </button>
            ))}
          </div>
          <button
            className="playbar__btn"
            onClick={() => setSettingsOpen(true)}
            aria-label="Open TTS settings"
          >
            <Settings2 size={14} />
          </button>
        </div>
      </div>

      <style>{`
        .playbar {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 100;
          background: var(--bg-raised);
          border-top: 1px solid var(--border-emphasis);
        }

        .playbar__inner {
          max-width: var(--container-max);
          margin: 0 auto;
          padding: 0.6rem var(--gutter);
          display: flex;
          align-items: center;
          gap: 2rem;
        }

        .playbar__info {
          flex: 1;
          min-width: 100px;
        }

        .playbar__status {
          font-family: var(--font-mono);
          font-size: 0.65rem;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--text-muted);
          display: block;
          margin-bottom: 0.25rem;
        }

        .playbar__progress {
          height: 3px;
          background: rgba(255, 255, 255, 0.08);
        }

        .playbar__progress-fill {
          height: 100%;
          background: var(--text-muted);
          transition: width 300ms ease;
        }

        .playbar__transport {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .playbar__btn {
          background: none;
          border: 1px solid var(--border);
          color: var(--text-muted);
          font-family: var(--font-mono);
          font-size: 0.75rem;
          padding: 0.35rem 0.65rem;
          cursor: pointer;
          transition: background 150ms, color 150ms;
          line-height: 1;
        }

        .playbar__btn:hover:not(:disabled) {
          background: var(--border-emphasis);
          color: var(--text);
        }

        .playbar__btn:disabled {
          opacity: 0.25;
          cursor: not-allowed;
        }

        .playbar__btn--play {
          font-size: 0.9rem;
          padding: 0.35rem 0.85rem;
        }

        .playbar__btn--mute {
          font-size: 0.6rem;
          letter-spacing: 0.06em;
        }

        .playbar__controls {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .playbar__provider-badge {
          font-family: var(--font-mono);
          font-size: 0.6rem;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--text-muted);
          border: 1px solid var(--border);
          padding: 0.28rem 0.42rem;
          background: rgba(255, 255, 255, 0.03);
        }

        .playbar__speed {
          display: flex;
          gap: 0;
        }

        .playbar__speed-btn {
          background: none;
          border: 1px solid var(--border);
          border-left: none;
          color: var(--text-muted);
          font-family: var(--font-mono);
          font-size: 0.6rem;
          padding: 0.3rem 0.5rem;
          cursor: pointer;
          transition: background 150ms, color 150ms;
        }

        .playbar__speed-btn:first-child {
          border-left: 1px solid var(--border);
        }

        .playbar__speed-btn--active {
          background: var(--text);
          color: var(--bg);
          border-color: var(--text);
        }

        .playbar__speed-btn:hover:not(.playbar__speed-btn--active) {
          background: rgba(255, 255, 255, 0.05);
        }

        @media (max-width: 600px) {
          .playbar__info,
          .playbar__controls {
            display: none;
          }

          .playbar__inner {
            justify-content: center;
          }
        }
      `}</style>
      </div>

      <TTSSettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
};

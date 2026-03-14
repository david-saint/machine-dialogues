import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import transcriptsData from '../../data/transcripts.json';
import type { Transcript } from '../../types/transcript';
import { MessageBubble } from './MessageBubble';
import { SystemPromptReveal } from './SystemPromptReveal';
import { ConversionMeter } from './ConversionMeter';
import { EvaluationSummary } from './EvaluationSummary';
import { PlaybackControls } from '../audio/PlaybackControls';
import { ImageModal } from '../shared/ImageModal';
import { usePlaybackStore } from '../../stores/playback';

const getAgentColor = (name: string): string => {
  const lower = name.toLowerCase();
  if (lower.includes('claude')) return 'var(--accent-claude)';
  if (lower.includes('gemini')) return 'var(--accent-gemini)';
  if (lower.includes('gpt')) return 'var(--accent-gpt)';
  return 'var(--text)';
};

export const TranscriptViewer: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [modalImage, setModalImage] = useState<{ src: string; alt: string } | null>(null);
  const { currentTurnIndex, highlightPosition, setCurrentTurnIndex, setPlaying } = usePlaybackStore();

  useEffect(() => {
    const found = (transcriptsData as Transcript[]).find(t => t.id === id);
    if (found) {
      setTranscript(found);
      window.scrollTo(0, 0);
      setCurrentTurnIndex(-1);
      setPlaying(false);
    }
  }, [id, setCurrentTurnIndex, setPlaying]);

  useEffect(() => {
    if (currentTurnIndex >= 0) {
      const element = document.querySelector(`[data-turn="${currentTurnIndex + 1}"]`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [currentTurnIndex]);

  if (!transcript) {
    return (
      <div className="container" style={{ paddingTop: '6rem' }}>
        <p className="label">Loading...</p>
      </div>
    );
  }

  const agentA = transcript.agentA || { name: 'Agent A', model: '', provider: '', color: '#d43a2c' };
  const agentB = transcript.agentB || { name: 'Agent B', model: '', provider: '', color: '#1a56db' };

  return (
    <div className="viewer">
      {/* Navigation */}
      <nav className="viewer__nav container">
        <Link to="/" className="viewer__back">
          <span aria-hidden="true">&larr;</span> Back
        </Link>
      </nav>

      {/* Header */}
      <header className="viewer__header">
        <div className="container">
          <div className="viewer__header-rule" />
          <h1>{transcript.experimentName}</h1>
          
          <div className="viewer__meta">
            <span>{new Date(transcript.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
            <span>{transcript.turnsCount} turns</span>
            {transcript.totalCost !== undefined && (
              <span>${transcript.totalCost.toFixed(4)} total cost</span>
            )}
          </div>

          {/* Face-off avatar layout */}
          <div className="viewer__faceoff">
            <div className="viewer__agent-side">
              {agentA.avatar ? (
                <img
                  src={agentA.avatar}
                  alt={agentA.name}
                  className="viewer__avatar"
                  onClick={() => setModalImage({ src: agentA.avatar!, alt: agentA.name })}
                  style={{ borderColor: getAgentColor(agentA.name) }}
                />
              ) : (
                <div
                  className="viewer__avatar viewer__avatar--placeholder"
                  style={{ borderColor: getAgentColor(agentA.name) }}
                />
              )}
              <span className="viewer__agent-name" style={{ color: getAgentColor(agentA.name) }}>{agentA.name}</span>
              <span className="viewer__agent-model">{agentA.model}</span>
            </div>

            <span className="viewer__vs">vs</span>

            <div className="viewer__agent-side">
              {agentB.avatar ? (
                <img
                  src={agentB.avatar}
                  alt={agentB.name}
                  className="viewer__avatar"
                  onClick={() => setModalImage({ src: agentB.avatar!, alt: agentB.name })}
                  style={{ borderColor: getAgentColor(agentB.name) }}
                />
              ) : (
                <div
                  className="viewer__avatar viewer__avatar--placeholder"
                  style={{ borderColor: getAgentColor(agentB.name) }}
                />
              )}
              <span className="viewer__agent-name" style={{ color: getAgentColor(agentB.name) }}>{agentB.name}</span>
              <span className="viewer__agent-model">{agentB.model}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Classified Objectives */}
      <section className="viewer__section container">
        <div className="viewer__section-rule" />
        {(agentA.systemPrompt || agentB.systemPrompt) && (
          <div className="viewer__prompts">
            {agentA.systemPrompt && (
              <SystemPromptReveal agentName={agentA.name} prompt={agentA.systemPrompt} />
            )}
            {agentB.systemPrompt && (
              <SystemPromptReveal agentName={agentB.name} prompt={agentB.systemPrompt} />
            )}
          </div>
        )}
      </section>

      {/* Self-Report */}
      {transcript.selfReport?.agentB && (
        <section className="viewer__section container">
          <div className="viewer__section-rule" />
          <h3 className="viewer__section-title">Final Self-Report</h3>
          <div className="viewer__self-report">
            <ConversionMeter 
              score={transcript.selfReport.agentB.score} 
              label={`${agentB.name} Position`} 
            />
            {transcript.selfReport.agentB.strongestArgument && (
              <div className="viewer__report-item">
                <span className="label">Strongest Argument</span>
                <p>{transcript.selfReport.agentB.strongestArgument}</p>
              </div>
            )}
            {transcript.selfReport.agentB.strongestObjection && (
              <div className="viewer__report-item">
                <span className="label">Remaining Objection</span>
                <p>{transcript.selfReport.agentB.strongestObjection}</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Transcript */}
      <section className="viewer__transcript container">
        <div className="viewer__section-rule" />
        <h3 className="viewer__section-title">Transcript</h3>
        
        <div className="viewer__turns">
          {transcript.turns.map((turn, index) => (
            <MessageBubble
              key={index}
              turn={turn}
              agent={turn.agentName === agentA.name ? agentA : agentB}
              isAgentA={turn.agentName === agentA.name}
              isActive={currentTurnIndex === index}
              highlightPosition={currentTurnIndex === index ? highlightPosition : null}
            />
          ))}
        </div>
      </section>

      {/* Evaluation */}
      {transcript.evaluation && (
        <section className="viewer__section container">
          <div className="viewer__section-rule" />
          <EvaluationSummary evaluation={transcript.evaluation} />
        </section>
      )}

      <PlaybackControls transcript={transcript} />

      {modalImage && (
        <ImageModal
          src={modalImage.src}
          alt={modalImage.alt}
          onClose={() => setModalImage(null)}
        />
      )}

      <style>{`
        .viewer {
          padding-bottom: 7rem;
        }

        .viewer__nav {
          padding-top: 2rem;
          padding-bottom: 2rem;
        }

        .viewer__back {
          font-family: var(--font-mono);
          font-size: 0.8rem;
          color: var(--text-muted);
          transition: color 150ms;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .viewer__back:hover {
          color: var(--text);
        }

        .viewer__header-rule {
          height: 2px;
          background: var(--border-emphasis);
          margin-bottom: 2rem;
        }

        .viewer__header h1 {
          margin-bottom: 1.5rem;
          font-size: clamp(2rem, 5vw, 4rem);
          color: var(--text);
        }

        .viewer__meta {
          display: flex;
          flex-wrap: wrap;
          gap: 1.5rem;
          font-family: var(--font-mono);
          font-size: 0.75rem;
          color: var(--text-muted);
          margin-bottom: 2.5rem;
          letter-spacing: 0.02em;
        }

        /* Face-off avatar layout */
        .viewer__faceoff {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 2.5rem;
          margin-bottom: 3rem;
          padding: 2rem 0;
        }

        .viewer__agent-side {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.75rem;
        }

        .viewer__avatar {
          width: 120px;
          height: 120px;
          object-fit: cover;
          border: 2px solid var(--border);
          display: block;
          background: var(--bg);
          cursor: pointer;
          transition: transform 0.2s ease, border-color 0.2s ease;
        }

        .viewer__avatar:hover {
          transform: scale(1.05);
          border-color: white !important;
        }

        .viewer__avatar--placeholder {
          background: var(--bg-inset);
          cursor: default;
        }

        .viewer__avatar--placeholder:hover {
          transform: none;
        }

        .viewer__agent-name {
          font-family: var(--font-body);
          font-weight: 700;
          font-size: 1rem;
        }

        .viewer__agent-model {
          font-family: var(--font-mono);
          font-size: 0.7rem;
          color: var(--text-muted);
        }

        .viewer__vs {
          font-family: var(--font-display);
          font-style: italic;
          font-size: 2rem;
          color: var(--text-faint);
        }

        .viewer__section {
          margin-bottom: 3rem;
        }

        .viewer__section-rule {
          height: 1px;
          background: var(--border);
          margin-bottom: 2rem;
        }

        .viewer__section-title {
          font-size: 1.5rem;
          margin-bottom: 2rem;
          color: var(--text);
        }

        .viewer__prompts {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .viewer__self-report {
          max-width: 600px;
        }

        .viewer__report-item {
          margin-bottom: 1.5rem;
        }

        .viewer__report-item .label {
          display: block;
          margin-bottom: 0.4rem;
        }

        .viewer__report-item p {
          font-size: 0.95rem;
          line-height: 1.6;
          color: var(--text-muted);
        }

        .viewer__transcript {
          margin-bottom: 3rem;
        }

        .viewer__turns {
          display: flex;
          flex-direction: column;
        }

        @media (max-width: 768px) {
          .viewer__faceoff {
            gap: 1.5rem;
          }

          .viewer__avatar {
            width: 80px;
            height: 80px;
          }

          .viewer__vs {
            font-size: 1.4rem;
          }
        }

        @media (max-width: 480px) {
          .viewer__faceoff {
            gap: 1rem;
          }

          .viewer__avatar {
            width: 64px;
            height: 64px;
          }
        }
      `}</style>
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import transcriptsData from '../../data/transcripts.json';
import judgmentsData from '../../data/judgments.json';
import type { Transcript } from '../../types/transcript';
import type { JudgmentsByTranscript } from '../../types/judgment';
import { MessageBubble } from './MessageBubble';
import { SystemPromptReveal } from './SystemPromptReveal';
import { ConversionMeter } from './ConversionMeter';
import { EvaluationSummary } from './EvaluationSummary';
import { JudgePanel } from './JudgePanel';
import { PlaybackControls } from '../audio/PlaybackControls';
import { ImageModal } from '../shared/ImageModal';
import { usePlaybackStore } from '../../stores/playback';
import { resolveAccent } from '../../lib/agentAccent';

export const TranscriptViewer: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [modalImage, setModalImage] = useState<{ src: string; alt: string } | null>(null);
  const { currentTurnIndex, highlightPosition, isPlaying, setCurrentTurnIndex, setPlaying, setMuted } = usePlaybackStore();

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
      const element = document.querySelector(`[data-index="${currentTurnIndex}"]`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

  const agentA = transcript.agentA || { name: 'Agent A', model: '', provider: '' };
  const agentB = transcript.agentB || { name: 'Agent B', model: '', provider: '' };

  // Model-based accents: a model keeps its hue across every debate; position is
  // carried by surface shade instead (agent B sits on a panel).
  const accentA = resolveAccent({ modelId: agentA.model, displayName: agentA.name, slot: 'agentA' });
  const accentB = resolveAccent({ modelId: agentB.model, displayName: agentB.name, slot: 'agentB' });
  const colorA = accentA.accent;
  const colorB = accentB.accent;

  // Resolve each turn's speaker by POSITION, not name. Same-model debates give
  // both sides an identical display name, so name matching cannot tell the
  // first speaker from the second. The harness pairs entries by turnNumber —
  // the first entry with a given turnNumber is agent A, the second is agent B
  // (turnNumber 0 is the researcher's opening prompt).
  const seenTurnNumbers = new Set<number>();
  const turnSlots = transcript.turns.map((turn): 'researcher' | 'agentA' | 'agentB' => {
    if (turn.turnNumber === 0) return 'researcher';
    if (!seenTurnNumbers.has(turn.turnNumber)) {
      seenTurnNumbers.add(turn.turnNumber);
      return 'agentA';
    }
    return 'agentB';
  });

  // Judgments are keyed by transcript filename (with .md extension).
  const judgments = (judgmentsData as JudgmentsByTranscript)[`${transcript.id}.md`] ?? [];

  // Clicking a turn's play button jumps narration there; on the turn that is
  // already current it toggles pause/resume instead. An explicit "play this
  // turn" also unmutes — muted playback halts entirely, which would make the
  // button appear dead.
  const handlePlayFromTurn = (index: number) => {
    if (index === currentTurnIndex) {
      if (!isPlaying) setMuted(false);
      setPlaying(!isPlaying);
      return;
    }
    setMuted(false);
    setCurrentTurnIndex(index);
    setPlaying(true);
  };

  return (
    <div className="viewer">
      {/* Navigation */}
      <nav className="viewer__nav container">
        <Link to="/" className="viewer__back">
          <span aria-hidden="true">&larr;</span> The Archive
        </Link>
      </nav>

      {/* Header */}
      <header className="viewer__header">
        <div className="container">
          <p className="eyebrow viewer__eyebrow">
            Machine Dialogues · Transcript ·{' '}
            {new Date(transcript.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
          <h1>{transcript.title || transcript.experimentName}</h1>
          {transcript.title && (
            <p className="viewer__subtitle">{transcript.experimentName}</p>
          )}

          {/* Matchup avatars */}
          <div className="viewer__faceoff">
            <div className="viewer__agent-side">
              {agentA.avatar ? (
                <img
                  src={agentA.avatar}
                  alt={agentA.name}
                  className="viewer__avatar"
                  onClick={() => setModalImage({ src: agentA.avatar!, alt: agentA.name })}
                  style={{ borderColor: colorA }}
                />
              ) : (
                <div className="viewer__avatar viewer__avatar--placeholder" style={{ borderColor: colorA }} />
              )}
              <span className="viewer__agent-name" style={{ color: colorA }}>{agentA.name}</span>
              <span className="viewer__agent-model">{agentA.model}</span>
              <span className="viewer__slot-note">A · speaks first</span>
            </div>

            <span className="viewer__vs">vs</span>

            <div className="viewer__agent-side viewer__agent-side--b">
              {agentB.avatar ? (
                <img
                  src={agentB.avatar}
                  alt={agentB.name}
                  className="viewer__avatar"
                  onClick={() => setModalImage({ src: agentB.avatar!, alt: agentB.name })}
                  style={{ borderColor: colorB }}
                />
              ) : (
                <div className="viewer__avatar viewer__avatar--placeholder" style={{ borderColor: colorB }} />
              )}
              <span className="viewer__agent-name" style={{ color: colorB }}>{agentB.name}</span>
              <span className="viewer__agent-model">{agentB.model}</span>
              <span className="viewer__slot-note">B · speaks second</span>
            </div>
          </div>

          <div className="viewer__meta">
            <span>{transcript.turnsCount} turns</span>
            {transcript.totalCost !== undefined && (
              <>
                <span aria-hidden="true">·</span>
                <span>${transcript.totalCost.toFixed(4)} total</span>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Directives */}
      {(agentA.systemPrompt || agentB.systemPrompt) && (
        <section className="viewer__section container">
          <div className="viewer__section-rule" />
          <p className="eyebrow viewer__section-eyebrow">Setup</p>
          <h3 className="viewer__section-title">The assignment</h3>
          <div className="viewer__prompts">
            {agentA.systemPrompt && (
              <SystemPromptReveal agentName={agentA.name} prompt={agentA.systemPrompt} slot="agentA" model={agentA.model} />
            )}
            {agentB.systemPrompt && (
              <SystemPromptReveal agentName={agentB.name} prompt={agentB.systemPrompt} slot="agentB" model={agentB.model} />
            )}
          </div>
        </section>
      )}

      {/* Self-Report */}
      {transcript.selfReport?.agentB && (
        <section className="viewer__section container">
          <div className="viewer__section-rule" />
          <p className="eyebrow viewer__section-eyebrow">Aftermath</p>
          <h3 className="viewer__section-title">Final self-report</h3>
          <div className="viewer__self-report">
            <ConversionMeter
              score={transcript.selfReport.agentB.score}
              label={`${agentB.name} Position`}
              accent={colorB}
              lowLabel={transcript.selfReportAxis?.low}
              highLabel={transcript.selfReportAxis?.high}
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
        <p className="eyebrow viewer__section-eyebrow">The exchange</p>
        <h3 className="viewer__section-title">Transcript</h3>

        <div className="viewer__turns">
          {transcript.turns.map((turn, index) => {
            const slot = turnSlots[index];
            const isAgentA = slot !== 'agentB';
            return (
              <MessageBubble
                key={index}
                index={index}
                turn={turn}
                agent={slot === 'agentB' ? agentB : agentA}
                isAgentA={isAgentA}
                isActive={currentTurnIndex === index}
                isPlaying={isPlaying}
                highlightPosition={currentTurnIndex === index ? highlightPosition : null}
                onPlayFromHere={() => handlePlayFromTurn(index)}
              />
            );
          })}
        </div>
      </section>

      {/* Judge's Report */}
      {judgments.length > 0 && (
        <section className="viewer__section container">
          <div className="viewer__section-rule" />
          <JudgePanel judgments={judgments} agentA={agentA} agentB={agentB} />
        </section>
      )}

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
          padding-bottom: 1.75rem;
        }

        .viewer__back {
          font-family: var(--mono);
          font-size: 0.6875rem;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--muted);
          transition: color 150ms ease;
        }

        .viewer__back:hover {
          color: var(--ink);
        }

        .viewer__eyebrow {
          display: block;
          margin-bottom: 0.85rem;
        }

        .viewer__header h1 {
          margin-bottom: 1rem;
          font-size: clamp(1.9rem, 5.5vw, 2.9rem);
          line-height: 1.12;
        }

        .viewer__subtitle {
          font-family: var(--mono);
          font-size: 0.75rem;
          line-height: 1.5;
          color: var(--muted);
          margin-bottom: 1.5rem;
        }

        /* Matchup */
        .viewer__faceoff {
          display: flex;
          align-items: flex-start;
          justify-content: center;
          gap: 2rem;
          margin: 2rem 0 1.5rem;
          padding: 1.75rem 0;
          border-top: 1px solid var(--line);
          border-bottom: 1px solid var(--line);
        }

        .viewer__agent-side {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.55rem;
          text-align: center;
          max-width: 42%;
          padding: 0.85rem 0.95rem 0.95rem;
          border: 1px solid transparent;
          border-radius: 6px;
        }

        /* Same A-on-ground / B-on-panel surface logic as the transcript turns. */
        .viewer__agent-side--b {
          background: var(--panel);
          border-color: var(--line);
        }

        .viewer__avatar {
          width: 92px;
          height: 92px;
          object-fit: cover;
          border: 1px solid var(--line);
          border-radius: 5px;
          display: block;
          background: var(--panel);
          cursor: pointer;
          transition: transform 0.2s ease;
        }

        .viewer__avatar:hover {
          transform: translateY(-2px);
        }

        .viewer__avatar--placeholder {
          background: var(--panel-2);
          cursor: default;
        }

        .viewer__avatar--placeholder:hover {
          transform: none;
        }

        .viewer__agent-name {
          font-family: var(--serif);
          font-weight: 700;
          font-size: 1rem;
          line-height: 1.2;
          letter-spacing: -0.01em;
        }

        .viewer__agent-model {
          font-family: var(--mono);
          font-size: 0.625rem;
          letter-spacing: 0.02em;
          color: var(--muted);
        }

        .viewer__slot-note {
          font-family: var(--mono);
          font-size: 0.5625rem;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--faint);
          margin-top: 0.2rem;
        }

        .viewer__vs {
          font-family: var(--mono);
          font-size: 0.6875rem;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--faint);
          margin-top: 3.2rem;
        }

        .viewer__meta {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 0.6rem;
          justify-content: center;
          font-family: var(--mono);
          font-size: 0.6875rem;
          letter-spacing: 0.04em;
          color: var(--muted);
        }

        .viewer__section {
          margin-bottom: 3rem;
        }

        .viewer__section-rule {
          height: 1px;
          background: var(--line);
          margin-bottom: 1.75rem;
        }

        .viewer__section-eyebrow {
          display: block;
          margin-bottom: 0.5rem;
        }

        .viewer__section-title {
          font-size: 1.4rem;
          margin-bottom: 1.75rem;
        }

        .viewer__prompts {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .viewer__self-report {
          max-width: var(--measure);
        }

        .viewer__report-item {
          margin-bottom: 1.5rem;
        }

        .viewer__report-item .label {
          display: block;
          margin-bottom: 0.45rem;
        }

        .viewer__report-item p {
          font-size: 0.95rem;
          line-height: 1.6;
          color: var(--ink);
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
            gap: 1.25rem;
          }

          .viewer__avatar {
            width: 72px;
            height: 72px;
          }

          .viewer__vs {
            margin-top: 2.7rem;
          }
        }

        /* Matches the playbar's own breakpoint, where it wraps onto extra
           rows and needs more clearance under the transcript. */
        @media (max-width: 600px) {
          .viewer {
            padding-bottom: 10rem;
          }
        }

        @media (max-width: 480px) {
          .viewer__faceoff {
            gap: 0.9rem;
          }

          .viewer__avatar {
            width: 60px;
            height: 60px;
          }
        }
      `}</style>
    </div>
  );
};

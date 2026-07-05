import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Transcript } from '../../types/transcript';
import { resolveAccent } from '../../lib/agentAccent';
import { ImageModal } from '../shared/ImageModal';

interface TranscriptCardProps {
  transcript: Transcript;
  featured?: boolean;
}

export const TranscriptCard: React.FC<TranscriptCardProps> = ({ transcript, featured }) => {
  const [modalImage, setModalImage] = useState<{ src: string; alt: string } | null>(null);

  const agentA = transcript.agentA || { name: 'Unknown', model: '' };
  const agentB = transcript.agentB || { name: 'Unknown', model: '' };

  // Model-true hues; at card scale position stays hue-only (a shaded band per
  // side would be noisy in a dense grid).
  const colorA = resolveAccent({ modelId: agentA.model, displayName: agentA.name, slot: 'agentA' }).accent;
  const colorB = resolveAccent({ modelId: agentB.model, displayName: agentB.name, slot: 'agentB' }).accent;

  const handleAvatarClick = (e: React.MouseEvent, src: string, alt: string) => {
    e.preventDefault();
    e.stopPropagation();
    setModalImage({ src, alt });
  };

  return (
    <>
      <Link
        to={`/transcript/${transcript.id}`}
        className={`tcard${featured ? ' tcard--featured' : ''}`}
      >
        <div className="tcard__matchup">
          <div className="tcard__agent-group">
            {agentA.avatar && (
              <img
                src={agentA.avatar}
                alt={agentA.name}
                className="tcard__avatar"
                style={{ borderColor: colorA }}
                onClick={(e) => handleAvatarClick(e, agentA.avatar!, agentA.name)}
              />
            )}
            <span className="tcard__agent" style={{ color: colorA }}>{agentA.name}</span>
          </div>
          <span className="tcard__vs">vs</span>
          <div className="tcard__agent-group">
            {agentB.avatar && (
              <img
                src={agentB.avatar}
                alt={agentB.name}
                className="tcard__avatar"
                style={{ borderColor: colorB }}
                onClick={(e) => handleAvatarClick(e, agentB.avatar!, agentB.name)}
              />
            )}
            <span className="tcard__agent" style={{ color: colorB }}>{agentB.name}</span>
          </div>
        </div>

        <p className="tcard__experiment">{transcript.title || transcript.experimentName}</p>
        {transcript.title && (
          <p className="tcard__subtitle">{transcript.experimentName}</p>
        )}

        <div className="tcard__meta">
          <span>{new Date(transcript.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          <span aria-hidden="true">·</span>
          <span>{transcript.turnsCount} turns</span>
          {transcript.totalCost !== undefined && (
            <>
              <span aria-hidden="true">·</span>
              <span>${transcript.totalCost.toFixed(2)}</span>
            </>
          )}
          {transcript.evaluation && (
            <span className="tcard__eval-badge">Evaluated</span>
          )}
        </div>

        <style>{`
          .tcard {
            display: flex;
            flex-direction: column;
            gap: 0.7rem;
            border: 1px solid var(--line);
            border-radius: 5px;
            background: var(--panel);
            padding: 1.15rem 1.25rem 1.2rem;
            transition: border-color 150ms ease, background 150ms ease;
            text-decoration: none;
            color: var(--ink);
          }

          .tcard:hover {
            border-color: var(--line-strong);
            background: var(--panel-2);
          }

          .tcard__matchup {
            display: flex;
            align-items: center;
            gap: 0.55rem;
            flex-wrap: wrap;
          }

          .tcard__agent-group {
            display: flex;
            align-items: center;
            gap: 0.5rem;
          }

          .tcard__avatar {
            width: 30px;
            height: 30px;
            object-fit: cover;
            border: 1px solid var(--line);
            border-radius: 4px;
            flex-shrink: 0;
            cursor: pointer;
            transition: transform 0.15s ease;
          }

          .tcard__avatar:hover {
            transform: translateY(-1px);
          }

          .tcard__agent {
            font-family: var(--mono);
            font-size: 0.8125rem;
            font-weight: 600;
            letter-spacing: 0.01em;
          }

          .tcard__vs {
            font-family: var(--mono);
            font-size: 0.6875rem;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            color: var(--faint);
          }

          .tcard__experiment {
            font-family: var(--serif);
            font-size: 1.15rem;
            font-weight: 700;
            line-height: 1.25;
            letter-spacing: -0.01em;
            text-wrap: balance;
            color: var(--ink);
          }

          .tcard__subtitle {
            font-family: var(--mono);
            font-size: 0.6875rem;
            line-height: 1.5;
            color: var(--muted);
            margin-top: -0.25rem;
          }

          .tcard__meta {
            display: flex;
            align-items: center;
            gap: 0.55rem;
            flex-wrap: wrap;
            font-family: var(--mono);
            font-size: 0.6875rem;
            color: var(--muted);
            letter-spacing: 0.02em;
            margin-top: auto;
          }

          .tcard__eval-badge {
            margin-left: 0.15rem;
            border: 1px solid var(--line);
            border-radius: 3px;
            padding: 0.05em 0.45em;
            font-size: 0.5625rem;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            color: var(--muted);
          }

          /* ---- Featured ---- */

          .tcard--featured {
            background: var(--panel);
            padding: 1.4rem 1.5rem 1.5rem;
          }

          .tcard--featured .tcard__avatar {
            width: 40px;
            height: 40px;
          }

          .tcard--featured .tcard__agent {
            font-size: 0.9375rem;
          }

          .tcard--featured .tcard__experiment {
            font-size: 1.5rem;
          }
        `}</style>
      </Link>

      {modalImage && (
        <ImageModal
          src={modalImage.src}
          alt={modalImage.alt}
          onClose={() => setModalImage(null)}
        />
      )}
    </>
  );
};

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Transcript } from '../../types/transcript';
import { ImageModal } from '../shared/ImageModal';

interface TranscriptCardProps {
  transcript: Transcript;
  featured?: boolean;
}

const getAgentColor = (name: string): string => {
  const lower = name.toLowerCase();
  if (lower.includes('claude')) return 'var(--accent-claude)';
  if (lower.includes('gemini')) return 'var(--accent-gemini)';
  if (lower.includes('gpt')) return 'var(--accent-gpt)';
  return 'var(--text-faint)';
};

export const TranscriptCard: React.FC<TranscriptCardProps> = ({ transcript, featured }) => {
  const [modalImage, setModalImage] = useState<{ src: string; alt: string } | null>(null);

  const agentA = transcript.agentA || { name: 'Unknown', model: '' };
  const agentB = transcript.agentB || { name: 'Unknown', model: '' };
  const accentColor = getAgentColor(agentA.name);

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
        style={{ '--card-accent': accentColor } as React.CSSProperties}
      >
        <div className="tcard__stripe" style={{ background: featured ? `linear-gradient(90deg, ${accentColor}, var(--text), ${accentColor})` : accentColor }} />
        
        <div className="tcard__body">
          {featured && <span className="tcard__featured-badge">Featured</span>}
          <div className="tcard__matchup">
            <div className="tcard__agent-group">
              {agentA.avatar && (
                <img 
                  src={agentA.avatar} 
                  alt={agentA.name} 
                  className="tcard__avatar" 
                  onClick={(e) => handleAvatarClick(e, agentA.avatar!, agentA.name)}
                />
              )}
              <span className="tcard__agent" style={{ color: getAgentColor(agentA.name) }}>{agentA.name}</span>
            </div>
            <span className="tcard__vs">vs</span>
            <div className="tcard__agent-group">
              {agentB.avatar && (
                <img 
                  src={agentB.avatar} 
                  alt={agentB.name} 
                  className="tcard__avatar" 
                  onClick={(e) => handleAvatarClick(e, agentB.avatar!, agentB.name)}
                />
              )}
              <span className="tcard__agent" style={{ color: getAgentColor(agentB.name) }}>{agentB.name}</span>
            </div>
          </div>

          <p className="tcard__experiment">{transcript.experimentName}</p>

          <div className="tcard__meta">
            <span>{new Date(transcript.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            <span>{transcript.turnsCount} turns</span>
            {transcript.totalCost !== undefined && (
              <span>${transcript.totalCost.toFixed(2)}</span>
            )}
            {transcript.evaluation && (
              <span className="tcard__eval-badge">Evaluated</span>
            )}
          </div>
        </div>

        <style>{`
          .tcard {
            display: block;
            border: 1px solid var(--border);
            border-top: none;
            background: var(--bg-raised);
            transition: border-color 150ms, background 150ms;
            text-decoration: none;
            color: var(--text);
          }

          .tcard:first-child {
            border-top: 1px solid var(--border);
          }

          .tcard__stripe {
            height: 4px;
            width: 100%;
          }

          .tcard:hover {
            border-color: var(--card-accent);
            background: var(--bg-inset);
          }

          .tcard__body {
            padding: 1.25rem 1.5rem 1.5rem;
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
          }

          .tcard__matchup {
            display: flex;
            align-items: center;
            gap: 0.6rem;
            flex-wrap: wrap;
          }

          .tcard__agent-group {
            display: flex;
            align-items: center;
            gap: 0.5rem;
          }

          .tcard__avatar {
            width: 32px;
            height: 32px;
            object-fit: cover;
            border: 1px solid var(--border);
            flex-shrink: 0;
            cursor: pointer;
            transition: transform 0.2s ease, border-color 0.2s ease;
          }

          .tcard__avatar:hover {
            transform: scale(1.15);
            border-color: white;
            z-index: 10;
          }

          .tcard__agent {
            font-family: var(--font-mono);
            font-size: 0.85rem;
            font-weight: 400;
          }

          .tcard__vs {
            font-family: var(--font-display);
            font-style: italic;
            font-size: 0.9rem;
            color: var(--text-faint);
          }

          .tcard__experiment {
            font-family: var(--font-body);
            font-size: 0.95rem;
            font-weight: 600;
            line-height: 1.3;
          }

          .tcard__meta {
            display: flex;
            gap: 1rem;
            font-family: var(--font-mono);
            font-size: 0.7rem;
            color: var(--text-muted);
            letter-spacing: 0.02em;
          }

          .tcard__eval-badge {
            border: 1px solid var(--text-faint);
            padding: 0 0.4em;
            font-size: 0.65rem;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            color: var(--text-muted);
          }

          /* ---- Featured card ---- */

          .tcard--featured {
            border-color: var(--border-emphasis);
            background: var(--bg-inset);
            position: relative;
          }

          .tcard--featured .tcard__stripe {
            height: 6px;
          }

          .tcard--featured:hover {
            border-color: var(--text-muted);
            box-shadow: 0 0 30px rgba(255, 255, 255, 0.04);
          }

          .tcard--featured .tcard__avatar {
            width: 48px;
            height: 48px;
          }

          .tcard--featured .tcard__agent {
            font-size: 1rem;
          }

          .tcard--featured .tcard__vs {
            font-size: 1.1rem;
          }

          .tcard--featured .tcard__experiment {
            font-size: 1.15rem;
            font-family: var(--font-display);
            font-style: italic;
            font-weight: 400;
          }

          .tcard__featured-badge {
            font-family: var(--font-mono);
            font-size: 0.6rem;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            color: var(--text);
            background: rgba(255, 255, 255, 0.06);
            border: 1px solid var(--border-emphasis);
            padding: 0.15em 0.6em;
            align-self: flex-start;
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

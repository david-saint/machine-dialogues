import React from 'react';
import { Link } from 'react-router-dom';
import type { Transcript } from '../../types/transcript';

interface TranscriptCardProps {
  transcript: Transcript;
}

const getAgentColor = (name: string): string => {
  const lower = name.toLowerCase();
  if (lower.includes('claude')) return 'var(--accent-claude)';
  if (lower.includes('gemini')) return 'var(--accent-gemini)';
  if (lower.includes('gpt')) return 'var(--accent-gpt)';
  return 'var(--text-faint)';
};

export const TranscriptCard: React.FC<TranscriptCardProps> = ({ transcript }) => {
  const agentA = transcript.agentA || { name: 'Unknown', model: '' };
  const agentB = transcript.agentB || { name: 'Unknown', model: '' };
  const accentColor = getAgentColor(agentA.name);

  return (
    <Link
      to={`/transcript/${transcript.id}`}
      className="tcard"
      style={{ '--card-accent': accentColor } as React.CSSProperties}
    >
      <div className="tcard__stripe" style={{ background: accentColor }} />
      
      <div className="tcard__body">
        <div className="tcard__matchup">
          <div className="tcard__agent-group">
            {agentA.avatar && (
              <img src={agentA.avatar} alt="" className="tcard__avatar" />
            )}
            <span className="tcard__agent" style={{ color: getAgentColor(agentA.name) }}>{agentA.name}</span>
          </div>
          <span className="tcard__vs">vs</span>
          <div className="tcard__agent-group">
            {agentB.avatar && (
              <img src={agentB.avatar} alt="" className="tcard__avatar" />
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
      `}</style>
    </Link>
  );
};

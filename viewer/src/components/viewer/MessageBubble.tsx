import React, { useMemo, useState } from 'react';
import { marked } from 'marked';
import type { TranscriptTurn, AgentInfo } from '../../types/transcript';
import { ImageModal } from '../shared/ImageModal';

interface MessageBubbleProps {
  turn: TranscriptTurn;
  agent: AgentInfo;
  isAgentA: boolean;
  isActive?: boolean;
  highlightPosition?: { charIndex: number; charLength: number } | null;
  index: number;
}

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const buildHighlightedHtml = (
  content: string,
  highlightPosition: { charIndex: number; charLength: number } | null,
): string => {
  if (!highlightPosition) {
    return escapeHtml(content);
  }

  const start = Math.max(0, Math.min(content.length, highlightPosition.charIndex));
  const length = Math.max(0, highlightPosition.charLength);
  const end = Math.min(content.length, start + length);

  const before = escapeHtml(content.slice(0, start));
  const highlighted = escapeHtml(content.slice(start, end));
  const after = escapeHtml(content.slice(end));

  return `${before}<mark class="entry__highlight">${highlighted}</mark>${after}`;
};

const getAgentColor = (name: string): string => {
  const lower = name.toLowerCase();
  if (lower.includes('claude')) return 'var(--accent-claude)';
  if (lower.includes('gemini')) return 'var(--accent-gemini)';
  if (lower.includes('gpt')) return 'var(--accent-gpt)';
  return 'var(--text)';
};

const getAgentGlow = (name: string): string => {
  const lower = name.toLowerCase();
  if (lower.includes('claude')) return 'var(--glow-claude)';
  if (lower.includes('gemini')) return 'var(--glow-gemini)';
  if (lower.includes('gpt')) return 'var(--glow-gpt)';
  return 'none';
};

const getAgentTint = (name: string): string => {
  const lower = name.toLowerCase();
  if (lower.includes('claude')) return 'rgba(212, 165, 116, 0.04)';
  if (lower.includes('gemini')) return 'rgba(126, 184, 218, 0.04)';
  if (lower.includes('gpt')) return 'rgba(58, 191, 122, 0.04)';
  return 'transparent';
};

export const MessageBubble: React.FC<MessageBubbleProps> = ({ turn, agent, isActive, highlightPosition, index }) => {
  const [showModal, setShowModal] = useState(false);
  const isResearcher = turn.turnNumber === 0;
  
  const researcherAvatar = '/avatars/human-researcher.png';
  const displayAvatar = isResearcher ? researcherAvatar : agent.avatar;
  const displayName = isResearcher ? 'Researcher' : agent.name;
  const accentColor = isResearcher ? '#d1d1d1' : getAgentColor(agent.name);
  const displayGlow = isResearcher ? '0 0 15px rgba(209, 209, 209, 0.3)' : getAgentGlow(agent.name);
  const displayTint = isResearcher ? 'rgba(209, 209, 209, 0.04)' : getAgentTint(agent.name);

  const htmlContent = useMemo(() => {
    if (isActive && highlightPosition) {
      return buildHighlightedHtml(turn.content, highlightPosition);
    }
    if (!turn.content) return '';
    try {
      return marked.parse(turn.content) as string;
    } catch (e) {
      console.error('Marked parsing error:', e);
      return turn.content;
    }
  }, [highlightPosition, isActive, turn.content]);

  const thinkingHtml = useMemo(() => {
    if (!turn.thinking) return '';
    try {
      return marked.parse(turn.thinking) as string;
    } catch {
      return turn.thinking;
    }
  }, [turn.thinking]);


  return (
    <article
      className={`entry ${isActive ? 'entry--active' : ''}`}
      data-turn={turn.turnNumber}
      data-index={index}
      style={isActive ? {
        background: displayTint,
        borderLeft: `3px solid ${accentColor}`,
        scrollMarginTop: '100px',
      } : undefined}
    >
      <div className="entry__border" style={{ background: accentColor }} />
      
      <div className="entry__head">
        {!isResearcher && (
          <span className="entry__number" style={{ color: accentColor }}>
            {String(turn.turnNumber).padStart(2, '0')}
          </span>
        )}

        {displayAvatar && (
          <img
            src={displayAvatar}
            alt={displayName}
            className={`entry__avatar ${isActive ? 'entry__avatar--active' : ''}`}
            onClick={() => setShowModal(true)}
            style={{
              borderColor: accentColor,
              ...(isActive ? { boxShadow: displayGlow, animation: 'avatar-breathe 3s ease-in-out infinite' } : {}),
            }}
          />
        )}

        <div className="entry__attribution">
          <span className="entry__agent" style={{ color: accentColor }}>{displayName}</span>
          {!isResearcher && <span className="entry__model">{agent.model}</span>}
          {turn.timestamp && (
            <span className="entry__time">{new Date(turn.timestamp).toLocaleTimeString()}</span>
          )}
        </div>
      </div>

      {turn.thinking && (
        <details className="entry__thinking">
          <summary className="entry__thinking-summary">
            <span className="entry__thinking-icon">🧠</span>
            <span>Thinking</span>
          </summary>
          <div
            className="entry__thinking-content prose"
            dangerouslySetInnerHTML={{ __html: thinkingHtml }}
            style={{ borderLeftColor: accentColor }}
          />
        </details>
      )}

      <div
        className="entry__content prose"
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />

      {showModal && displayAvatar && (
        <ImageModal
          src={displayAvatar}
          alt={displayName}
          onClose={() => setShowModal(false)}
        />
      )}

      <style>{`
        .entry {
          position: relative;
          padding: 2rem 0 2rem 0;
          border-left: 3px solid transparent;
        }

        .entry__border {
          height: 2px;
          width: 100%;
          margin-bottom: 1.5rem;
        }

        .entry--active {
          margin-left: calc(var(--gutter) * -1);
          margin-right: calc(var(--gutter) * -1);
          padding-left: var(--gutter);
          padding-right: var(--gutter);
        }

        .entry__head {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 1.25rem;
        }

        .entry__number {
          font-family: var(--font-display);
          font-style: italic;
          font-size: 2.5rem;
          line-height: 1;
          letter-spacing: -0.03em;
          flex-shrink: 0;
        }

        .entry__avatar {
          width: 40px;
          height: 40px;
          object-fit: cover;
          border: 1px solid var(--border);
          flex-shrink: 0;
          display: block;
          background: var(--bg);
          cursor: pointer;
          transition: transform 0.2s ease, border-color 0.2s ease;
        }

        .entry__avatar:hover {
          transform: scale(1.1);
          border-color: white !important;
          z-index: 10;
        }

        .entry__avatar--active {
          border-width: 2px;
        }

        .entry__attribution {
          display: flex;
          align-items: baseline;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        .entry__agent {
          font-family: var(--font-body);
          font-weight: 700;
          font-size: 0.95rem;
        }

        .entry__model {
          font-family: var(--font-mono);
          font-size: 0.7rem;
          color: var(--text-muted);
        }

        .entry__time {
          font-family: var(--font-mono);
          font-size: 0.65rem;
          color: var(--text-faint);
        }

        .entry__thinking {
          margin-bottom: 1.25rem;
          padding-left: 4rem;
        }

        .entry__thinking-summary {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          cursor: pointer;
          user-select: none;
          font-size: 0.72rem;
          font-family: var(--font-mono);
          color: var(--text-muted);
          letter-spacing: 0.05em;
          text-transform: uppercase;
          list-style: none;
          outline: none;
          padding: 0.25rem 0;
          transition: color 0.15s ease;
        }

        .entry__thinking-summary::-webkit-details-marker {
          display: none;
        }

        .entry__thinking-summary:hover {
          color: var(--text);
        }

        .entry__thinking-icon {
          font-size: 0.85rem;
          opacity: 0.6;
        }

        .entry__thinking[open] .entry__thinking-summary {
          color: var(--text);
          margin-bottom: 0.75rem;
        }

        .entry__thinking-content {
          font-size: 0.82rem;
          font-style: italic;
          line-height: 1.65;
          color: var(--text-muted);
          padding: 0.75rem 1rem;
          border-left: 2px solid currentColor;
          background: rgba(255, 255, 255, 0.02);
          border-radius: 0 4px 4px 0;
        }

        .entry__thinking-content p:first-child { margin-top: 0; }
        .entry__thinking-content p:last-child  { margin-bottom: 0; }

        .entry__content {
          padding-left: 4rem;
          font-size: 0.95rem;
          line-height: 1.7;
          color: var(--text);
        }

        .entry__highlight {
          background: rgba(212, 165, 116, 0.25);
          color: inherit;
          padding: 0.08rem 0.1rem;
        }

        @media (max-width: 768px) {
          .entry__number {
            font-size: 1.8rem;
          }

          .entry__avatar {
            width: 32px;
            height: 32px;
          }

          .entry__content {
            padding-left: 0;
            margin-top: 0.5rem;
          }

          .entry--active {
            margin-left: -1rem;
            margin-right: -1rem;
            padding-left: 1rem;
            padding-right: 1rem;
          }
        }
      `}</style>
    </article>
  );
};

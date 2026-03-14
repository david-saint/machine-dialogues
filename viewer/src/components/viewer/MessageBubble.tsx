import React, { useMemo } from 'react';
import { marked } from 'marked';
import type { TranscriptTurn, AgentInfo } from '../../types/transcript';

interface MessageBubbleProps {
  turn: TranscriptTurn;
  agent: AgentInfo;
  isAgentA: boolean;
  isActive?: boolean;
  highlightPosition?: { charIndex: number; charLength: number } | null;
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

export const MessageBubble: React.FC<MessageBubbleProps> = ({ turn, agent, isActive, highlightPosition }) => {
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

  const accentColor = getAgentColor(agent.name);

  return (
    <article
      className={`entry ${isActive ? 'entry--active' : ''}`}
      data-turn={turn.turnNumber}
      style={isActive ? {
        background: getAgentTint(agent.name),
        borderLeft: `3px solid ${accentColor}`,
      } : undefined}
    >
      <div className="entry__border" style={{ background: accentColor }} />
      
      <div className="entry__head">
        <span className="entry__number" style={{ color: accentColor }}>
          {String(turn.turnNumber).padStart(2, '0')}
        </span>

        {agent.avatar && (
          <img
            src={agent.avatar}
            alt={agent.name}
            className={`entry__avatar ${isActive ? 'entry__avatar--active' : ''}`}
            style={{
              borderColor: accentColor,
              ...(isActive ? { boxShadow: getAgentGlow(agent.name), animation: 'avatar-breathe 3s ease-in-out infinite' } : {}),
            }}
          />
        )}

        <div className="entry__attribution">
          <span className="entry__agent" style={{ color: accentColor }}>{agent.name}</span>
          <span className="entry__model">{agent.model}</span>
          {turn.timestamp && (
            <span className="entry__time">{new Date(turn.timestamp).toLocaleTimeString()}</span>
          )}
        </div>
      </div>

      <div
        className="entry__content prose"
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />

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

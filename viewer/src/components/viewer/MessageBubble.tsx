import React, { useMemo, useState } from 'react';
import { marked } from 'marked';
import type { TranscriptTurn, AgentInfo } from '../../types/transcript';
import { resolveAccent } from '../../lib/agentAccent';
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

export const MessageBubble: React.FC<MessageBubbleProps> = ({ turn, agent, isAgentA, isActive, highlightPosition, index }) => {
  const [showModal, setShowModal] = useState(false);
  const isResearcher = turn.turnNumber === 0;

  const researcherAvatar = '/avatars/human-researcher.png';
  const displayAvatar = isResearcher ? researcherAvatar : agent.avatar;
  const displayName = isResearcher ? 'Researcher' : agent.name;
  // Color by MODEL (Claude warm, GPT teal, Gemini slate, Kimi plum); the
  // second speaker is set apart by a shaded surface, not a different hue.
  const family = resolveAccent({
    modelId: agent.model,
    displayName: agent.name,
    slot: isAgentA ? 'agentA' : 'agentB',
  });
  const accentColor = isResearcher ? 'var(--neutral)' : family.accent;
  const dimColor = isResearcher ? 'var(--neutral-dim)' : family.dim;
  // The second speaker (agent B) sits on a subtle panel; agent A stays on the
  // page ground. This keeps same-model debates unambiguous by position alone.
  const isShaded = !isResearcher && !isAgentA;

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
      className={`entry ${isResearcher ? 'entry--prompt' : ''} ${isShaded ? 'entry--shaded' : ''} ${isActive ? 'entry--active' : ''}`}
      data-turn={turn.turnNumber}
      data-index={index}
      style={
        {
          '--entry-accent': accentColor,
          ...(isActive ? { background: dimColor } : {}),
        } as React.CSSProperties
      }
    >
      <div className="entry__head">
        {displayAvatar && (
          <img
            src={displayAvatar}
            alt={displayName}
            className="entry__avatar"
            onClick={() => setShowModal(true)}
            style={{ borderColor: accentColor }}
          />
        )}

        <div className="entry__attribution">
          <span className="entry__eyebrow">
            {isResearcher ? 'The prompt' : `Turn ${String(turn.turnNumber).padStart(2, '0')} · ${isAgentA ? 'A' : 'B'}`}
          </span>
          <span className="entry__namerow">
            <span className="entry__agent" style={{ color: accentColor }}>{displayName}</span>
            {!isResearcher && agent.model && <span className="entry__model">{agent.model}</span>}
            {turn.timestamp && (
              <span className="entry__time">{new Date(turn.timestamp).toLocaleTimeString()}</span>
            )}
          </span>
        </div>
      </div>

      {turn.thinking && (
        <details className="entry__thinking">
          <summary className="entry__thinking-summary">
            <span className="entry__thinking-caret" aria-hidden="true" />
            <span>Thinking</span>
          </summary>
          <div
            className="entry__thinking-content prose"
            dangerouslySetInnerHTML={{ __html: thinkingHtml }}
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
          padding: 1.75rem 0 1.75rem;
          border-top: 1px solid var(--line);
        }

        .entry:first-child {
          border-top: none;
        }

        /* The researcher's opening prompt reads as a set-apart panel. */
        .entry--prompt {
          border-top: none;
          background: var(--panel);
          border: 1px solid var(--line);
          border-radius: 5px;
          padding: 1.5rem 1.5rem 1.25rem;
          margin-bottom: 0.5rem;
        }

        /* The second speaker sits on a quiet panel with hairline edges, so the
           first/second distinction survives even when both share one model hue. */
        .entry--shaded {
          border: 1px solid var(--line);
          border-radius: 5px;
          background: var(--panel);
          padding-left: 1.25rem;
          padding-right: 1.25rem;
          margin-top: 0.4rem;
          margin-bottom: 0.4rem;
        }

        .entry--active {
          border-radius: 5px;
          border-top-color: transparent;
          margin-left: calc(var(--gutter) * -1);
          margin-right: calc(var(--gutter) * -1);
          padding-left: var(--gutter);
          padding-right: var(--gutter);
          scroll-margin-top: 90px;
          box-shadow: inset 3px 0 0 var(--entry-accent);
        }

        .entry__head {
          display: flex;
          align-items: center;
          gap: 0.85rem;
          margin-bottom: 1.1rem;
        }

        .entry__avatar {
          width: 40px;
          height: 40px;
          object-fit: cover;
          border: 1px solid var(--line);
          border-radius: 4px;
          flex-shrink: 0;
          display: block;
          background: var(--panel);
          cursor: pointer;
          transition: transform 0.15s ease;
        }

        .entry__avatar:hover {
          transform: translateY(-1px);
        }

        .entry__attribution {
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
          min-width: 0;
        }

        .entry__eyebrow {
          font-family: var(--mono);
          font-size: 0.625rem;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--muted);
        }

        .entry__namerow {
          display: flex;
          align-items: baseline;
          gap: 0.65rem;
          flex-wrap: wrap;
        }

        .entry__agent {
          font-family: var(--serif);
          font-weight: 700;
          font-size: 1.05rem;
          letter-spacing: -0.01em;
        }

        .entry__model {
          font-family: var(--mono);
          font-size: 0.625rem;
          color: var(--muted);
        }

        .entry__time {
          font-family: var(--mono);
          font-size: 0.5625rem;
          color: var(--faint);
        }

        .entry__thinking {
          margin-bottom: 1.1rem;
        }

        .entry__thinking-summary {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          cursor: pointer;
          user-select: none;
          font-size: 0.625rem;
          font-family: var(--mono);
          color: var(--muted);
          letter-spacing: 0.14em;
          text-transform: uppercase;
          list-style: none;
          padding: 0.25rem 0;
          transition: color 0.15s ease;
        }

        .entry__thinking-summary::-webkit-details-marker {
          display: none;
        }

        .entry__thinking-summary:hover {
          color: var(--ink);
        }

        .entry__thinking-caret {
          width: 0;
          height: 0;
          border-left: 4px solid currentColor;
          border-top: 3px solid transparent;
          border-bottom: 3px solid transparent;
          transition: transform 0.15s ease;
        }

        .entry__thinking[open] .entry__thinking-caret {
          transform: rotate(90deg);
        }

        .entry__thinking[open] .entry__thinking-summary {
          color: var(--ink);
          margin-bottom: 0.65rem;
        }

        .entry__thinking-content {
          font-size: 0.9rem;
          font-style: italic;
          line-height: 1.6;
          color: var(--muted);
          padding: 0.8rem 1rem;
          border-left: 3px solid var(--entry-accent);
          background: var(--panel-2);
          border-radius: 0 4px 4px 0;
        }

        .entry__thinking-content p:first-child { margin-top: 0; }
        .entry__thinking-content p:last-child  { margin-bottom: 0; }

        .entry__content {
          font-size: 1.0625rem;
          line-height: 1.7;
          color: var(--ink);
        }

        .entry--prompt .entry__content {
          font-size: 1rem;
          color: var(--muted);
        }

        .entry__highlight {
          background: var(--highlight-bg);
          color: inherit;
          border-radius: 2px;
          padding: 0.05rem 0.05rem;
        }

        @media (max-width: 768px) {
          .entry__avatar {
            width: 34px;
            height: 34px;
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

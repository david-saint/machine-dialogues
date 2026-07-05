import React, { useState } from 'react';
import type { JudgeSlot } from '../../types/judgment';

interface SystemPromptRevealProps {
  agentName: string;
  prompt: string;
  slot?: JudgeSlot;
}

export const SystemPromptReveal: React.FC<SystemPromptRevealProps> = ({ agentName, prompt, slot }) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!prompt) return null;

  const accent = slot === 'agentB' ? 'var(--agent-b)' : 'var(--agent-a)';

  return (
    <div className="classified" style={{ '--accent': accent } as React.CSSProperties}>
      <button
        className="classified__header"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <span className="classified__badge">System prompt</span>
        <span className="classified__name" style={{ color: accent }}>{agentName}</span>
        <span className="classified__toggle" aria-hidden="true">{isOpen ? '−' : '+'}</span>
      </button>

      {isOpen && (
        <div className="classified__body">
          <pre className="classified__text">{prompt}</pre>
        </div>
      )}

      <style>{`
        .classified {
          border: 1px solid var(--line);
          border-radius: 5px;
          overflow: hidden;
        }

        .classified__header {
          display: flex;
          align-items: center;
          gap: 0.85rem;
          width: 100%;
          padding: 0.8rem 1rem;
          background: var(--panel);
          color: var(--ink);
          border: none;
          border-left: 3px solid var(--accent);
          cursor: pointer;
          text-align: left;
          transition: background 150ms ease;
        }

        .classified__header:hover {
          background: var(--panel-2);
        }

        .classified__badge {
          font-family: var(--mono);
          font-size: 0.625rem;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--muted);
          flex-shrink: 0;
        }

        .classified__name {
          flex: 1;
          font-family: var(--serif);
          font-weight: 700;
          font-size: 0.95rem;
          letter-spacing: -0.01em;
        }

        .classified__toggle {
          font-family: var(--mono);
          font-size: 1.1rem;
          line-height: 1;
          flex-shrink: 0;
          color: var(--muted);
        }

        .classified__body {
          padding: 1.15rem 1.25rem;
          background: var(--panel-2);
          border-top: 1px solid var(--line);
        }

        .classified__text {
          white-space: pre-wrap;
          word-break: break-word;
          font-family: var(--mono);
          font-size: 0.78rem;
          line-height: 1.65;
          color: var(--muted);
        }
      `}</style>
    </div>
  );
};

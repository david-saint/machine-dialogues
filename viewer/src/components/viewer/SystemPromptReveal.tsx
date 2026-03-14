import React, { useState } from 'react';

interface SystemPromptRevealProps {
  agentName: string;
  prompt: string;
}

export const SystemPromptReveal: React.FC<SystemPromptRevealProps> = ({ agentName, prompt }) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!prompt) return null;

  return (
    <div className="classified">
      <button
        className="classified__header"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <span className="classified__badge">[CLASSIFIED]</span>
        <span className="classified__name">{agentName}</span>
        <span className="classified__toggle">{isOpen ? '\u2212' : '+'}</span>
      </button>

      {isOpen && (
        <div className="classified__body">
          <pre className="classified__text">{prompt}</pre>
        </div>
      )}

      <style>{`
        .classified {
          border: 1px solid var(--border);
        }

        .classified__header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          width: 100%;
          padding: 0.75rem 1rem;
          background: var(--bg-raised);
          color: var(--text);
          border: none;
          cursor: pointer;
          font-family: var(--font-mono);
          font-size: 0.75rem;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          text-align: left;
          transition: background 150ms;
        }

        .classified__header:hover {
          background: #1a1a1f;
        }

        .classified__badge {
          font-weight: 700;
          flex-shrink: 0;
          color: var(--text-muted);
        }

        .classified__name {
          flex: 1;
        }

        .classified__toggle {
          font-size: 1.1rem;
          line-height: 1;
          flex-shrink: 0;
          color: var(--text-muted);
        }

        .classified__body {
          padding: 1.25rem 1.5rem;
          background: var(--bg-inset);
          border-top: 1px solid var(--border);
        }

        .classified__text {
          white-space: pre-wrap;
          word-break: break-word;
          font-family: var(--font-mono);
          font-size: 0.8rem;
          line-height: 1.65;
          color: var(--text-muted);
        }
      `}</style>
    </div>
  );
};

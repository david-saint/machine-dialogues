import React, { useState } from 'react';
import type { AgentInfo } from '../../types/transcript';
import type { Judgment, JudgeSlot } from '../../types/judgment';

interface JudgePanelProps {
  judgments: Judgment[];
  agentA: AgentInfo;
  agentB: AgentInfo;
}

// Mirrors the color assignment used across the transcript view (MessageBubble /
// TranscriptViewer) so judge-panel colors match the debate for the same agent.
const agentKey = (name: string): 'claude' | 'gemini' | 'gpt' | null => {
  const lower = name.toLowerCase();
  if (lower.includes('claude')) return 'claude';
  if (lower.includes('gemini')) return 'gemini';
  if (lower.includes('gpt')) return 'gpt';
  return null;
};

const AGENT_RGB: Record<'claude' | 'gemini' | 'gpt', string> = {
  claude: '212, 165, 116',
  gemini: '126, 184, 218',
  gpt: '58, 191, 122',
};

const getAgentColor = (name: string): string => {
  const key = agentKey(name);
  return key ? `var(--accent-${key})` : 'var(--text)';
};

const getAgentTint = (name: string, alpha: number): string => {
  const key = agentKey(name);
  return key ? `rgba(${AGENT_RGB[key]}, ${alpha})` : 'transparent';
};

const buildJudgeMeta = (model: string, thinkingLevel?: string): string =>
  [model, thinkingLevel].filter(Boolean).join(' · ');

export const JudgePanel: React.FC<JudgePanelProps> = ({ judgments, agentA, agentB }) => {
  const [selected, setSelected] = useState(0);
  const judgment = judgments[Math.min(selected, judgments.length - 1)];

  const agentForSlot = (slot: JudgeSlot): AgentInfo => (slot === 'agentA' ? agentA : agentB);

  // Decision winner (agentA | agentB | draw).
  const decisionWinner =
    judgment.decision.winner === 'draw'
      ? { label: 'Draw', color: 'var(--text-muted)' }
      : {
          label: agentForSlot(judgment.decision.winner).name,
          color: getAgentColor(agentForSlot(judgment.decision.winner).name),
        };

  const { tally } = judgment;

  return (
    <div className="judge">
      <h3 className="judge__title">Judge&rsquo;s Report</h3>

      {/* Judge selector — always shown, even for a single judge; built for N judges. */}
      <div className="judge__selector" role="tablist" aria-label="Judges">
        {judgments.map((j, i) => (
          <button
            key={`${j.judge.name}-${i}`}
            type="button"
            role="tab"
            aria-selected={i === selected}
            className={`judge__chip ${i === selected ? 'judge__chip--active' : ''}`}
            onClick={() => setSelected(i)}
          >
            <span className="judge__chip-name">{j.judge.name}</span>
            <span className="judge__chip-meta">
              {buildJudgeMeta(j.judge.model, j.judge.thinking_level)}
            </span>
          </button>
        ))}
      </div>

      {/* Decision banner */}
      <div className="judge__decision" style={{ borderLeftColor: decisionWinner.color }}>
        <span className="label judge__eyebrow">Decision</span>
        <div className="judge__verdict">
          <span className="judge__winner" style={{ color: decisionWinner.color }}>
            {decisionWinner.label}
          </span>
          {judgment.decision.method && (
            <span className="judge__method">{judgment.decision.method}</span>
          )}
        </div>
        <p className="judge__summary">{judgment.decision.summary}</p>
        {judgment.decision.caveat && (
          <p className="judge__caveat">
            <span className="judge__caveat-lead">Caveat&nbsp;&mdash;&nbsp;</span>
            {judgment.decision.caveat}
          </p>
        )}
      </div>

      {/* Tally */}
      <div className="judge__tally-wrap">
        <div className="judge__tally">
          <span className="judge__tally-item" style={{ color: getAgentColor(agentA.name) }}>
            {agentA.name} {tally.agentA}
          </span>
          <span className="judge__tally-sep" aria-hidden="true">
            ·
          </span>
          <span className="judge__tally-item" style={{ color: getAgentColor(agentB.name) }}>
            {agentB.name} {tally.agentB}
          </span>
          <span className="judge__tally-sep" aria-hidden="true">
            ·
          </span>
          <span className="judge__tally-item judge__tally-item--even">Even {tally.even}</span>
        </div>
        {tally.note && <p className="judge__tally-note">{tally.note}</p>}
      </div>

      {/* Round by round */}
      <div className="judge__block">
        <h4 className="judge__block-title">Round by round</h4>
        <div className="judge__table-scroll">
          <table className="judge__table">
            <thead>
              <tr>
                <th className="judge__th judge__th--round">Round</th>
                <th className="judge__th judge__th--winner">Winner</th>
                <th className="judge__th">Reason</th>
              </tr>
            </thead>
            <tbody>
              {judgment.rounds.map((r) => {
                const winner =
                  r.winner === 'even'
                    ? { label: 'Even', color: 'var(--text-muted)' }
                    : {
                        label: agentForSlot(r.winner).name,
                        color: getAgentColor(agentForSlot(r.winner).name),
                      };
                return (
                  <tr key={r.round} className="judge__row">
                    <td className="judge__td judge__td--round">{r.round}</td>
                    <td className="judge__td judge__td--winner">
                      <span
                        className={`judge__winner-name ${
                          r.winner === 'even' ? 'judge__winner-name--even' : ''
                        }`}
                        style={{ color: winner.color }}
                      >
                        {winner.label}
                      </span>
                      {r.close && <span className="judge__close">close</span>}
                    </td>
                    <td className="judge__td judge__td--reason">{r.reason}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Key moments */}
      {judgment.key_moments && judgment.key_moments.length > 0 && (
        <div className="judge__block">
          <h4 className="judge__block-title">Key moments</h4>
          <ul className="judge__moments">
            {judgment.key_moments.map((m, i) => {
              const agent = agentForSlot(m.agent);
              const color = getAgentColor(agent.name);
              return (
                <li key={`${m.turn}-${i}`} className="judge__moment">
                  <span
                    className="judge__turn-chip"
                    style={{
                      color,
                      borderColor: color,
                      background: getAgentTint(agent.name, 0.08),
                    }}
                  >
                    Turn {m.turn}
                  </span>
                  <div className="judge__moment-body">
                    <p className="judge__moment-text">{m.moment}</p>
                    {m.note && <p className="judge__moment-note">{m.note}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Analysis */}
      {judgment.analysis && judgment.analysis.length > 0 && (
        <div className="judge__block">
          {judgment.analysis.map((sec, i) => (
            <section key={i} className="judge__analysis">
              {sec.tag && <span className="label judge__eyebrow">{sec.tag}</span>}
              <h4 className="judge__analysis-heading">{sec.heading}</h4>
              {sec.paragraphs.map((para, p) => (
                <p key={p} className="judge__analysis-p">
                  {para}
                </p>
              ))}
            </section>
          ))}
        </div>
      )}

      {/* Quotes */}
      {judgment.quotes && judgment.quotes.length > 0 && (
        <div className="judge__block">
          <h4 className="judge__block-title">From the transcript</h4>
          <div className="judge__quotes">
            {judgment.quotes.map((q, i) => {
              const agent = agentForSlot(q.agent);
              const color = getAgentColor(agent.name);
              return (
                <blockquote
                  key={i}
                  className="judge__quote"
                  style={{ borderLeftColor: color, background: getAgentTint(agent.name, 0.05) }}
                >
                  <p className="judge__quote-text">&ldquo;{q.text}&rdquo;</p>
                  <cite className="judge__quote-cite" style={{ color }}>
                    {q.cite}
                  </cite>
                </blockquote>
              );
            })}
          </div>
        </div>
      )}

      <style>{`
        .judge {
          margin-top: 1rem;
        }

        .judge__title {
          font-size: 1.5rem;
          margin-bottom: 1.5rem;
          color: var(--text);
        }

        /* Judge selector chips */
        .judge__selector {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
          margin-bottom: 2rem;
        }

        .judge__chip {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 0.15rem;
          padding: 0.55rem 0.9rem;
          background: var(--bg-inset);
          border: 1px solid var(--border);
          color: var(--text-muted);
          cursor: pointer;
          text-align: left;
          transition: border-color 0.15s ease, color 0.15s ease, background 0.15s ease;
        }

        .judge__chip:hover {
          border-color: var(--border-emphasis);
          color: var(--text);
        }

        .judge__chip--active {
          border-color: var(--border-emphasis);
          background: var(--bg-raised);
        }

        .judge__chip-name {
          font-family: var(--font-body);
          font-weight: 700;
          font-size: 0.85rem;
          color: var(--text);
        }

        .judge__chip-meta {
          font-family: var(--font-mono);
          font-size: 0.65rem;
          letter-spacing: 0.03em;
          color: var(--text-muted);
        }

        .judge__eyebrow {
          display: block;
          margin-bottom: 0.75rem;
        }

        /* Decision banner */
        .judge__decision {
          border: 1px solid var(--border);
          border-left: 3px solid var(--border-emphasis);
          padding: 1.5rem;
          margin-bottom: 2rem;
          background: var(--bg-raised);
        }

        .judge__verdict {
          display: flex;
          align-items: baseline;
          flex-wrap: wrap;
          gap: 0.25rem 1rem;
          margin-bottom: 1rem;
        }

        .judge__winner {
          font-family: var(--font-display);
          font-style: italic;
          font-size: clamp(1.8rem, 4vw, 2.6rem);
          line-height: 1;
          letter-spacing: -0.02em;
        }

        .judge__method {
          font-family: var(--font-mono);
          font-size: 0.72rem;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--text-muted);
        }

        .judge__summary {
          font-size: 1rem;
          line-height: 1.7;
          color: var(--text);
          margin-bottom: 1rem;
        }

        .judge__caveat {
          font-size: 0.88rem;
          line-height: 1.6;
          color: var(--text-muted);
          font-style: italic;
        }

        .judge__caveat-lead {
          font-family: var(--font-mono);
          font-style: normal;
          font-size: 0.7rem;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--text-faint);
        }

        /* Tally */
        .judge__tally-wrap {
          margin-bottom: 3rem;
        }

        .judge__tally {
          display: flex;
          flex-wrap: wrap;
          align-items: baseline;
          gap: 0.6rem;
          font-family: var(--font-display);
          font-style: italic;
          font-size: 1.5rem;
          line-height: 1.2;
          letter-spacing: -0.01em;
        }

        .judge__tally-sep {
          color: var(--text-faint);
        }

        .judge__tally-item--even {
          color: var(--text-muted);
        }

        .judge__tally-note {
          margin-top: 0.6rem;
          font-family: var(--font-mono);
          font-size: 0.72rem;
          letter-spacing: 0.03em;
          color: var(--text-muted);
        }

        /* Blocks */
        .judge__block {
          margin-bottom: 3rem;
        }

        .judge__block-title {
          font-family: var(--font-mono);
          font-style: normal;
          font-size: 0.72rem;
          font-weight: 400;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--text-muted);
          margin-bottom: 1.25rem;
        }

        /* Round table */
        .judge__table-scroll {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }

        .judge__table {
          width: 100%;
          min-width: 560px;
          border-collapse: collapse;
        }

        .judge__th {
          font-family: var(--font-mono);
          font-size: 0.7rem;
          font-weight: 400;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--text-muted);
          text-align: left;
          padding: 0.75rem 1rem;
          border-bottom: 2px solid var(--border-emphasis);
        }

        .judge__th--round {
          width: 70px;
        }

        .judge__th--winner {
          width: 170px;
        }

        .judge__td {
          padding: 1rem;
          border-bottom: 1px solid var(--border);
          vertical-align: top;
          font-size: 0.9rem;
          line-height: 1.55;
        }

        .judge__td--round {
          font-family: var(--font-display);
          font-style: italic;
          font-size: 1.4rem;
          line-height: 1;
          color: var(--text-muted);
          width: 70px;
        }

        .judge__td--winner {
          width: 170px;
          white-space: nowrap;
        }

        .judge__winner-name {
          font-family: var(--font-body);
          font-weight: 700;
          font-size: 0.9rem;
        }

        .judge__winner-name--even {
          font-weight: 400;
        }

        .judge__close {
          display: inline-block;
          margin-left: 0.5rem;
          font-family: var(--font-mono);
          font-size: 0.58rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--text-faint);
          border: 1px solid var(--border);
          padding: 0.1rem 0.35rem;
          vertical-align: middle;
        }

        .judge__td--reason {
          color: var(--text-muted);
        }

        /* Key moments */
        .judge__moments {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .judge__moment {
          display: flex;
          gap: 1rem;
          align-items: flex-start;
        }

        .judge__turn-chip {
          flex-shrink: 0;
          font-family: var(--font-mono);
          font-size: 0.62rem;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          border: 1px solid var(--border);
          padding: 0.3rem 0.5rem;
          white-space: nowrap;
          margin-top: 0.15rem;
        }

        .judge__moment-body {
          flex: 1;
          min-width: 0;
        }

        .judge__moment-text {
          font-size: 0.92rem;
          line-height: 1.6;
          color: var(--text);
        }

        .judge__moment-note {
          margin-top: 0.4rem;
          font-size: 0.82rem;
          line-height: 1.5;
          color: var(--text-muted);
          font-style: italic;
        }

        /* Analysis */
        .judge__analysis {
          margin-bottom: 2.5rem;
        }

        .judge__analysis:last-child {
          margin-bottom: 0;
        }

        .judge__analysis-heading {
          font-family: var(--font-display);
          font-style: italic;
          font-size: clamp(1.3rem, 2.5vw, 1.7rem);
          letter-spacing: -0.02em;
          color: var(--text);
          margin-bottom: 1rem;
        }

        .judge__analysis-p {
          font-size: 0.95rem;
          line-height: 1.75;
          color: var(--text-muted);
          margin-bottom: 1rem;
        }

        .judge__analysis-p:last-child {
          margin-bottom: 0;
        }

        /* Quotes */
        .judge__quotes {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .judge__quote {
          border-left: 3px solid var(--text-faint);
          padding: 1rem 1.25rem;
        }

        .judge__quote-text {
          font-family: var(--font-display);
          font-style: italic;
          font-size: 1.15rem;
          line-height: 1.5;
          color: var(--text);
          margin-bottom: 0.6rem;
          max-width: none;
        }

        .judge__quote-cite {
          font-family: var(--font-mono);
          font-style: normal;
          font-size: 0.68rem;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        @media (max-width: 768px) {
          .judge__decision {
            padding: 1.25rem;
          }

          .judge__moment {
            gap: 0.75rem;
          }
        }
      `}</style>
    </div>
  );
};

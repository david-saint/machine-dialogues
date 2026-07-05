import React, { useState } from 'react';
import type { AgentInfo } from '../../types/transcript';
import type { Judgment, JudgeSlot } from '../../types/judgment';

interface JudgePanelProps {
  judgments: Judgment[];
  agentA: AgentInfo;
  agentB: AgentInfo;
}

// Positional accents mirror the transcript view: agent A (speaks first each
// round) = warm, agent B = cool. Every judge-panel color keys off the slot.
const colorForSlot = (slot: JudgeSlot): string =>
  slot === 'agentA' ? 'var(--agent-a)' : 'var(--agent-b)';

const dimForSlot = (slot: JudgeSlot): string =>
  slot === 'agentA' ? 'var(--agent-a-dim)' : 'var(--agent-b-dim)';

const chipForSlot = (slot: JudgeSlot): string =>
  slot === 'agentA' ? 'var(--agent-a-chip)' : 'var(--agent-b-chip)';

const buildJudgeMeta = (model: string, thinkingLevel?: string): string =>
  [model, thinkingLevel].filter(Boolean).join(' · ');

export const JudgePanel: React.FC<JudgePanelProps> = ({ judgments, agentA, agentB }) => {
  const [selected, setSelected] = useState(0);
  const judgment = judgments[Math.min(selected, judgments.length - 1)];

  const agentForSlot = (slot: JudgeSlot): AgentInfo => (slot === 'agentA' ? agentA : agentB);

  const decisionWinner =
    judgment.decision.winner === 'draw'
      ? { label: 'Draw', color: 'var(--muted)', border: 'var(--line-strong)' }
      : {
          label: agentForSlot(judgment.decision.winner).name,
          color: colorForSlot(judgment.decision.winner),
          border: colorForSlot(judgment.decision.winner),
        };

  const { tally } = judgment;

  return (
    <div className="judge">
      <p className="eyebrow judge__eyebrow-top">Verdict</p>
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
      <div className="judge__decision" style={{ borderLeftColor: decisionWinner.border }}>
        <span className="eyebrow">Decision</span>
        <p className="judge__verdict">
          <span className="judge__winner" style={{ color: decisionWinner.color }}>
            {decisionWinner.label}
          </span>
          {judgment.decision.method && (
            <span className="judge__method">{judgment.decision.method}</span>
          )}
        </p>
        <p className="judge__summary">{judgment.decision.summary}</p>
        {judgment.decision.caveat && (
          <p className="judge__caveat">
            <span className="judge__caveat-lead">Caveat &mdash; </span>
            {judgment.decision.caveat}
          </p>
        )}
      </div>

      {/* Tally */}
      <div className="judge__tally-wrap">
        <p className="judge__tally">
          <span style={{ color: colorForSlot('agentA') }}>{agentA.name} {tally.agentA}</span>
          <span className="judge__tally-sep" aria-hidden="true">·</span>
          <span style={{ color: colorForSlot('agentB') }}>{agentB.name} {tally.agentB}</span>
          <span className="judge__tally-sep" aria-hidden="true">·</span>
          <span className="judge__tally-even">Even {tally.even}</span>
        </p>
        {tally.note && <p className="judge__tally-note">{tally.note}</p>}
      </div>

      {/* Round by round */}
      <div className="judge__block">
        <p className="eyebrow judge__block-title">Round by round</p>
        <div className="judge__table-scroll">
          <table className="judge__table">
            <thead>
              <tr>
                <th className="judge__th judge__th--round">Rd</th>
                <th className="judge__th judge__th--winner">Winner</th>
                <th className="judge__th">Why</th>
              </tr>
            </thead>
            <tbody>
              {judgment.rounds.map((r) => {
                const winner =
                  r.winner === 'even'
                    ? { label: 'Even', color: 'var(--muted)', even: true }
                    : { label: agentForSlot(r.winner).name, color: colorForSlot(r.winner), even: false };
                return (
                  <tr key={r.round} className="judge__row">
                    <td className="judge__td judge__td--round">T{r.round}</td>
                    <td className="judge__td judge__td--winner">
                      <span
                        className={`judge__winner-name ${winner.even ? 'judge__winner-name--even' : ''}`}
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
          <p className="eyebrow judge__block-title">Key moments</p>
          <ul className="judge__moments">
            {judgment.key_moments.map((m, i) => (
              <li key={`${m.turn}-${i}`} className="judge__moment">
                <span
                  className="judge__turn-chip"
                  style={{
                    color: colorForSlot(m.agent),
                    borderColor: colorForSlot(m.agent),
                    background: chipForSlot(m.agent),
                  }}
                >
                  T{m.turn}
                </span>
                <div className="judge__moment-body">
                  <p className="judge__moment-text">{m.moment}</p>
                  {m.note && <p className="judge__moment-note">{m.note}</p>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Analysis */}
      {judgment.analysis && judgment.analysis.length > 0 && (
        <div className="judge__block">
          {judgment.analysis.map((sec, i) => (
            <section key={i} className="judge__analysis">
              {sec.tag && <span className="eyebrow judge__analysis-tag">{sec.tag}</span>}
              <h4 className="judge__analysis-heading">{sec.heading}</h4>
              {sec.paragraphs.map((para, p) => (
                <p key={p} className="judge__analysis-p">{para}</p>
              ))}
            </section>
          ))}
        </div>
      )}

      {/* Quotes */}
      {judgment.quotes && judgment.quotes.length > 0 && (
        <div className="judge__block">
          <p className="eyebrow judge__block-title">From the transcript</p>
          <div className="judge__quotes">
            {judgment.quotes.map((q, i) => (
              <blockquote
                key={i}
                className="judge__quote"
                style={{ borderLeftColor: colorForSlot(q.agent), background: dimForSlot(q.agent) }}
              >
                <p className="judge__quote-text">&ldquo;{q.text}&rdquo;</p>
                <cite className="judge__quote-cite">{q.cite}</cite>
              </blockquote>
            ))}
          </div>
        </div>
      )}

      <style>{`
        .judge {
          margin-top: 0.5rem;
        }

        .judge__eyebrow-top {
          display: block;
          margin-bottom: 0.5rem;
        }

        .judge__title {
          font-size: 1.4rem;
          margin-bottom: 1.5rem;
        }

        /* Judge selector chips */
        .judge__selector {
          display: flex;
          flex-wrap: wrap;
          gap: 0.6rem;
          margin-bottom: 2rem;
        }

        .judge__chip {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 0.15rem;
          padding: 0.5rem 0.85rem;
          background: var(--panel);
          border: 1px solid var(--line);
          border-radius: 5px;
          color: var(--muted);
          cursor: pointer;
          text-align: left;
          transition: border-color 0.15s ease, background 0.15s ease;
        }

        .judge__chip:hover {
          border-color: var(--line-strong);
        }

        .judge__chip--active {
          border-color: var(--line-strong);
          background: var(--panel-2);
        }

        .judge__chip-name {
          font-family: var(--serif);
          font-weight: 700;
          font-size: 0.9rem;
          color: var(--ink);
          letter-spacing: -0.01em;
        }

        .judge__chip-meta {
          font-family: var(--mono);
          font-size: 0.625rem;
          letter-spacing: 0.03em;
          color: var(--muted);
        }

        /* Decision banner */
        .judge__decision {
          border: 1px solid var(--line);
          border-left: 3px solid var(--line-strong);
          border-radius: 6px;
          padding: 1.4rem 1.4rem 1.25rem;
          margin-bottom: 1.5rem;
          background: var(--panel);
        }

        .judge__decision .eyebrow {
          display: block;
          margin-bottom: 0.5rem;
        }

        .judge__verdict {
          display: flex;
          align-items: baseline;
          flex-wrap: wrap;
          gap: 0.4rem 0.85rem;
          margin-bottom: 0.7rem;
          max-width: none;
        }

        .judge__winner {
          font-family: var(--serif);
          font-weight: 700;
          font-size: clamp(1.4rem, 3.5vw, 1.9rem);
          line-height: 1.1;
          letter-spacing: -0.02em;
        }

        .judge__method {
          font-family: var(--mono);
          font-size: 0.6875rem;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--muted);
        }

        .judge__summary {
          font-size: 1.0625rem;
          line-height: 1.6;
          color: var(--ink);
          margin-bottom: 0.7rem;
          max-width: none;
        }

        .judge__summary:last-child {
          margin-bottom: 0;
        }

        .judge__caveat {
          font-size: 0.95rem;
          line-height: 1.6;
          color: var(--muted);
          max-width: none;
        }

        .judge__caveat-lead {
          font-family: var(--mono);
          font-size: 0.625rem;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--faint);
        }

        /* Tally */
        .judge__tally-wrap {
          margin-bottom: 2.75rem;
        }

        .judge__tally {
          display: flex;
          flex-wrap: wrap;
          align-items: baseline;
          gap: 0.5rem;
          font-family: var(--mono);
          font-size: 0.8125rem;
          font-weight: 600;
          letter-spacing: 0.01em;
          max-width: none;
        }

        .judge__tally-sep {
          color: var(--faint);
          font-weight: 400;
        }

        .judge__tally-even {
          color: var(--muted);
        }

        .judge__tally-note {
          margin-top: 0.6rem;
          font-family: var(--mono);
          font-size: 0.6875rem;
          line-height: 1.6;
          letter-spacing: 0.02em;
          color: var(--muted);
          max-width: none;
        }

        /* Blocks */
        .judge__block {
          margin-bottom: 2.75rem;
        }

        .judge__block-title {
          display: block;
          margin-bottom: 1rem;
        }

        /* Round table */
        .judge__table-scroll {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }

        .judge__table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.9375rem;
          font-variant-numeric: tabular-nums;
        }

        .judge__th {
          font-family: var(--mono);
          font-size: 0.6875rem;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: var(--muted);
          text-align: left;
          padding: 0.5rem 0.9rem 0.5rem 0;
          border-bottom: 1px solid var(--line);
          white-space: nowrap;
        }

        .judge__th--round { width: 3rem; }
        .judge__th--winner { width: 9rem; }

        .judge__td {
          padding: 0.6rem 0.9rem 0.6rem 0;
          border-bottom: 1px solid var(--line);
          vertical-align: top;
          line-height: 1.5;
        }

        .judge__td--round {
          font-family: var(--mono);
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--muted);
          white-space: nowrap;
        }

        .judge__td--winner {
          white-space: nowrap;
        }

        .judge__winner-name {
          font-family: var(--mono);
          font-weight: 700;
          font-size: 0.8125rem;
        }

        .judge__winner-name--even {
          font-weight: 700;
          color: var(--muted);
        }

        .judge__close {
          display: inline-block;
          margin-left: 0.4rem;
          font-family: var(--mono);
          font-size: 0.5625rem;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--muted);
          vertical-align: middle;
        }

        .judge__td--reason {
          color: var(--ink);
          font-size: 0.9rem;
          line-height: 1.5;
        }

        /* Key moments */
        .judge__moments {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 0;
        }

        .judge__moment {
          display: grid;
          grid-template-columns: 2.75rem 1fr;
          gap: 0.9rem;
          align-items: start;
          padding: 0.7rem 0;
          border-bottom: 1px solid var(--line);
        }

        .judge__moment:last-child {
          border-bottom: none;
        }

        .judge__turn-chip {
          font-family: var(--mono);
          font-size: 0.625rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          border: 1px solid var(--line);
          border-radius: 3px;
          padding: 0.15rem 0.35rem;
          text-align: center;
          white-space: nowrap;
          margin-top: 0.15rem;
        }

        .judge__moment-body {
          min-width: 0;
        }

        .judge__moment-text {
          font-size: 0.9375rem;
          line-height: 1.55;
          color: var(--ink);
          max-width: none;
        }

        .judge__moment-note {
          margin-top: 0.35rem;
          font-size: 0.875rem;
          line-height: 1.5;
          color: var(--muted);
          max-width: none;
        }

        /* Analysis */
        .judge__analysis {
          margin-bottom: 2.5rem;
        }

        .judge__analysis:last-child {
          margin-bottom: 0;
        }

        .judge__analysis-tag {
          display: block;
          margin-bottom: 0.45rem;
        }

        .judge__analysis-heading {
          font-family: var(--serif);
          font-weight: 700;
          font-size: 1.3rem;
          line-height: 1.3;
          letter-spacing: -0.01em;
          color: var(--ink);
          margin-bottom: 0.9rem;
          text-wrap: balance;
        }

        .judge__analysis-p {
          font-size: 1.0625rem;
          line-height: 1.65;
          color: var(--ink);
          margin-bottom: 1rem;
          max-width: none;
        }

        .judge__analysis-p:last-child {
          margin-bottom: 0;
        }

        /* Quotes */
        .judge__quotes {
          display: flex;
          flex-direction: column;
          gap: 1.4rem;
        }

        .judge__quote {
          border-left: 3px solid var(--line-strong);
          border-radius: 4px;
          padding: 0.9rem 1.15rem;
        }

        .judge__quote-text {
          font-size: 1rem;
          font-style: italic;
          line-height: 1.55;
          color: var(--ink);
          margin-bottom: 0.5rem;
          max-width: none;
        }

        .judge__quote-cite {
          font-family: var(--mono);
          font-style: normal;
          font-size: 0.6875rem;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--muted);
        }

        @media (max-width: 768px) {
          .judge__decision {
            padding: 1.2rem;
          }

          .judge__moment {
            gap: 0.75rem;
          }
        }
      `}</style>
    </div>
  );
};

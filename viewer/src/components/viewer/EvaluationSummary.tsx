import React from 'react';
import type { EvaluationSummary as EvalType, RubricCategory } from '../../types/evaluation';

interface EvaluationSummaryProps {
  evaluation: EvalType;
}

const CATEGORY_LABELS: Record<RubricCategory, string> = {
  conversionOutcome: 'Conversion Outcome',
  argumentQuality: 'Argument Quality',
  probeDepth: 'Probe Depth',
  resistanceQuality: 'Resistance Quality',
  epistemicDiscipline: 'Epistemic Discipline'
};

export const EvaluationSummary: React.FC<EvaluationSummaryProps> = ({ evaluation }) => {
  return (
    <div className="eval">
      <p className="eyebrow eval__eyebrow">Scorecard</p>
      <h3 className="eval__title">Evaluation</h3>

      {/* Score summary */}
      <div className="eval__scores">
        <div className="eval__score-block">
          <span className="eval__score-num">{evaluation.persuaderTotal}<span className="eval__score-denom">/20</span></span>
          <span className="label">Persuader</span>
        </div>
        <div className="eval__score-block">
          <span className="eval__score-num">{evaluation.targetTotal}<span className="eval__score-denom">/20</span></span>
          <span className="label">Target</span>
        </div>
      </div>

      {/* Rubric table */}
      <div className="eval__table-scroll">
        <table className="eval__table">
          <thead>
            <tr>
              <th className="eval__th">Category</th>
              <th className="eval__th eval__th--score">Score</th>
              <th className="eval__th">Rationale</th>
            </tr>
          </thead>
          <tbody>
            {(Object.entries(evaluation.rubric) as [RubricCategory, any][]).map(([key, data]) => (
              <tr key={key} className="eval__row">
                <td className="eval__td eval__td--category">{CATEGORY_LABELS[key]}</td>
                <td className="eval__td eval__td--score">
                  <span className="eval__score-cell">{data.score}</span>
                  <span className="eval__score-max">/4</span>
                </td>
                <td className="eval__td eval__td--rationale">
                  <p>{data.rationale}</p>
                  {data.evidence.length > 0 && (
                    <div className="eval__evidence">
                      {data.evidence.map((quote: string, i: number) => (
                        <blockquote key={i} className="eval__quote">
                          &ldquo;{quote}&rdquo;
                        </blockquote>
                      ))}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Overall assessment */}
      <div className="eval__overall">
        <span className="label">Overall Assessment</span>
        <p className="eval__overall-text">{evaluation.overallAssessment}</p>
      </div>

      <style>{`
        .eval {
          margin-top: 0.5rem;
        }

        .eval__eyebrow {
          display: block;
          margin-bottom: 0.5rem;
        }

        .eval__title {
          font-size: 1.4rem;
          margin-bottom: 1.75rem;
        }

        .eval__scores {
          display: flex;
          gap: 2.5rem;
          margin-bottom: 2.5rem;
        }

        .eval__score-block {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }

        .eval__score-num {
          font-family: var(--mono);
          font-variant-numeric: tabular-nums;
          font-size: 2.75rem;
          font-weight: 500;
          line-height: 1;
          color: var(--ink);
        }

        .eval__score-denom {
          font-size: 0.85rem;
          color: var(--muted);
        }

        .eval__table-scroll {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          margin-bottom: 2.5rem;
        }

        .eval__table {
          width: 100%;
          border-collapse: collapse;
          font-variant-numeric: tabular-nums;
        }

        .eval__th {
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

        .eval__th--score {
          width: 4.5rem;
        }

        .eval__td {
          padding: 0.9rem 0.9rem 0.9rem 0;
          border-bottom: 1px solid var(--line);
          vertical-align: top;
          font-size: 0.9rem;
          line-height: 1.55;
        }

        .eval__td--category {
          font-family: var(--serif);
          font-weight: 700;
          font-size: 0.9375rem;
          white-space: nowrap;
          width: 11rem;
          color: var(--ink);
          letter-spacing: -0.01em;
        }

        .eval__td--score {
          width: 4.5rem;
          white-space: nowrap;
        }

        .eval__score-cell {
          font-family: var(--mono);
          font-variant-numeric: tabular-nums;
          font-size: 1.25rem;
          font-weight: 500;
          color: var(--ink);
        }

        .eval__score-max {
          font-family: var(--mono);
          font-size: 0.6875rem;
          color: var(--faint);
        }

        .eval__td--rationale p {
          color: var(--ink);
          margin-bottom: 0.7rem;
          max-width: none;
        }

        .eval__evidence {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .eval__quote {
          font-family: var(--serif);
          font-style: italic;
          font-size: 0.85rem;
          color: var(--muted);
          padding-left: 0.9rem;
          border-left: 2px solid var(--line-strong);
          line-height: 1.45;
          max-width: none;
        }

        .eval__overall {
          border: 1px solid var(--line);
          border-radius: 6px;
          background: var(--panel);
          padding: 1.4rem;
        }

        .eval__overall .label {
          display: block;
          margin-bottom: 0.7rem;
        }

        .eval__overall-text {
          font-size: 1.0625rem;
          line-height: 1.65;
          color: var(--ink);
          max-width: none;
        }

        @media (max-width: 768px) {
          .eval__td--category {
            white-space: normal;
            width: 8rem;
          }
        }
      `}</style>
    </div>
  );
};

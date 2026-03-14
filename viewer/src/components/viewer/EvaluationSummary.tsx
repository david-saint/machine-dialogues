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
      <h3 className="eval__title">Evaluation</h3>

      {/* Score summary */}
      <div className="eval__scores">
        <div className="eval__score-block">
          <span className="eval__score-num">{evaluation.persuaderTotal}</span>
          <span className="eval__score-denom">/20</span>
          <span className="label">Persuader</span>
        </div>
        <div className="eval__score-block">
          <span className="eval__score-num">{evaluation.targetTotal}</span>
          <span className="eval__score-denom">/20</span>
          <span className="label">Target</span>
        </div>
      </div>

      {/* Rubric table */}
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

      {/* Overall assessment */}
      <div className="eval__overall">
        <span className="label">Overall Assessment</span>
        <p className="eval__overall-text">{evaluation.overallAssessment}</p>
      </div>

      <style>{`
        .eval {
          margin-top: 1rem;
        }

        .eval__title {
          font-size: 1.5rem;
          margin-bottom: 2rem;
          color: var(--text);
        }

        .eval__scores {
          display: flex;
          gap: 3rem;
          margin-bottom: 3rem;
        }

        .eval__score-block {
          display: flex;
          flex-direction: column;
        }

        .eval__score-block .label {
          margin-top: 0.25rem;
        }

        .eval__score-num {
          font-family: var(--font-display);
          font-style: italic;
          font-size: 3.5rem;
          line-height: 1;
          letter-spacing: -0.03em;
          color: var(--text);
        }

        .eval__score-denom {
          font-family: var(--font-mono);
          font-size: 0.8rem;
          color: var(--text-muted);
          margin-top: -0.25rem;
        }

        .eval__table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 3rem;
        }

        .eval__th {
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

        .eval__th--score {
          width: 80px;
        }

        .eval__td {
          padding: 1rem;
          border-bottom: 1px solid var(--border);
          vertical-align: top;
          font-size: 0.9rem;
          line-height: 1.5;
        }

        .eval__td--category {
          font-weight: 700;
          font-size: 0.85rem;
          white-space: nowrap;
          width: 180px;
          color: var(--text);
        }

        .eval__td--score {
          width: 80px;
        }

        .eval__score-cell {
          font-family: var(--font-display);
          font-style: italic;
          font-size: 1.6rem;
          line-height: 1;
          color: var(--text);
        }

        .eval__score-max {
          font-family: var(--font-mono);
          font-size: 0.7rem;
          color: var(--text-faint);
        }

        .eval__td--rationale p {
          color: var(--text-muted);
          margin-bottom: 0.75rem;
        }

        .eval__evidence {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .eval__quote {
          font-family: var(--font-body);
          font-style: italic;
          font-size: 0.8rem;
          color: var(--text-faint);
          padding-left: 1rem;
          border-left: 2px solid var(--text-faint);
          line-height: 1.4;
        }

        .eval__overall {
          border: 2px solid var(--border-emphasis);
          padding: 1.5rem;
        }

        .eval__overall .label {
          display: block;
          margin-bottom: 0.75rem;
        }

        .eval__overall-text {
          font-size: 1rem;
          line-height: 1.7;
          color: var(--text);
        }

        @media (max-width: 768px) {
          .eval__table {
            display: block;
            overflow-x: auto;
          }

          .eval__td--category {
            white-space: normal;
            width: auto;
          }
        }
      `}</style>
    </div>
  );
};

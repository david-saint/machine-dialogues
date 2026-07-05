import React from 'react';

interface ConversionMeterProps {
  score: number; // 0-100
  label: string;
}

export const ConversionMeter: React.FC<ConversionMeterProps> = ({ score, label }) => {
  return (
    <div className="meter">
      <div className="meter__head">
        <span className="label">{label}</span>
        <span className="meter__value">{score}<span className="meter__value-max">/100</span></span>
      </div>

      <div className="meter__track">
        <div className="meter__fill" style={{ width: `${score}%` }} />
        <div className="meter__notch" style={{ left: '50%' }} />
      </div>

      <div className="meter__labels">
        <span>Anti-Functionalist</span>
        <span>Neutral</span>
        <span>Functionalist</span>
      </div>

      <style>{`
        .meter {
          margin-bottom: 2rem;
        }

        .meter__head {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin-bottom: 0.7rem;
        }

        .meter__value {
          font-family: var(--mono);
          font-variant-numeric: tabular-nums;
          font-size: 1.5rem;
          font-weight: 500;
          line-height: 1;
          color: var(--ink);
        }

        .meter__value-max {
          font-size: 0.75rem;
          color: var(--muted);
        }

        .meter__track {
          height: 8px;
          border: 1px solid var(--line);
          border-radius: 4px;
          position: relative;
          background: var(--panel-2);
          overflow: hidden;
        }

        .meter__fill {
          height: 100%;
          background: var(--agent-b);
          transition: width 600ms cubic-bezier(0.33, 1, 0.68, 1);
        }

        .meter__notch {
          position: absolute;
          top: -3px;
          bottom: -3px;
          width: 1px;
          background: var(--faint);
          transform: translateX(-50%);
        }

        .meter__labels {
          display: flex;
          justify-content: space-between;
          margin-top: 0.5rem;
          font-family: var(--mono);
          font-size: 0.5625rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--faint);
        }
      `}</style>
    </div>
  );
};

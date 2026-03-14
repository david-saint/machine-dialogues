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
        <span className="meter__value">{score}/100</span>
      </div>

      <div className="meter__track">
        <div
          className="meter__fill"
          style={{ width: `${score}%` }}
        />
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
          margin-bottom: 0.75rem;
        }

        .meter__value {
          font-family: var(--font-display);
          font-style: italic;
          font-size: 1.8rem;
          line-height: 1;
          letter-spacing: -0.02em;
          color: var(--text);
        }

        .meter__track {
          height: 10px;
          border: 2px solid var(--border-emphasis);
          position: relative;
          background: var(--bg-inset);
        }

        .meter__fill {
          height: 100%;
          background: var(--accent-claude);
          transition: width 600ms cubic-bezier(0.33, 1, 0.68, 1);
        }

        .meter__notch {
          position: absolute;
          top: -6px;
          bottom: -6px;
          width: 2px;
          background: var(--text-faint);
          transform: translateX(-50%);
        }

        .meter__labels {
          display: flex;
          justify-content: space-between;
          margin-top: 0.5rem;
          font-family: var(--font-mono);
          font-size: 0.6rem;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--text-faint);
        }
      `}</style>
    </div>
  );
};

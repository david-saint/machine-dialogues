import React from 'react';
import { Link } from 'react-router-dom';
import biasData from '../../data/bias-analysis.json';
import type { BiasAnalysis, BiasPoint, BiasRegression } from '../../types/analysis';
import { resolveAccent } from '../../lib/agentAccent';

const analysis = biasData as unknown as BiasAnalysis | null;

const fmtShift = (x: number | undefined | null, digits = 2): string =>
  x === undefined || x === null ? '—' : `${x > 0 ? '+' : ''}${x.toFixed(digits)}`;

const fmtNum = (x: number | undefined | null, digits = 2): string =>
  x === undefined || x === null ? '—' : x.toFixed(digits);

const familyAccent = (family: string): string =>
  resolveAccent({ modelId: family, displayName: family, slot: 'agentA' }).accent;

const METRICS: { key: 'net_round_shift' | 'resolution_shift' | 'craft_shift'; title: string; unit: string }[] = [
  { key: 'net_round_shift', title: 'Net-round shift', unit: 'round share toward own family per unit of interest' },
  { key: 'resolution_shift', title: 'Resolution verdict', unit: 'verdict lean toward own family per unit of interest' },
  { key: 'craft_shift', title: 'Craft verdict', unit: 'verdict lean toward own family per unit of interest' },
];

const RegressionCard: React.FC<{ title: string; unit: string; fit: BiasRegression }> = ({ title, unit, fit }) => (
  <div className="bias__card">
    <p className="bias__card-title">{title}</p>
    {fit ? (
      <>
        <p className="bias__slope">
          {fmtShift(fit.slope)}
          {fit.se_slope !== null && <span className="bias__se"> ± {fmtNum(fit.se_slope)}</span>}
        </p>
        <p className="bias__card-unit">{unit}</p>
        <dl className="bias__card-stats">
          <div><dt>intercept</dt><dd>{fmtShift(fit.intercept)}</dd></div>
          <div><dt>r²</dt><dd>{fmtNum(fit.r_squared)}</dd></div>
          <div><dt>t</dt><dd>{fmtNum(fit.t_slope)}</dd></div>
          <div><dt>n</dt><dd>{fit.n}</dd></div>
        </dl>
      </>
    ) : (
      <p className="bias__card-unit">Not estimable — no variation in judge interest yet.</p>
    )}
  </div>
);

// Scatter of net-round shift vs. interest with the fitted line. Pure SVG so
// the page stays dependency-free; coordinates are tiny, so inline math is fine.
const Scatter: React.FC<{ points: BiasPoint[]; fit: BiasRegression }> = ({ points, fit }) => {
  const W = 640;
  const H = 300;
  const PAD = 44;
  const xs = { min: -1.35, max: 1.35 };
  const contrast = points.filter((p) => p.interest !== undefined && p.net_round_shift !== undefined);
  const maxAbsY = Math.max(0.5, ...contrast.map((p) => Math.abs(p.net_round_shift!)));
  const ys = { min: -maxAbsY * 1.15, max: maxAbsY * 1.15 };

  const px = (x: number) => PAD + ((x - xs.min) / (xs.max - xs.min)) * (W - 2 * PAD);
  const py = (y: number) => H - PAD - ((y - ys.min) / (ys.max - ys.min)) * (H - 2 * PAD);

  return (
    <svg className="bias__scatter" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Net-round shift vs. family interest">
      {/* axes */}
      <line x1={PAD} y1={py(0)} x2={W - PAD} y2={py(0)} stroke="var(--line-strong)" strokeWidth="1" />
      <line x1={px(0)} y1={PAD - 8} x2={px(0)} y2={H - PAD + 8} stroke="var(--line)" strokeWidth="1" strokeDasharray="3 4" />
      {[-1, 0, 1].map((x) => (
        <g key={x}>
          <line x1={px(x)} y1={py(0) - 4} x2={px(x)} y2={py(0) + 4} stroke="var(--line-strong)" strokeWidth="1" />
          <text x={px(x)} y={H - PAD + 26} textAnchor="middle" className="bias__axis-label">
            {x === -1 ? '−1 · opposing' : x === 0 ? '0 · neutral' : '+1 · own family'}
          </text>
        </g>
      ))}
      {[ys.max / 1.15, -ys.max / 1.15].map((y) => (
        <text key={y} x={PAD - 8} y={py(y) + 4} textAnchor="end" className="bias__axis-label">
          {fmtShift(y, 1)}
        </text>
      ))}
      {/* fitted line */}
      {fit && (
        <line
          x1={px(-1.2)}
          y1={py(fit.intercept + fit.slope * -1.2)}
          x2={px(1.2)}
          y2={py(fit.intercept + fit.slope * 1.2)}
          stroke="var(--muted)"
          strokeWidth="1.5"
          strokeDasharray="6 4"
        />
      )}
      {/* points, jittered horizontally per family so coincident votes stay visible */}
      {contrast.map((p, i) => (
        <circle
          key={`${p.transcript}-${p.judge_family}-${i}`}
          cx={px(p.interest! + ((i % 5) - 2) * 0.035)}
          cy={py(p.net_round_shift!)}
          r="5"
          fill={familyAccent(p.judge_family)}
          fillOpacity="0.85"
        >
          <title>{`${p.judge} · ${p.transcript} · ${fmtShift(p.net_round_shift)}`}</title>
        </circle>
      ))}
    </svg>
  );
};

export const BiasAnalysisPage: React.FC = () => {
  return (
    <div className="bias">
      <header className="bias__hero container">
        <p className="eyebrow">Machine Dialogues · Analysis</p>
        <h1 className="bias__title">The Thumb on the Scale</h1>
        <p className="bias__lede">
          Every debate is scored by a panel with one judge per model family, and every
          verdict is split in two — who is right on the question, and who argued it
          better. That makes bias measurable: each judgment becomes a point of
          net-round shift toward a family, regressed against the judge&rsquo;s interest
          in that family (+1 own side, −1 opposing side, 0 neutral). The slope is the
          family-interest gradient; the intercept is the panel&rsquo;s shared lean.
        </p>
        <p className="bias__back"><Link to="/">← Back to the archive</Link></p>
        <div className="bias__hero-rule" />
      </header>

      {!analysis ? (
        <section className="container bias__empty">
          <p>
            No analysis yet. Run <code>rh judge-panel transcripts/&lt;debate&gt;.md</code> and
            then <code>rh analyze-bias</code>, and rebuild the viewer data with{' '}
            <code>npm run parse</code>.
          </p>
        </section>
      ) : (
        <>
          <section className="container bias__section">
            <p className="eyebrow bias__section-eyebrow">The gradient</p>
            <div className="bias__cards">
              {METRICS.map((m) => (
                <RegressionCard key={m.key} title={m.title} unit={m.unit} fit={analysis.regressions[m.key]} />
              ))}
            </div>
            <p className="bias__note">
              {analysis.n_judgments} judgments · generated {analysis.generated_at}. Shifts are
              shares of scored rounds (±1 for verdicts), oriented toward the
              alphabetically-first family of each debate pair; order-swapped debate pairs
              cancel first-speaker position bias out of the family means.
            </p>
          </section>

          <section className="container bias__section">
            <p className="eyebrow bias__section-eyebrow">Net-round shift vs. interest</p>
            <Scatter points={analysis.points} fit={analysis.regressions.net_round_shift} />
          </section>

          <section className="container bias__section">
            <p className="eyebrow bias__section-eyebrow">The panel</p>
            <div className="bias__table-scroll">
              <table className="bias__table">
                <thead>
                  <tr>
                    <th>Judge</th>
                    <th>Family</th>
                    <th>Interest</th>
                    <th>Rounds</th>
                    <th>Resolution</th>
                    <th>Craft</th>
                    <th>First-speaker</th>
                    <th>n</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.judges.map((j) => (
                    <tr key={j.family}>
                      <td className="bias__td-judge" style={{ color: familyAccent(j.family) }}>{j.judge}</td>
                      <td className="bias__td-mono">{j.family}</td>
                      <td className="bias__td-mono">{j.interest !== undefined ? fmtShift(j.interest, 0) : '0'}</td>
                      <td className="bias__td-mono">{fmtShift(j.mean_net_round_shift)}</td>
                      <td className="bias__td-mono">{fmtShift(j.mean_resolution_shift)}</td>
                      <td className="bias__td-mono">{fmtShift(j.mean_craft_shift)}</td>
                      <td className="bias__td-mono">{fmtShift(j.mean_position_first_share)}</td>
                      <td className="bias__td-mono">{j.contrast_points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="container bias__section bias__section--last">
            <p className="eyebrow bias__section-eyebrow">Every judgment</p>
            <div className="bias__table-scroll">
              <table className="bias__table">
                <thead>
                  <tr>
                    <th>Debate</th>
                    <th>Judge</th>
                    <th>Interest</th>
                    <th>Rounds</th>
                    <th>Resolution</th>
                    <th>Craft</th>
                    <th>First-speaker</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.points.map((p, i) => (
                    <tr key={i}>
                      <td className="bias__td-mono bias__td-debate">{p.transcript.replace(/\.md$/, '')}</td>
                      <td className="bias__td-judge" style={{ color: familyAccent(p.judge_family) }}>{p.judge}</td>
                      <td className="bias__td-mono">{p.interest !== undefined ? fmtShift(p.interest, 0) : 'mirror'}</td>
                      <td className="bias__td-mono">{fmtShift(p.net_round_shift)}</td>
                      <td className="bias__td-mono">{fmtShift(p.resolution_shift, 0)}</td>
                      <td className="bias__td-mono">{fmtShift(p.craft_shift, 0)}</td>
                      <td className="bias__td-mono">{fmtShift(p.position_first_share)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <style>{`
        .bias {
          --container-max: 52rem;
          min-height: 100vh;
          padding-bottom: 5rem;
        }

        .bias__hero {
          padding-top: 4.5rem;
        }

        .bias .eyebrow {
          display: block;
          margin-bottom: 0.85rem;
        }

        .bias__title {
          font-size: clamp(2.2rem, 6.5vw, 3.6rem);
          line-height: 1.05;
          letter-spacing: -0.025em;
          margin-bottom: 1.25rem;
        }

        .bias__lede {
          font-size: 1.1rem;
          line-height: 1.6;
          color: var(--muted);
          max-width: var(--measure);
          margin-bottom: 1.5rem;
        }

        .bias__back {
          margin-bottom: 2.25rem;
        }

        .bias__back a {
          font-family: var(--mono);
          font-size: 0.75rem;
          letter-spacing: 0.04em;
          color: var(--muted);
          text-decoration: none;
        }

        .bias__back a:hover {
          color: var(--ink);
        }

        .bias__hero-rule {
          height: 1px;
          background: var(--line);
        }

        .bias__section {
          padding-top: 2.75rem;
        }

        .bias__section-eyebrow {
          margin-bottom: 1.25rem;
        }

        .bias__empty {
          padding-top: 3rem;
          color: var(--muted);
        }

        .bias__empty code {
          font-family: var(--mono);
          background: var(--panel-2);
          padding: 0.12em 0.4em;
          border-radius: 3px;
        }

        .bias__cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 0.9rem;
          margin-bottom: 1.1rem;
        }

        .bias__card {
          border: 1px solid var(--line);
          border-radius: 6px;
          background: var(--panel);
          padding: 1.15rem 1.25rem 1.05rem;
        }

        .bias__card-title {
          font-family: var(--mono);
          font-size: 0.6875rem;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: var(--muted);
          margin-bottom: 0.6rem;
        }

        .bias__slope {
          font-family: var(--serif);
          font-weight: 700;
          font-size: 2rem;
          line-height: 1;
          letter-spacing: -0.02em;
          color: var(--ink);
          margin-bottom: 0.4rem;
          font-variant-numeric: tabular-nums;
        }

        .bias__se {
          font-size: 0.9rem;
          font-weight: 400;
          color: var(--muted);
          letter-spacing: 0;
        }

        .bias__card-unit {
          font-size: 0.8125rem;
          line-height: 1.5;
          color: var(--muted);
          margin-bottom: 0.8rem;
          max-width: none;
        }

        .bias__card-stats {
          display: flex;
          gap: 1.1rem;
          flex-wrap: wrap;
        }

        .bias__card-stats div {
          display: flex;
          gap: 0.35rem;
          align-items: baseline;
        }

        .bias__card-stats dt {
          font-family: var(--mono);
          font-size: 0.625rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--faint);
        }

        .bias__card-stats dd {
          font-family: var(--mono);
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--ink);
          font-variant-numeric: tabular-nums;
        }

        .bias__note {
          font-size: 0.875rem;
          line-height: 1.6;
          color: var(--muted);
          max-width: var(--measure);
        }

        .bias__scatter {
          width: 100%;
          height: auto;
          border: 1px solid var(--line);
          border-radius: 6px;
          background: var(--panel);
        }

        .bias__axis-label {
          font-family: var(--mono);
          font-size: 0.6rem;
          letter-spacing: 0.06em;
          fill: var(--muted);
        }

        .bias__table-scroll {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }

        .bias__table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.875rem;
          font-variant-numeric: tabular-nums;
        }

        .bias__table th {
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

        .bias__table td {
          padding: 0.55rem 0.9rem 0.55rem 0;
          border-bottom: 1px solid var(--line);
          vertical-align: top;
          line-height: 1.5;
        }

        .bias__td-judge {
          font-family: var(--serif);
          font-weight: 700;
          font-size: 0.9rem;
          white-space: nowrap;
        }

        .bias__td-mono {
          font-family: var(--mono);
          font-size: 0.75rem;
          color: var(--ink);
          white-space: nowrap;
        }

        .bias__td-debate {
          color: var(--muted);
          max-width: 16rem;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        @media (max-width: 768px) {
          .bias__hero {
            padding-top: 3rem;
          }
        }
      `}</style>
    </div>
  );
};

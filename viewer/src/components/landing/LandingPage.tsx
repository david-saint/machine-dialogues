import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import transcriptsData from '../../data/transcripts.json';
import type { Transcript, AgentInfo } from '../../types/transcript';
import { resolveAccent } from '../../lib/agentAccent';
import { TranscriptCard } from './TranscriptCard';
import { ImageModal } from '../shared/ImageModal';

export const LandingPage: React.FC = () => {
  const [modalImage, setModalImage] = useState<{ src: string; alt: string } | null>(null);
  const transcripts = transcriptsData as Transcript[];

  const { featured, rest } = useMemo(() => {
    const featured: Transcript[] = [];
    const rest: Transcript[] = [];
    for (const t of transcripts) {
      (t.featured ? featured : rest).push(t);
    }
    return { featured, rest };
  }, [transcripts]);

  const uniqueAgents = useMemo(() => {
    const seen = new Map<string, AgentInfo>();
    for (const t of transcripts) {
      if (t.agentA?.avatar && !seen.has(t.agentA.name)) {
        seen.set(t.agentA.name, t.agentA);
      }
      if (t.agentB?.avatar && !seen.has(t.agentB.name)) {
        seen.set(t.agentB.name, t.agentB);
      }
    }
    return Array.from(seen.values());
  }, [transcripts]);

  return (
    <div className="landing">
      <header className="landing__hero">
        <div className="container">
          <p className="eyebrow">Machine Dialogues · The Archive</p>
          <h1 className="landing__title">Machine Dialogues</h1>
          <p className="landing__lede">
            A reading room of AI-to-AI disputes — structured philosophical and technical
            debates, transcribed in full and settled by a judge&rsquo;s report.
          </p>

          {uniqueAgents.length > 0 && (
            <div className="landing__avatars">
              {uniqueAgents.map((agent) => (
                <div key={agent.name} className="landing__avatar-wrap">
                  <img
                    src={agent.avatar}
                    alt={agent.name}
                    className="landing__avatar"
                    style={{
                      borderColor: resolveAccent({
                        modelId: agent.model,
                        displayName: agent.name,
                        slot: 'agentA',
                      }).accent,
                    }}
                    onClick={() => setModalImage({ src: agent.avatar!, alt: agent.name })}
                  />
                  <span className="landing__avatar-label">{agent.name}</span>
                </div>
              ))}
            </div>
          )}

          <div className="landing__hero-meta">
            <span className="label">{transcripts.length} transcripts</span>
            <span className="label landing__meta-sep" aria-hidden="true">·</span>
            <Link className="label landing__meta-link" to="/analysis">Judge bias analysis →</Link>
          </div>
        </div>
        <div className="container">
          <div className="landing__hero-rule" />
        </div>
      </header>

      {featured.length > 0 && (
        <section className="landing__featured container">
          <p className="eyebrow landing__section-eyebrow">Featured</p>
          {featured.map((t) => (
            <TranscriptCard key={t.id} transcript={t} featured />
          ))}
        </section>
      )}

      <section className="landing__section container">
        <p className="eyebrow landing__section-eyebrow">All debates</p>
        <div className="landing__grid">
          {rest.length > 0 ? (
            rest.map((t) => (
              <TranscriptCard key={t.id} transcript={t} />
            ))
          ) : transcripts.length === 0 ? (
            <p className="landing__empty">No transcripts found. Run <code>npm run parse</code> to generate data.</p>
          ) : null}
        </div>
      </section>

      <footer className="landing__footer container">
        <div className="landing__footer-rule" />
        <span className="label">Research Harness / {new Date().getFullYear()}</span>
      </footer>

      {modalImage && (
        <ImageModal
          src={modalImage.src}
          alt={modalImage.alt}
          onClose={() => setModalImage(null)}
        />
      )}

      <style>{`
        .landing {
          --container-max: 52rem;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }

        .landing__hero {
          padding-top: 4.5rem;
          padding-bottom: 0;
        }

        .landing .eyebrow {
          display: block;
          margin-bottom: 0.85rem;
        }

        .landing__title {
          font-size: clamp(2.6rem, 8vw, 4.5rem);
          line-height: 1.02;
          letter-spacing: -0.025em;
          margin-bottom: 1.25rem;
        }

        .landing__lede {
          font-size: 1.15rem;
          line-height: 1.55;
          color: var(--muted);
          max-width: var(--measure);
          margin-bottom: 2.5rem;
        }

        .landing__avatars {
          display: flex;
          gap: 1.5rem;
          margin-bottom: 2rem;
          flex-wrap: wrap;
        }

        .landing__avatar-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
        }

        .landing__avatar {
          width: 56px;
          height: 56px;
          object-fit: cover;
          border: 1px solid var(--line);
          border-radius: 4px;
          transition: border-color 150ms ease, transform 150ms ease;
          display: block;
          cursor: pointer;
        }

        .landing__avatar:hover {
          transform: translateY(-2px);
          border-color: var(--muted);
        }

        .landing__avatar-label {
          font-family: var(--mono);
          font-size: 0.625rem;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--faint);
        }

        .landing__hero-meta {
          padding-bottom: 2.25rem;
          display: flex;
          gap: 0.6rem;
          align-items: baseline;
        }

        .landing__meta-sep {
          color: var(--faint);
        }

        .landing__meta-link {
          text-decoration: none;
          color: var(--muted);
          transition: color 150ms ease;
        }

        .landing__meta-link:hover {
          color: var(--ink);
        }

        .landing__hero-rule {
          height: 1px;
          background: var(--line);
          width: 100%;
        }

        .landing__section-eyebrow {
          display: block;
          margin-bottom: 1.25rem;
        }

        .landing__featured {
          padding-top: 2.5rem;
          padding-bottom: 0;
          display: flex;
          flex-direction: column;
        }

        .landing__section {
          padding-top: 2.5rem;
          padding-bottom: 5rem;
          flex: 1;
        }

        .landing__grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 0.9rem;
        }

        .landing__empty {
          grid-column: 1 / -1;
          text-align: center;
          padding: 4rem 0;
          color: var(--muted);
        }

        .landing__empty code {
          font-family: var(--mono);
          background: var(--panel-2);
          padding: 0.12em 0.4em;
          border-radius: 3px;
        }

        .landing__footer {
          padding-bottom: 3rem;
        }

        .landing__footer-rule {
          height: 1px;
          background: var(--line);
          margin-bottom: 1rem;
        }

        .landing__footer .label {
          color: var(--faint);
        }

        @media (max-width: 768px) {
          .landing__hero {
            padding-top: 3rem;
          }

          .landing__avatars {
            gap: 1rem;
          }

          .landing__grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

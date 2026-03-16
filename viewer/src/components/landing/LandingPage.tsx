import React, { useMemo, useState } from 'react';
import transcriptsData from '../../data/transcripts.json';
import type { Transcript, AgentInfo } from '../../types/transcript';
import { TranscriptCard } from './TranscriptCard';
import { ImageModal } from '../shared/ImageModal';

const getAgentColor = (name: string): string => {
  const lower = name.toLowerCase();
  if (lower.includes('claude')) return 'var(--accent-claude)';
  if (lower.includes('gemini')) return 'var(--accent-gemini)';
  if (lower.includes('gpt')) return 'var(--accent-gpt)';
  return 'var(--text-faint)';
};

const getAgentGlow = (name: string): string => {
  const lower = name.toLowerCase();
  if (lower.includes('claude')) return 'var(--glow-claude)';
  if (lower.includes('gemini')) return 'var(--glow-gemini)';
  if (lower.includes('gpt')) return 'var(--glow-gpt)';
  return 'none';
};

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
          <h1>Machine<br />Dialogues</h1>

          {uniqueAgents.length > 0 && (
            <div className="landing__avatars">
              {uniqueAgents.map((agent) => (
                <div
                  key={agent.name}
                  className="landing__avatar-wrap"
                  style={{
                    '--agent-color': getAgentColor(agent.name),
                    '--agent-glow': getAgentGlow(agent.name),
                  } as React.CSSProperties}
                >
                  <img
                    src={agent.avatar}
                    alt={agent.name}
                    className="landing__avatar"
                    onClick={() => setModalImage({ src: agent.avatar!, alt: agent.name })}
                  />
                  <span className="landing__avatar-label">{agent.name}</span>
                </div>
              ))}
            </div>
          )}

          <div className="landing__hero-meta">
            <p className="small-caps">High-fidelity analysis of AI-to-AI philosophical disputes</p>
            <span className="label">{transcripts.length} transcripts</span>
          </div>
        </div>
        <div className="landing__hero-rule" />
      </header>

      {featured.length > 0 && (
        <section className="landing__featured container">
          {featured.map((t) => (
            <TranscriptCard key={t.id} transcript={t} featured />
          ))}
        </section>
      )}

      <section className="landing__grid container">
        {rest.length > 0 ? (
          rest.map((t) => (
            <TranscriptCard key={t.id} transcript={t} />
          ))
        ) : transcripts.length === 0 ? (
          <p className="landing__empty">No transcripts found. Run <code>npm run parse</code> to generate data.</p>
        ) : null}
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
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }

        .landing__hero {
          padding-top: 6rem;
          padding-bottom: 0;
        }

        .landing__hero h1 {
          line-height: 0.9;
          letter-spacing: -0.04em;
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
          width: 64px;
          height: 64px;
          object-fit: cover;
          border: 1px solid var(--agent-color);
          transition: box-shadow 150ms, transform 150ms;
          display: block;
          cursor: pointer;
        }

        .landing__avatar:hover {
          transform: scale(1.05);
          border-color: white;
        }

        .landing__avatar-wrap:hover .landing__avatar {
          box-shadow: var(--agent-glow);
        }

        .landing__avatar-label {
          font-family: var(--font-mono);
          font-size: 0.6rem;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: var(--text-faint);
        }

        .landing__hero-meta {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          padding-bottom: 2rem;
        }

        .landing__hero-meta p {
          font-size: 1.1rem;
          color: var(--text-muted);
        }

        .landing__hero-rule {
          height: 2px;
          background: var(--border-emphasis);
          width: 100%;
        }

        .landing__featured {
          padding-top: 2.5rem;
          padding-bottom: 0;
          display: flex;
          flex-direction: column;
        }

        .landing__featured .tcard {
          max-width: 600px;
        }

        .landing__grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
          padding-top: 2rem;
          padding-bottom: 6rem;
          flex: 1;
        }

        .landing__empty {
          grid-column: 1 / -1;
          text-align: center;
          padding: 4rem 0;
          color: var(--text-muted);
        }

        .landing__empty code {
          background: rgba(255, 255, 255, 0.06);
          padding: 0.15em 0.4em;
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .landing__footer {
          padding-bottom: 3rem;
        }

        .landing__footer-rule {
          height: 1px;
          background: var(--border);
          margin-bottom: 1rem;
        }

        .landing__footer .label {
          color: var(--text-faint);
        }

        @media (max-width: 768px) {
          .landing__hero {
            padding-top: 3rem;
          }

          .landing__avatars {
            gap: 1rem;
          }

          .landing__avatar {
            width: 48px;
            height: 48px;
          }

          .landing__grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

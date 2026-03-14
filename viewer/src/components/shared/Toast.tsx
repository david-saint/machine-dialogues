import React, { useEffect } from 'react';
import { useToastStore } from '../../stores/toast';

const getToastBackground = (level: 'info' | 'success' | 'warning' | 'error') => {
  if (level === 'success') return '#2f6f45';
  if (level === 'warning') return '#8a6116';
  if (level === 'error') return '#a03333';
  return '#2f4f85';
};

export const Toast: React.FC = () => {
  const { toasts, removeToast } = useToastStore();

  useEffect(() => {
    const timers = toasts.map((toast) =>
      window.setTimeout(() => {
        removeToast(toast.id);
      }, toast.durationMs),
    );

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [removeToast, toasts]);

  return (
    <div className="toast-stack" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="toast-item"
          style={{ background: getToastBackground(toast.level) }}
          role="status"
        >
          <span>{toast.message}</span>
          <button className="toast-close" onClick={() => removeToast(toast.id)} aria-label="Dismiss notification">
            x
          </button>
        </div>
      ))}

      <style>{`
        .toast-stack {
          position: fixed;
          right: 1rem;
          bottom: 5.5rem;
          z-index: 160;
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
          max-width: min(420px, calc(100vw - 2rem));
        }

        .toast-item {
          color: #fff;
          border: 1px solid rgba(255, 255, 255, 0.15);
          font-family: var(--font-mono);
          font-size: 0.72rem;
          letter-spacing: 0.02em;
          padding: 0.55rem 0.6rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.8rem;
        }

        .toast-close {
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.25);
          color: inherit;
          font-family: var(--font-mono);
          font-size: 0.62rem;
          line-height: 1;
          padding: 0.2rem 0.35rem;
          cursor: pointer;
        }

        @media (max-width: 768px) {
          .toast-stack {
            left: 1rem;
            right: 1rem;
            bottom: 5rem;
          }
        }
      `}</style>
    </div>
  );
};

import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '2.5rem 1.25rem',
          color: 'var(--ink)',
          background: 'var(--bg)',
          minHeight: '100vh',
          fontFamily: 'var(--mono)',
          maxWidth: '42rem',
          margin: '0 auto',
        }}>
          <p style={{
            fontSize: '0.6875rem',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--agent-a)',
          }}>Error</p>
          <h1 style={{ fontFamily: 'var(--serif)', margin: '0.5rem 0 1rem' }}>Something went wrong.</h1>
          <pre style={{
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            color: 'var(--muted)',
            background: 'var(--panel)',
            border: '1px solid var(--line)',
            borderRadius: '5px',
            padding: '1rem',
            fontSize: '0.8rem',
          }}>{this.state.error?.toString()}</pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '1.25rem',
              fontFamily: 'var(--mono)',
              fontSize: '0.75rem',
              color: 'var(--ink)',
              background: 'transparent',
              border: '1px solid var(--line)',
              borderRadius: '4px',
              padding: '0.45rem 0.9rem',
              cursor: 'pointer',
            }}
          >Reload</button>
        </div>
      );
    }

    return this.props.children;
  }
}

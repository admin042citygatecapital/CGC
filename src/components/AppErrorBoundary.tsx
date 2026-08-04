/**
 * AppErrorBoundary — Global React error boundary.
 * Catches any unhandled render errors and shows a recovery UI
 * instead of a white screen crash.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props  { children: ReactNode; fallback?: ReactNode; }
interface State  { hasError: boolean; error: Error | null; }

export default class AppErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[AppErrorBoundary] Caught render error:', {
      message: error.message,
      stack:   error.stack,
      componentStack: info.componentStack,
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback) return this.props.fallback;

    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#0A0A0A',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div style={{ maxWidth: 480, textAlign: 'center' }}>
          {/* CGC gold accent bar */}
          <div style={{ width: 48, height: 4, background: '#C9A84C', borderRadius: 2, margin: '0 auto 1.5rem' }} />
          <h1 style={{ color: '#fff', fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.75rem' }}>
            Something went wrong
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.875rem', marginBottom: '2rem', lineHeight: 1.6 }}>
            An unexpected error occurred. The issue has been logged. Please return to the home page.
          </p>
          {process.env.NODE_ENV !== 'production' && this.state.error && (
            <pre style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 8,
              padding: '1rem',
              fontSize: '0.7rem',
              color: 'rgba(255,100,100,0.8)',
              textAlign: 'left',
              overflowX: 'auto',
              marginBottom: '1.5rem',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}>
              {this.state.error.message}
            </pre>
          )}
          <button
            onClick={this.handleReset}
            style={{
              background: 'linear-gradient(135deg, #C9A84C, #F0D080)',
              color: '#000',
              border: 'none',
              borderRadius: 12,
              padding: '0.75rem 2rem',
              fontWeight: 700,
              fontSize: '0.875rem',
              cursor: 'pointer',
            }}
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }
}

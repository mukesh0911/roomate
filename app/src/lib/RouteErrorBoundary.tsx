import { Component, type ErrorInfo, type ReactNode } from 'react';

/** Keeps a render failure recoverable without exposing profile data or stacks. */
export class RouteErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    console.error('NestMate could not render this page:', _error);
  }

  render() {
    if (this.state.failed) {
      return (
        <main role="alert" style={{ padding: '2rem', maxWidth: '36rem', margin: 'auto' }}>
          <h1>This page couldn’t load</h1>
          <p>Reload the page to try again. If the problem continues, return to the home page.</p>
          <button onClick={() => window.location.reload()}>Reload page</button>{' '}
          <a href="/">Return home</a>
        </main>
      );
    }
    return this.props.children;
  }
}

// FIX: Switched to a default import for React to align with the project's convention.
// The namespace import (`import * as React`) was causing a type resolution issue where
// the component class did not correctly inherit properties like `props` from React.Component.
import React from 'react';
import { FaExclamationTriangle } from 'react-icons/fa';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-bg-primary text-text-primary flex flex-col items-center justify-center text-center p-4">
          <FaExclamationTriangle className="text-5xl text-error mb-4" />
          <h1 className="text-3xl font-bold font-heading mb-2">Oops! Something went wrong.</h1>
          <p className="text-text-secondary mb-6">We're sorry for the inconvenience. Please try refreshing the page.</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-accent-primary text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors"
          >
            Refresh Page
          </button>
          {this.state.error && (
            <details className="mt-8 text-left bg-surface p-4 rounded-lg max-w-2xl w-full">
              <summary className="cursor-pointer text-text-secondary">Error Details</summary>
              <pre className="mt-2 text-sm text-text-muted whitespace-pre-wrap overflow-x-auto">
                {this.state.error.toString()}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

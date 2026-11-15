'use client';

import React from 'react';
import {AlertTriangle, Bug, RotateCcw} from 'lucide-react';
import {reportClientError} from '@/lib/observatory/diagnostics';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  scope: string;
  title?: string;
  subtitle?: string;
  retryLabel?: string;
  diagnosticsLabel?: string;
  onOpenDiagnostics?: () => void;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {hasError: false, errorMessage: ''};
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'Unexpected rendering error',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    reportClientError(
      `ErrorBoundary:${this.props.scope}`,
      error,
      info?.componentStack ? info.componentStack.slice(0, 600) : undefined,
    );
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="flex h-full w-full items-center justify-center bg-[#0B0F14] p-6 text-[#E6EDF3]">
          <div className="w-full max-w-md rounded-md border border-red-500/40 bg-[#121821] p-5 shadow-2xl">
            <div className="flex items-center gap-2 text-red-300">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <h2 className="text-sm font-bold">
                {this.props.title ?? 'Observatory Module Recovered from Error'}
              </h2>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-[#9FB0C3]">
              {this.props.subtitle ??
                'A client runtime exception was intercepted to protect the application. You can retry or inspect the non-secret diagnostic log.'}
            </p>
            {this.state.errorMessage && (
              <div className="mt-3 rounded border border-white/10 bg-[#0B0F14] p-2.5 font-mono text-[11px] text-red-200">
                {this.state.errorMessage}
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => this.setState({hasError: false, errorMessage: ''})}
                className="flex items-center gap-1.5 rounded bg-[#D99B26] px-3 py-1.5 text-xs font-semibold text-[#0B0F14] transition hover:bg-[#F2BE49]"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>{this.props.retryLabel ?? 'Retry Module'}</span>
              </button>
              {this.props.onOpenDiagnostics && (
                <button
                  type="button"
                  onClick={this.props.onOpenDiagnostics}
                  className="flex items-center gap-1.5 rounded border border-white/15 bg-[#18212C] px-3 py-1.5 text-xs text-[#E6EDF3] transition hover:border-[#D99B26]/60"
                >
                  <Bug className="h-3.5 w-3.5 text-[#57b8d8]" />
                  <span>{this.props.diagnosticsLabel ?? 'Diagnostics'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

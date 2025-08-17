interface ErrorReport {
  timestamp: string;
  error: string;
  stack?: string;
  userAgent: string;
  url: string;
  userId?: string;
  context?: Record<string, unknown>;
}

class ErrorTracker {
  private isEnabled: boolean = true;
  private maxReports: number = 100;

  async trackError(
    error: Error,
    context?: Record<string, unknown>
  ): Promise<void> {
    if (!this.isEnabled) {
      return;
    }

    const report: ErrorReport = {
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: error.stack,
      userAgent: navigator.userAgent,
      url: window.location.href,
      context,
    };

    try {
      // Store error report locally
      await this.storeErrorReport(report);
    } catch (storageError) {
      console.error('Failed to store error report:', storageError);
    }
  }

  async trackUnhandledError(event: ErrorEvent): Promise<void> {
    const error = new Error(event.message);
    error.stack = `${event.filename}:${event.lineno}:${event.colno}`;

    await this.trackError(error, {
      type: 'unhandled',
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  }

  async trackUnhandledPromiseRejection(
    event: PromiseRejectionEvent
  ): Promise<void> {
    const error =
      event.reason instanceof Error
        ? event.reason
        : new Error(String(event.reason));

    await this.trackError(error, {
      type: 'unhandled_promise_rejection',
    });
  }

  private async storeErrorReport(report: ErrorReport): Promise<void> {
    try {
      // Get existing reports
      const existingReports = await this.getStoredReports();

      // Add new report
      existingReports.push(report);

      // Keep only the most recent reports
      const recentReports = existingReports
        .sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        )
        .slice(0, this.maxReports);

      // Store back to localStorage
      localStorage.setItem(
        'kirapilot_error_reports',
        JSON.stringify(recentReports)
      );
    } catch (error) {
      console.error('Failed to store error report:', error);
    }
  }

  async getStoredReports(): Promise<ErrorReport[]> {
    try {
      const stored = localStorage.getItem('kirapilot_error_reports');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  async clearReports(): Promise<void> {
    localStorage.removeItem('kirapilot_error_reports');
  }

  async exportReports(): Promise<string> {
    const reports = await this.getStoredReports();
    return JSON.stringify(reports, null, 2);
  }

  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  isTrackingEnabled(): boolean {
    return this.isEnabled;
  }

  setupGlobalHandlers(): void {
    // Handle unhandled JavaScript errors
    window.addEventListener('error', event => {
      this.trackUnhandledError(event);
    });

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', event => {
      this.trackUnhandledPromiseRejection(event);
    });
  }
}

// Create and export singleton instance
export const errorTracker = new ErrorTracker();

// React Error Boundary helper
export class ErrorBoundary {
  static handleError(
    error: Error,
    errorInfo: { componentStack: string }
  ): void {
    errorTracker.trackError(error, {
      type: 'react_error_boundary',
      componentStack: errorInfo.componentStack,
    });
  }
}

// Hook for component-level error tracking
export function useErrorTracking() {
  const trackError = (error: Error, context?: Record<string, unknown>) => {
    errorTracker.trackError(error, context);
  };

  const trackAsyncError = async (
    asyncFn: () => Promise<void>,
    context?: Record<string, unknown>
  ) => {
    try {
      await asyncFn();
    } catch (error) {
      if (error instanceof Error) {
        trackError(error, { ...context, type: 'async_operation' });
      }
      throw error; // Re-throw to maintain normal error handling
    }
  };

  return { trackError, trackAsyncError };
}

interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: string;
  category: 'database' | 'render' | 'navigation' | 'api' | 'custom';
  tags?: Record<string, string>;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private maxMetrics: number = 1000;
  private isEnabled: boolean = true;

  startTiming(
    name: string,
    category: PerformanceMetric['category'] = 'custom'
  ): () => void {
    if (!this.isEnabled) {
      return () => {};
    }

    const startTime = performance.now();

    return (tags?: Record<string, string>) => {
      const endTime = performance.now();
      const duration = endTime - startTime;

      this.recordMetric({
        name,
        value: duration,
        timestamp: new Date().toISOString(),
        category,
        tags,
      });
    };
  }

  recordMetric(metric: PerformanceMetric): void {
    if (!this.isEnabled) {
      return;
    }

    this.metrics.push(metric);

    // Keep only the most recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
  }

  recordDatabaseOperation(
    operation: string,
    duration: number,
    tags?: Record<string, string>
  ): void {
    this.recordMetric({
      name: `db_${operation}`,
      value: duration,
      timestamp: new Date().toISOString(),
      category: 'database',
      tags,
    });
  }

  recordRenderTime(component: string, duration: number): void {
    this.recordMetric({
      name: `render_${component}`,
      value: duration,
      timestamp: new Date().toISOString(),
      category: 'render',
    });
  }

  recordNavigationTime(route: string, duration: number): void {
    this.recordMetric({
      name: `navigation_${route}`,
      value: duration,
      timestamp: new Date().toISOString(),
      category: 'navigation',
    });
  }

  getMetrics(category?: PerformanceMetric['category']): PerformanceMetric[] {
    if (category) {
      return this.metrics.filter(m => m.category === category);
    }
    return [...this.metrics];
  }

  getAverageMetric(name: string, timeWindow?: number): number | null {
    const now = Date.now();
    const windowStart = timeWindow ? now - timeWindow : 0;

    const relevantMetrics = this.metrics.filter(m => {
      const metricTime = new Date(m.timestamp).getTime();
      return m.name === name && metricTime >= windowStart;
    });

    if (relevantMetrics.length === 0) {
      return null;
    }

    const sum = relevantMetrics.reduce((acc, m) => acc + m.value, 0);
    return sum / relevantMetrics.length;
  }

  getPerformanceSummary(): Record<
    string,
    { count: number; average: number; max: number; min: number }
  > {
    const summary: Record<
      string,
      { count: number; average: number; max: number; min: number }
    > = {};

    for (const metric of this.metrics) {
      if (!summary[metric.name]) {
        summary[metric.name] = {
          count: 0,
          average: 0,
          max: -Infinity,
          min: Infinity,
        };
      }

      const stats = summary[metric.name];
      stats.count++;
      stats.max = Math.max(stats.max, metric.value);
      stats.min = Math.min(stats.min, metric.value);
      stats.average =
        (stats.average * (stats.count - 1) + metric.value) / stats.count;
    }

    return summary;
  }

  clearMetrics(): void {
    this.metrics = [];
  }

  exportMetrics(): string {
    return JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        summary: this.getPerformanceSummary(),
        metrics: this.metrics,
      },
      null,
      2
    );
  }

  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  isMonitoringEnabled(): boolean {
    return this.isEnabled;
  }

  // Monitor Web Vitals
  setupWebVitalsMonitoring(): void {
    if (!this.isEnabled) {
      return;
    }

    // Monitor First Contentful Paint
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver(list => {
          for (const entry of list.getEntries()) {
            if (
              entry.entryType === 'paint' &&
              entry.name === 'first-contentful-paint'
            ) {
              this.recordMetric({
                name: 'first_contentful_paint',
                value: entry.startTime,
                timestamp: new Date().toISOString(),
                category: 'render',
              });
            }
          }
        });
        observer.observe({ entryTypes: ['paint'] });
      } catch (error) {
        console.warn('Could not observe paint metrics:', error);
      }
    }

    // Monitor navigation timing
    window.addEventListener('load', () => {
      const navTiming = performance.getEntriesByType(
        'navigation'
      )[0] as PerformanceNavigationTiming;
      if (navTiming) {
        this.recordMetric({
          name: 'page_load_time',
          value: navTiming.loadEventEnd - navTiming.fetchStart,
          timestamp: new Date().toISOString(),
          category: 'navigation',
        });

        this.recordMetric({
          name: 'dom_content_loaded',
          value: navTiming.domContentLoadedEventEnd - navTiming.fetchStart,
          timestamp: new Date().toISOString(),
          category: 'navigation',
        });
      }
    });
  }
}

// Create and export singleton instance
export const performanceMonitor = new PerformanceMonitor();

// React hook for component performance monitoring
export function usePerformanceMonitoring() {
  const startTiming = (
    name: string,
    category: PerformanceMetric['category'] = 'render'
  ) => {
    return performanceMonitor.startTiming(name, category);
  };

  const recordMetric = (
    name: string,
    value: number,
    category: PerformanceMetric['category'] = 'custom'
  ) => {
    performanceMonitor.recordMetric({
      name,
      value,
      timestamp: new Date().toISOString(),
      category,
    });
  };

  return { startTiming, recordMetric };
}

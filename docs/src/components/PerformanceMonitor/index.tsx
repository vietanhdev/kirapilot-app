import { useEffect } from 'react';

interface PerformanceMetrics {
  pageLoadTime: number;
  domContentLoaded: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  cumulativeLayoutShift: number;
  firstInputDelay: number;
}

class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Partial<PerformanceMetrics> = {};
  private observers: PerformanceObserver[] = [];

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  init(): void {
    if (typeof window === 'undefined') {
      return;
    }

    this.measureNavigationTiming();
    this.measureWebVitals();
    this.measureResourceTiming();
  }

  private measureNavigationTiming(): void {
    if (!('performance' in window)) {
      return;
    }

    const navigation = performance.getEntriesByType(
      'navigation'
    )[0] as PerformanceNavigationTiming;
    if (navigation) {
      this.metrics.pageLoadTime =
        navigation.loadEventEnd - navigation.fetchStart;
      this.metrics.domContentLoaded =
        navigation.domContentLoadedEventEnd - navigation.fetchStart;
    }
  }

  private measureWebVitals(): void {
    // Largest Contentful Paint
    if ('PerformanceObserver' in window) {
      const lcpObserver = new PerformanceObserver(list => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        this.metrics.largestContentfulPaint = lastEntry.startTime;
      });
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      this.observers.push(lcpObserver);

      // First Input Delay
      const fidObserver = new PerformanceObserver(list => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          this.metrics.firstInputDelay =
            entry.processingStart - entry.startTime;
        });
      });
      fidObserver.observe({ entryTypes: ['first-input'] });
      this.observers.push(fidObserver);

      // Cumulative Layout Shift
      let clsValue = 0;
      const clsObserver = new PerformanceObserver(list => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        });
        this.metrics.cumulativeLayoutShift = clsValue;
      });
      clsObserver.observe({ entryTypes: ['layout-shift'] });
      this.observers.push(clsObserver);
    }
  }

  private measureResourceTiming(): void {
    if (!('performance' in window)) {
      return;
    }

    // Monitor slow resources
    const resources = performance.getEntriesByType('resource');
    const slowResources = resources.filter(
      (resource: any) => resource.duration > 1000 // Resources taking more than 1 second
    );

    if (slowResources.length > 0) {
      console.warn('Slow resources detected:', slowResources);
    }
  }

  getMetrics(): Partial<PerformanceMetrics> {
    return { ...this.metrics };
  }

  reportMetrics(): void {
    const metrics = this.getMetrics();

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.group('📊 Performance Metrics');
      console.table(metrics);
      console.groupEnd();
    }

    // Performance metrics are logged to console in development only
    // No analytics tracking for privacy
  }

  cleanup(): void {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
  }
}

export default function usePerformanceMonitor(): void {
  useEffect(() => {
    const monitor = PerformanceMonitor.getInstance();
    monitor.init();

    // Report metrics after page is fully loaded
    const reportTimer = setTimeout(() => {
      monitor.reportMetrics();
    }, 3000);

    return () => {
      clearTimeout(reportTimer);
      monitor.cleanup();
    };
  }, []);
}

export { PerformanceMonitor };

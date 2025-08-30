/**
 * Performance monitoring service for AI interactions
 * Tracks performance metrics with minimal overhead and provides insights
 */

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: 'ms' | 'bytes' | 'count' | 'percentage';
  timestamp: Date;
  category: 'response_time' | 'memory' | 'cpu' | 'network' | 'user_experience';
}

export interface PerformanceThreshold {
  metric: string;
  warning: number;
  critical: number;
  unit: string;
}

export interface PerformanceReport {
  period: {
    start: Date;
    end: Date;
  };
  metrics: PerformanceMetric[];
  summary: {
    averageResponseTime: number;
    peakMemoryUsage: number;
    errorRate: number;
    throughput: number;
  };
  alerts: PerformanceAlert[];
  recommendations: string[];
}

export interface PerformanceAlert {
  level: 'warning' | 'critical';
  metric: string;
  value: number;
  threshold: number;
  message: string;
  timestamp: Date;
}

/**
 * Lightweight performance monitoring with configurable overhead limits
 */
export class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetric[]> = new Map();
  private activeOperations: Map<
    string,
    { startTime: number; metadata: Record<string, unknown> }
  > = new Map();
  private thresholds: Map<string, PerformanceThreshold> = new Map();
  private isEnabled: boolean = true;
  private maxMetricsPerCategory: number = 1000;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private alertCallback?: (alert: PerformanceAlert) => void;

  constructor(options?: {
    enabled?: boolean;
    maxMetricsPerCategory?: number;
    cleanupIntervalMs?: number;
    alertCallback?: (alert: PerformanceAlert) => void;
  }) {
    this.isEnabled = options?.enabled ?? true;
    this.maxMetricsPerCategory = options?.maxMetricsPerCategory ?? 1000;
    this.alertCallback = options?.alertCallback;

    // Set default thresholds
    this.setDefaultThresholds();

    // Start cleanup interval
    if (options?.cleanupIntervalMs) {
      this.cleanupInterval = setInterval(() => {
        this.cleanupOldMetrics();
      }, options.cleanupIntervalMs);
    }
  }

  /**
   * Set default performance thresholds
   */
  private setDefaultThresholds(): void {
    this.thresholds.set('response_time', {
      metric: 'response_time',
      warning: 2000, // 2 seconds
      critical: 5000, // 5 seconds
      unit: 'ms',
    });

    this.thresholds.set('memory_usage', {
      metric: 'memory_usage',
      warning: 100 * 1024 * 1024, // 100MB
      critical: 500 * 1024 * 1024, // 500MB
      unit: 'bytes',
    });

    this.thresholds.set('error_rate', {
      metric: 'error_rate',
      warning: 5, // 5%
      critical: 10, // 10%
      unit: 'percentage',
    });
  }

  /**
   * Start tracking an operation
   */
  public startOperation(
    operationId: string,
    metadata?: Record<string, unknown>
  ): void {
    if (!this.isEnabled) {
      return;
    }

    this.activeOperations.set(operationId, {
      startTime: performance.now(),
      metadata: metadata || {},
    });
  }

  /**
   * End tracking an operation and record metrics
   */
  public endOperation(
    operationId: string,
    result?: {
      success: boolean;
      error?: string;
      additionalMetrics?: Record<string, number>;
    }
  ): number {
    if (!this.isEnabled) {
      return 0;
    }

    const operation = this.activeOperations.get(operationId);
    if (!operation) {
      console.warn(`No active operation found for ID: ${operationId}`);
      return 0;
    }

    const duration = performance.now() - operation.startTime;

    // Record response time metric
    this.recordMetric({
      name: 'response_time',
      value: duration,
      unit: 'ms',
      timestamp: new Date(),
      category: 'response_time',
    });

    // Record success/error metrics
    if (result) {
      this.recordMetric({
        name: result.success ? 'operation_success' : 'operation_error',
        value: 1,
        unit: 'count',
        timestamp: new Date(),
        category: 'user_experience',
      });

      // Record additional metrics if provided
      if (result.additionalMetrics) {
        Object.entries(result.additionalMetrics).forEach(([name, value]) => {
          this.recordMetric({
            name,
            value,
            unit: 'count',
            timestamp: new Date(),
            category: 'user_experience',
          });
        });
      }
    }

    // Check thresholds and generate alerts
    this.checkThresholds('response_time', duration);

    // Clean up
    this.activeOperations.delete(operationId);

    return duration;
  }

  /**
   * Record a performance metric
   */
  public recordMetric(metric: PerformanceMetric): void {
    if (!this.isEnabled) {
      return;
    }

    const categoryMetrics = this.metrics.get(metric.category) || [];
    categoryMetrics.push(metric);

    // Limit metrics per category to prevent memory bloat
    if (categoryMetrics.length > this.maxMetricsPerCategory) {
      categoryMetrics.shift(); // Remove oldest metric
    }

    this.metrics.set(metric.category, categoryMetrics);

    // Check thresholds
    this.checkThresholds(metric.name, metric.value);
  }

  /**
   * Record memory usage
   */
  public recordMemoryUsage(): void {
    const performanceWithMemory = performance as typeof performance & {
      memory?: {
        usedJSHeapSize: number;
        totalJSHeapSize: number;
        jsHeapSizeLimit: number;
      };
    };

    if (
      !this.isEnabled ||
      typeof performanceWithMemory.memory === 'undefined'
    ) {
      return;
    }

    const memoryInfo = performanceWithMemory.memory;

    this.recordMetric({
      name: 'memory_used_heap',
      value: memoryInfo.usedJSHeapSize,
      unit: 'bytes',
      timestamp: new Date(),
      category: 'memory',
    });

    this.recordMetric({
      name: 'memory_total_heap',
      value: memoryInfo.totalJSHeapSize,
      unit: 'bytes',
      timestamp: new Date(),
      category: 'memory',
    });

    this.recordMetric({
      name: 'memory_heap_limit',
      value: memoryInfo.jsHeapSizeLimit,
      unit: 'bytes',
      timestamp: new Date(),
      category: 'memory',
    });
  }

  /**
   * Get performance report for a time period
   */
  public getPerformanceReport(
    startDate?: Date,
    endDate?: Date
  ): PerformanceReport {
    const start = startDate || new Date(Date.now() - 24 * 60 * 60 * 1000); // Last 24 hours
    const end = endDate || new Date();

    const allMetrics: PerformanceMetric[] = [];
    const alerts: PerformanceAlert[] = [];

    // Collect metrics from all categories within the time range
    this.metrics.forEach(categoryMetrics => {
      const filteredMetrics = categoryMetrics.filter(
        metric => metric.timestamp >= start && metric.timestamp <= end
      );
      allMetrics.push(...filteredMetrics);
    });

    // Calculate summary statistics
    const responseTimeMetrics = allMetrics.filter(
      m => m.name === 'response_time'
    );
    const memoryMetrics = allMetrics.filter(m => m.name === 'memory_used_heap');
    const successMetrics = allMetrics.filter(
      m => m.name === 'operation_success'
    );
    const errorMetrics = allMetrics.filter(m => m.name === 'operation_error');

    const averageResponseTime =
      responseTimeMetrics.length > 0
        ? responseTimeMetrics.reduce((sum, m) => sum + m.value, 0) /
          responseTimeMetrics.length
        : 0;

    const peakMemoryUsage =
      memoryMetrics.length > 0
        ? Math.max(...memoryMetrics.map(m => m.value))
        : 0;

    const totalOperations = successMetrics.length + errorMetrics.length;
    const errorRate =
      totalOperations > 0 ? (errorMetrics.length / totalOperations) * 100 : 0;

    const throughput =
      totalOperations / ((end.getTime() - start.getTime()) / (60 * 1000)); // operations per minute

    // Generate recommendations
    const recommendations = this.generateRecommendations({
      averageResponseTime,
      peakMemoryUsage,
      errorRate,
      throughput,
    });

    return {
      period: { start, end },
      metrics: allMetrics,
      summary: {
        averageResponseTime,
        peakMemoryUsage,
        errorRate,
        throughput,
      },
      alerts,
      recommendations,
    };
  }

  /**
   * Check performance thresholds and generate alerts
   */
  private checkThresholds(metricName: string, value: number): void {
    const threshold = this.thresholds.get(metricName);
    if (!threshold) {
      return;
    }

    let alert: PerformanceAlert | null = null;

    if (value >= threshold.critical) {
      alert = {
        level: 'critical',
        metric: metricName,
        value,
        threshold: threshold.critical,
        message: `${metricName} (${value}${threshold.unit}) exceeded critical threshold (${threshold.critical}${threshold.unit})`,
        timestamp: new Date(),
      };
    } else if (value >= threshold.warning) {
      alert = {
        level: 'warning',
        metric: metricName,
        value,
        threshold: threshold.warning,
        message: `${metricName} (${value}${threshold.unit}) exceeded warning threshold (${threshold.warning}${threshold.unit})`,
        timestamp: new Date(),
      };
    }

    if (alert && this.alertCallback) {
      this.alertCallback(alert);
    }
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(summary: {
    averageResponseTime: number;
    peakMemoryUsage: number;
    errorRate: number;
    throughput: number;
  }): string[] {
    const recommendations: string[] = [];

    if (summary.averageResponseTime > 2000) {
      recommendations.push(
        'Consider optimizing AI model inference or reducing context size to improve response times'
      );
    }

    if (summary.peakMemoryUsage > 100 * 1024 * 1024) {
      recommendations.push(
        'Memory usage is high. Consider implementing more aggressive cleanup of old logs and metrics'
      );
    }

    if (summary.errorRate > 5) {
      recommendations.push(
        'Error rate is elevated. Review error logs and implement better error handling'
      );
    }

    if (summary.throughput < 1) {
      recommendations.push(
        'Low throughput detected. Consider optimizing the AI service pipeline'
      );
    }

    if (recommendations.length === 0) {
      recommendations.push('Performance is within acceptable ranges');
    }

    return recommendations;
  }

  /**
   * Clean up old metrics to prevent memory bloat
   */
  private cleanupOldMetrics(): void {
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // Keep last 24 hours

    this.metrics.forEach((categoryMetrics, category) => {
      const filteredMetrics = categoryMetrics.filter(
        metric => metric.timestamp > cutoffTime
      );
      this.metrics.set(category, filteredMetrics);
    });
  }

  /**
   * Set custom performance threshold
   */
  public setThreshold(
    metric: string,
    warning: number,
    critical: number,
    unit: string
  ): void {
    this.thresholds.set(metric, {
      metric,
      warning,
      critical,
      unit,
    });
  }

  /**
   * Get current performance status
   */
  public getPerformanceStatus(): {
    isHealthy: boolean;
    activeOperations: number;
    totalMetrics: number;
    memoryUsage?: number;
  } {
    const totalMetrics = Array.from(this.metrics.values()).reduce(
      (sum, metrics) => sum + metrics.length,
      0
    );

    let memoryUsage: number | undefined;
    const performanceWithMemory = performance as typeof performance & {
      memory?: { usedJSHeapSize: number };
    };
    if (typeof performanceWithMemory.memory !== 'undefined') {
      memoryUsage = performanceWithMemory.memory.usedJSHeapSize;
    }

    // Simple health check based on active operations and memory
    const isHealthy =
      this.activeOperations.size < 10 &&
      totalMetrics < this.maxMetricsPerCategory * 5;

    return {
      isHealthy,
      activeOperations: this.activeOperations.size,
      totalMetrics,
      memoryUsage,
    };
  }

  /**
   * Enable or disable performance monitoring
   */
  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;

    if (!enabled) {
      // Clean up when disabled
      this.activeOperations.clear();
      this.metrics.clear();
    }
  }

  /**
   * Clean up resources
   */
  public cleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.activeOperations.clear();
    this.metrics.clear();
    this.thresholds.clear();
  }
}

// Singleton instance for global performance monitoring
let performanceMonitorInstance: PerformanceMonitor | null = null;

/**
 * Get global PerformanceMonitor instance
 */
export function getPerformanceMonitor(): PerformanceMonitor {
  if (!performanceMonitorInstance) {
    performanceMonitorInstance = new PerformanceMonitor({
      enabled: true,
      maxMetricsPerCategory: 1000,
      cleanupIntervalMs: 5 * 60 * 1000, // 5 minutes
      alertCallback: alert => {
        console.warn(`Performance Alert [${alert.level}]:`, alert.message);
      },
    });
  }
  return performanceMonitorInstance;
}

/**
 * Initialize PerformanceMonitor with custom options
 */
export function initializePerformanceMonitor(options: {
  enabled?: boolean;
  maxMetricsPerCategory?: number;
  cleanupIntervalMs?: number;
  alertCallback?: (alert: PerformanceAlert) => void;
}): PerformanceMonitor {
  performanceMonitorInstance = new PerformanceMonitor(options);
  return performanceMonitorInstance;
}

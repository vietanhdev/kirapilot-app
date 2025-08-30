import {
  PerformanceMonitor,
  getPerformanceMonitor,
  initializePerformanceMonitor,
  PerformanceMetric,
} from '../PerformanceMonitor';

// Mock performance.now for consistent testing
const mockPerformanceNow = jest.fn();
Object.defineProperty(global, 'performance', {
  value: {
    now: mockPerformanceNow,
    memory: {
      usedJSHeapSize: 50 * 1024 * 1024, // 50MB
      totalJSHeapSize: 100 * 1024 * 1024, // 100MB
      jsHeapSizeLimit: 2 * 1024 * 1024 * 1024, // 2GB
    },
  },
  writable: true,
});

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor;
  let alertCallback: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPerformanceNow.mockReturnValue(0);
    alertCallback = jest.fn();

    monitor = new PerformanceMonitor({
      enabled: true,
      maxMetricsPerCategory: 100,
      alertCallback,
    });
  });

  afterEach(() => {
    monitor.cleanup();
  });

  describe('Operation Tracking', () => {
    it('should track operation duration correctly', () => {
      const operationId = 'test-operation';

      // Start operation
      mockPerformanceNow.mockReturnValue(1000);
      monitor.startOperation(operationId, { type: 'ai-request' });

      // End operation
      mockPerformanceNow.mockReturnValue(3000);
      const duration = monitor.endOperation(operationId, { success: true });

      expect(duration).toBe(2000);
    });

    it('should handle missing operation gracefully', () => {
      const duration = monitor.endOperation('non-existent', { success: false });
      expect(duration).toBe(0);
    });

    it('should record success and error metrics', () => {
      const operationId = 'test-operation';

      mockPerformanceNow.mockReturnValue(1000);
      monitor.startOperation(operationId);

      mockPerformanceNow.mockReturnValue(2000);
      monitor.endOperation(operationId, {
        success: true,
        additionalMetrics: { tokens_processed: 150 },
      });

      const report = monitor.getPerformanceReport();

      const successMetrics = report.metrics.filter(
        m => m.name === 'operation_success'
      );
      const tokenMetrics = report.metrics.filter(
        m => m.name === 'tokens_processed'
      );

      expect(successMetrics).toHaveLength(1);
      expect(tokenMetrics).toHaveLength(1);
      expect(tokenMetrics[0].value).toBe(150);
    });
  });

  describe('Metric Recording', () => {
    it('should record custom metrics', () => {
      const metric: PerformanceMetric = {
        name: 'custom_metric',
        value: 42,
        unit: 'count',
        timestamp: new Date(),
        category: 'user_experience',
      };

      monitor.recordMetric(metric);

      const report = monitor.getPerformanceReport();
      const customMetrics = report.metrics.filter(
        m => m.name === 'custom_metric'
      );

      expect(customMetrics).toHaveLength(1);
      expect(customMetrics[0].value).toBe(42);
    });

    it('should limit metrics per category', () => {
      const testMonitor = new PerformanceMonitor({
        enabled: true,
        maxMetricsPerCategory: 2,
      });

      // Add 3 metrics to same category
      for (let i = 0; i < 3; i++) {
        testMonitor.recordMetric({
          name: `metric_${i}`,
          value: i,
          unit: 'count',
          timestamp: new Date(),
          category: 'test',
        });
      }

      const report = testMonitor.getPerformanceReport();
      const testMetrics = report.metrics.filter(m => m.category === 'test');

      expect(testMetrics).toHaveLength(2);
      // Should keep the latest metrics (1 and 2, not 0)
      expect(testMetrics.map(m => m.value)).toEqual([1, 2]);

      testMonitor.cleanup();
    });
  });

  describe('Memory Monitoring', () => {
    it('should record memory usage when available', () => {
      monitor.recordMemoryUsage();

      const report = monitor.getPerformanceReport();
      const memoryMetrics = report.metrics.filter(m => m.category === 'memory');

      expect(memoryMetrics.length).toBeGreaterThan(0);

      const heapUsedMetric = memoryMetrics.find(
        m => m.name === 'memory_used_heap'
      );
      expect(heapUsedMetric).toBeDefined();
      expect(heapUsedMetric?.value).toBe(50 * 1024 * 1024);
    });

    it('should handle missing memory API gracefully', () => {
      // Temporarily remove memory API
      const performanceWithMemory = global.performance as typeof performance & {
        memory?: unknown;
      };
      const originalMemory = performanceWithMemory.memory;
      delete performanceWithMemory.memory;

      expect(() => monitor.recordMemoryUsage()).not.toThrow();

      // Restore memory API
      performanceWithMemory.memory = originalMemory;
    });
  });

  describe('Threshold Monitoring', () => {
    it('should generate warning alerts', () => {
      monitor.setThreshold('test_metric', 100, 200, 'ms');

      monitor.recordMetric({
        name: 'test_metric',
        value: 150, // Above warning threshold
        unit: 'ms',
        timestamp: new Date(),
        category: 'response_time',
      });

      expect(alertCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'warning',
          metric: 'test_metric',
          value: 150,
          threshold: 100,
        })
      );
    });

    it('should generate critical alerts', () => {
      monitor.setThreshold('test_metric', 100, 200, 'ms');

      monitor.recordMetric({
        name: 'test_metric',
        value: 250, // Above critical threshold
        unit: 'ms',
        timestamp: new Date(),
        category: 'response_time',
      });

      expect(alertCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'critical',
          metric: 'test_metric',
          value: 250,
          threshold: 200,
        })
      );
    });

    it('should not generate alerts below thresholds', () => {
      monitor.setThreshold('test_metric', 100, 200, 'ms');

      monitor.recordMetric({
        name: 'test_metric',
        value: 50, // Below warning threshold
        unit: 'ms',
        timestamp: new Date(),
        category: 'response_time',
      });

      expect(alertCallback).not.toHaveBeenCalled();
    });
  });

  describe('Performance Reports', () => {
    beforeEach(() => {
      // Add some test data
      const now = new Date();

      monitor.recordMetric({
        name: 'response_time',
        value: 1000,
        unit: 'ms',
        timestamp: new Date(now.getTime() - 1000),
        category: 'response_time',
      });

      monitor.recordMetric({
        name: 'response_time',
        value: 2000,
        unit: 'ms',
        timestamp: now,
        category: 'response_time',
      });

      monitor.recordMetric({
        name: 'operation_success',
        value: 1,
        unit: 'count',
        timestamp: now,
        category: 'user_experience',
      });

      monitor.recordMetric({
        name: 'operation_error',
        value: 1,
        unit: 'count',
        timestamp: now,
        category: 'user_experience',
      });
    });

    it('should generate comprehensive performance reports', () => {
      const report = monitor.getPerformanceReport();

      expect(report.period.start).toBeInstanceOf(Date);
      expect(report.period.end).toBeInstanceOf(Date);
      expect(report.metrics.length).toBeGreaterThan(0);

      expect(report.summary.averageResponseTime).toBe(1500); // (1000 + 2000) / 2
      expect(report.summary.errorRate).toBe(50); // 1 error out of 2 operations
      expect(report.summary.throughput).toBeGreaterThan(0);

      expect(report.recommendations).toBeInstanceOf(Array);
      expect(report.recommendations.length).toBeGreaterThan(0);
    });

    it('should filter metrics by date range', () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      const report = monitor.getPerformanceReport(oneHourAgo, now);

      expect(report.period.start).toEqual(oneHourAgo);
      expect(report.period.end).toEqual(now);

      // All our test metrics should be within the last hour
      expect(report.metrics.length).toBeGreaterThan(0);
    });

    it('should generate appropriate recommendations', () => {
      // Add metrics that should trigger recommendations
      monitor.recordMetric({
        name: 'response_time',
        value: 5000, // High response time
        unit: 'ms',
        timestamp: new Date(),
        category: 'response_time',
      });

      const report = monitor.getPerformanceReport();

      expect(
        report.recommendations.some(rec =>
          rec.includes('optimizing AI model inference')
        )
      ).toBe(true);
    });
  });

  describe('Performance Status', () => {
    it('should report current performance status', () => {
      monitor.startOperation('test-1');
      monitor.startOperation('test-2');

      const status = monitor.getPerformanceStatus();

      expect(status.activeOperations).toBe(2);
      expect(status.totalMetrics).toBeGreaterThanOrEqual(0);
      expect(status.isHealthy).toBe(true);
      expect(status.memoryUsage).toBeDefined();
    });

    it('should detect unhealthy state with too many active operations', () => {
      // Start many operations to trigger unhealthy state
      for (let i = 0; i < 15; i++) {
        monitor.startOperation(`test-${i}`);
      }

      const status = monitor.getPerformanceStatus();

      expect(status.activeOperations).toBe(15);
      expect(status.isHealthy).toBe(false);
    });
  });

  describe('Configuration', () => {
    it('should respect enabled/disabled state', () => {
      monitor.setEnabled(false);

      monitor.startOperation('test');
      monitor.recordMetric({
        name: 'test_metric',
        value: 100,
        unit: 'ms',
        timestamp: new Date(),
        category: 'test',
      });

      const report = monitor.getPerformanceReport();
      expect(report.metrics).toHaveLength(0);

      const status = monitor.getPerformanceStatus();
      expect(status.activeOperations).toBe(0);
    });

    it('should clear data when disabled', () => {
      monitor.recordMetric({
        name: 'test_metric',
        value: 100,
        unit: 'ms',
        timestamp: new Date(),
        category: 'test',
      });

      let report = monitor.getPerformanceReport();
      expect(report.metrics.length).toBeGreaterThan(0);

      monitor.setEnabled(false);

      report = monitor.getPerformanceReport();
      expect(report.metrics).toHaveLength(0);
    });
  });

  describe('Singleton Functions', () => {
    it('should return same instance from getPerformanceMonitor', () => {
      const instance1 = getPerformanceMonitor();
      const instance2 = getPerformanceMonitor();

      expect(instance1).toBe(instance2);
    });

    it('should initialize with custom options', () => {
      const customCallback = jest.fn();

      const customMonitor = initializePerformanceMonitor({
        enabled: false,
        maxMetricsPerCategory: 50,
        alertCallback: customCallback,
      });

      expect(customMonitor).toBeInstanceOf(PerformanceMonitor);

      // Test that it uses custom settings
      customMonitor.setEnabled(true);
      customMonitor.setThreshold('test', 10, 20, 'ms');
      customMonitor.recordMetric({
        name: 'test',
        value: 15,
        unit: 'ms',
        timestamp: new Date(),
        category: 'test',
      });

      expect(customCallback).toHaveBeenCalled();
    });
  });
});

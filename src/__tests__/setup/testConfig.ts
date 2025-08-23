// Test configuration and constants

export const TEST_CONFIG = {
  // Timeouts
  DEFAULT_TIMEOUT: 5000,
  ASYNC_TIMEOUT: 10000,
  ANIMATION_TIMEOUT: 1000,

  // Delays for simulating real-world conditions
  NETWORK_DELAY: 100,
  DATABASE_DELAY: 50,
  AI_SERVICE_DELAY: 200,
  USER_INTERACTION_DELAY: 50,

  // Test data limits
  MAX_TASKS_FOR_PERFORMANCE_TEST: 1000,
  MAX_SESSIONS_FOR_PERFORMANCE_TEST: 500,
  LARGE_DATASET_SIZE: 100,

  // Mock service configurations
  MOCK_SERVICES: {
    database: {
      simulateErrors: false,
      responseDelay: 50,
      seedData: {},
    },
    ai: {
      simulateDelay: 200,
      simulateErrors: false,
      responses: new Map(),
    },
    notifications: {
      enabled: true,
      simulatePermissionDenied: false,
    },
    timer: {
      autoAdvanceTime: false,
      timeMultiplier: 1,
    },
  },

  // Coverage thresholds
  COVERAGE_THRESHOLDS: {
    statements: 85,
    branches: 80,
    functions: 90,
    lines: 85,
  },

  // Performance benchmarks
  PERFORMANCE_BENCHMARKS: {
    componentRenderTime: 100, // milliseconds
    hookExecutionTime: 50,
    serviceResponseTime: 200,
    databaseQueryTime: 100,
  },

  // Accessibility requirements
  ACCESSIBILITY: {
    colorContrastRatio: 4.5,
    focusIndicatorVisible: true,
    keyboardNavigable: true,
    screenReaderCompatible: true,
  },
};

// Test environment setup
export const setupTestEnvironment = () => {
  // Set up global test configuration
  jest.setTimeout(TEST_CONFIG.DEFAULT_TIMEOUT);

  // Mock console methods in tests to reduce noise
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;

  beforeEach(() => {
    // Reset console mocks before each test
    console.error = jest.fn();
    console.warn = jest.fn();
  });

  afterEach(() => {
    // Restore console methods after each test
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
  });

  // Global test cleanup
  afterAll(() => {
    // Clean up any global resources
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });
};

// Test categories for organizing tests
export enum TestCategory {
  UNIT = 'unit',
  INTEGRATION = 'integration',
  E2E = 'e2e',
  PERFORMANCE = 'performance',
  ACCESSIBILITY = 'accessibility',
  VISUAL = 'visual',
}

// Test priorities for test execution order
export enum TestPriority {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

// Test tags for filtering and grouping
export const TEST_TAGS = {
  SMOKE: 'smoke',
  REGRESSION: 'regression',
  HAPPY_PATH: 'happy-path',
  ERROR_HANDLING: 'error-handling',
  EDGE_CASE: 'edge-case',
  PERFORMANCE: 'performance',
  ACCESSIBILITY: 'accessibility',
  MOBILE: 'mobile',
  DESKTOP: 'desktop',
};

// Common test data patterns
export const TEST_PATTERNS = {
  VALID_EMAIL: 'test@example.com',
  INVALID_EMAIL: 'invalid-email',
  VALID_PASSWORD: 'SecurePassword123!',
  WEAK_PASSWORD: '123',
  VALID_TASK_TITLE: 'Complete project documentation',
  EMPTY_STRING: '',
  LONG_STRING: 'A'.repeat(1000),
  SPECIAL_CHARACTERS: '!@#$%^&*()_+-=[]{}|;:,.<>?',
  SQL_INJECTION: "'; DROP TABLE tasks; --",
  XSS_PAYLOAD: '<script>alert("xss")</script>',
  UNICODE_STRING: '🚀 Unicode test 中文 العربية',

  // Date patterns
  PAST_DATE: new Date('2020-01-01'),
  FUTURE_DATE: new Date('2030-12-31'),
  INVALID_DATE: new Date('invalid'),

  // Number patterns
  NEGATIVE_NUMBER: -1,
  ZERO: 0,
  POSITIVE_NUMBER: 42,
  LARGE_NUMBER: Number.MAX_SAFE_INTEGER,
  DECIMAL_NUMBER: 3.14159,
  INFINITY: Infinity,
  NAN: NaN,
};

// Browser and device simulation
export const DEVICE_SIMULATIONS = {
  MOBILE: {
    width: 375,
    height: 667,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
  },
  TABLET: {
    width: 768,
    height: 1024,
    userAgent:
      'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
  },
  DESKTOP: {
    width: 1920,
    height: 1080,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  },
};

// Network condition simulations
export const NETWORK_CONDITIONS = {
  FAST_3G: {
    downloadThroughput: (1.5 * 1024 * 1024) / 8, // 1.5 Mbps
    uploadThroughput: (750 * 1024) / 8, // 750 Kbps
    latency: 150,
  },
  SLOW_3G: {
    downloadThroughput: (500 * 1024) / 8, // 500 Kbps
    uploadThroughput: (500 * 1024) / 8, // 500 Kbps
    latency: 300,
  },
  OFFLINE: {
    downloadThroughput: 0,
    uploadThroughput: 0,
    latency: 0,
  },
};

// Error scenarios for testing
export const ERROR_SCENARIOS = {
  NETWORK_ERROR: {
    name: 'Network Error',
    error: new Error('Network request failed'),
    recoverable: true,
    retryDelay: 1000,
  },
  DATABASE_ERROR: {
    name: 'Database Error',
    error: new Error('Database connection failed'),
    recoverable: true,
    retryDelay: 2000,
  },
  VALIDATION_ERROR: {
    name: 'Validation Error',
    error: new Error('Invalid input data'),
    recoverable: false,
    retryDelay: 0,
  },
  PERMISSION_ERROR: {
    name: 'Permission Error',
    error: new Error('Access denied'),
    recoverable: false,
    retryDelay: 0,
  },
  TIMEOUT_ERROR: {
    name: 'Timeout Error',
    error: new Error('Request timeout'),
    recoverable: true,
    retryDelay: 3000,
  },
};

// Test utilities for common assertions
export const TEST_ASSERTIONS = {
  // Component rendering
  expectComponentToRender: (component: HTMLElement) => {
    expect(component).toBeInTheDocument();
  },

  // Loading states
  expectLoadingState: (container: HTMLElement) => {
    expect(container).toHaveTextContent(/loading/i);
  },

  // Error states
  expectErrorState: (container: HTMLElement, errorMessage?: string) => {
    expect(container).toHaveTextContent(/error/i);
    if (errorMessage) {
      expect(container).toHaveTextContent(errorMessage);
    }
  },

  // Empty states
  expectEmptyState: (container: HTMLElement) => {
    expect(container).toHaveTextContent(/no.*found|empty/i);
  },

  // Form validation
  expectFormValidation: (input: HTMLElement, errorMessage: string) => {
    expect(input).toBeInvalid();
    expect(input.parentElement).toHaveTextContent(errorMessage);
  },

  // Accessibility
  expectAccessibleName: (element: HTMLElement, name: string) => {
    expect(element).toHaveAccessibleName(name);
  },

  expectKeyboardNavigation: (element: HTMLElement) => {
    expect(element).toHaveAttribute('tabindex');
  },
};

export default TEST_CONFIG;

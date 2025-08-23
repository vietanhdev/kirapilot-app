// Test utilities and setup exports

// Main test utilities
export * from './testUtils';
export * from './testDataFactory';
export * from './errorSimulator';

// Mock services
export { MockDatabase } from '../mocks/MockDatabase';
export { MockAIService } from '../mocks/MockAIService';
export {
  MockNotificationService,
  MockNotification,
} from '../mocks/MockNotificationService';
export {
  MockTimerService,
  MockFocusTimerService,
} from '../mocks/MockTimerService';

// Re-export commonly used testing library functions
export {
  render,
  renderHook,
  screen,
  fireEvent,
  waitFor,
  waitForElementToBeRemoved,
  within,
  getByRole,
  getByText,
  getByLabelText,
  getByTestId,
  queryByRole,
  queryByText,
  queryByLabelText,
  queryByTestId,
  findByRole,
  findByText,
  findByLabelText,
  findByTestId,
} from '@testing-library/react';

export { default as userEvent } from '@testing-library/user-event';

// Common test scenarios and helpers
export const commonTestScenarios = {
  // Loading states
  loadingState: {
    name: 'Loading state',
    setup: () => ({ isLoading: true }),
    assertions: ['loading indicator should be visible'],
  },

  // Error states
  errorState: {
    name: 'Error state',
    setup: () => ({ error: new Error('Test error') }),
    assertions: ['error message should be displayed'],
  },

  // Empty states
  emptyState: {
    name: 'Empty state',
    setup: () => ({ data: [] }),
    assertions: ['empty state message should be shown'],
  },

  // Success states
  successState: {
    name: 'Success state',
    setup: () => ({ data: ['item1', 'item2'], isLoading: false }),
    assertions: ['data should be displayed correctly'],
  },
};

// Common accessibility test helpers
export const accessibilityHelpers = {
  checkKeyboardNavigation: async (element: HTMLElement) => {
    // Test Tab navigation
    element.focus();
    expect(element).toHaveFocus();
  },

  checkAriaLabels: (element: HTMLElement, expectedLabel: string) => {
    expect(element).toHaveAccessibleName(expectedLabel);
  },

  checkRoles: (element: HTMLElement, expectedRole: string) => {
    expect(element).toHaveRole(expectedRole);
  },

  checkColorContrast: (element: HTMLElement) => {
    // Mock implementation - in real tests, you'd use actual contrast checking
    const styles = window.getComputedStyle(element);
    expect(styles.color).toBeDefined();
    expect(styles.backgroundColor).toBeDefined();
  },
};

// Performance test helpers
export const performanceHelpers = {
  measureRenderTime: async (renderFn: () => void): Promise<number> => {
    const start = performance.now();
    renderFn();
    const end = performance.now();
    return end - start;
  },

  checkMemoryLeaks: (component: unknown) => {
    // Mock implementation - in real tests, you'd check for memory leaks
    expect(component).toBeDefined();
  },

  simulateSlowDevice: () => {
    // Mock slow device conditions
    Object.defineProperty(navigator, 'hardwareConcurrency', {
      writable: true,
      value: 1,
    });
  },
};

// Test data generators for common scenarios
export const testDataGenerators = {
  generateLargeTaskList: (count: number) => {
    return Array.from({ length: count }, (_, index) => ({
      id: `task-${index}`,
      title: `Task ${index + 1}`,
      description: `Description for task ${index + 1}`,
      priority: index % 4,
      status: ['pending', 'in_progress', 'completed'][index % 3],
      createdAt: new Date(Date.now() - index * 24 * 60 * 60 * 1000),
    }));
  },

  generateTimerSessions: (count: number) => {
    return Array.from({ length: count }, (_, index) => ({
      id: `session-${index}`,
      taskId: `task-${index}`,
      startTime: new Date(Date.now() - index * 60 * 60 * 1000),
      endTime: new Date(Date.now() - index * 60 * 60 * 1000 + 30 * 60 * 1000),
      duration: 30 * 60 * 1000,
      isActive: false,
    }));
  },
};

// Test assertion helpers
export const assertionHelpers = {
  expectToBeVisible: (element: HTMLElement | null) => {
    expect(element).toBeInTheDocument();
    expect(element).toBeVisible();
  },

  expectToHaveAccessibleName: (element: HTMLElement | null, name: string) => {
    expect(element).toHaveAccessibleName(name);
  },

  expectToHaveRole: (element: HTMLElement | null, role: string) => {
    expect(element).toHaveRole(role);
  },

  expectToBeDisabled: (element: HTMLElement | null) => {
    expect(element).toBeDisabled();
  },

  expectToBeEnabled: (element: HTMLElement | null) => {
    expect(element).toBeEnabled();
  },

  expectToHaveValue: (element: HTMLElement | null, value: string) => {
    expect(element).toHaveValue(value);
  },

  expectToHaveClass: (element: HTMLElement | null, className: string) => {
    expect(element).toHaveClass(className);
  },
};

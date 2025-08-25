import React from 'react';
import { render, RenderOptions, RenderResult } from '@testing-library/react';
import {
  renderHook,
  RenderHookOptions,
  RenderHookResult,
} from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { MockDatabase } from '../mocks/MockDatabase';
import { MockAIService } from '../mocks/MockAIService';
import { MockNotificationService } from '../mocks/MockNotificationService';
import { MockTimerService } from '../mocks/MockTimerService';
import { MockFileSystemService } from '../mocks/MockFileSystemService';
import {
  UserPreferences,
  Task,
  TimerSession,
  FocusSession,
  AISuggestion,
  ProductivityPattern,
} from '../../types';

// Test configuration interfaces
export interface TestRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialState?: Partial<AppTestState>;
  providers?: React.ComponentType[];
  routerProps?: {
    initialEntries?: string[];
    initialIndex?: number;
  };
  mockServices?: MockServiceConfig;
}

export interface AppTestState {
  tasks: Task[];
  timerSessions: TimerSession[];
  focusSessions: FocusSession[];
  userPreferences: UserPreferences;
  aiSuggestions: AISuggestion[];
  productivityPatterns: ProductivityPattern[];
  currentTask?: Task;
  activeSession?: TimerSession;
  activeFocusSession?: FocusSession;
}

export interface MockServiceConfig {
  database?: MockDatabaseConfig;
  ai?: MockAIConfig;
  notifications?: MockNotificationConfig;
  timer?: MockTimerConfig;
  fileSystem?: MockFileSystemConfig;
}

export interface MockDatabaseConfig {
  seedData?: Partial<AppTestState>;
  simulateErrors?: boolean;
  responseDelay?: number;
}

export interface MockAIConfig {
  responses?: Map<string, unknown>;
  simulateDelay?: number;
  simulateErrors?: boolean;
}

export interface MockNotificationConfig {
  enabled?: boolean;
  simulatePermissionDenied?: boolean;
}

export interface MockTimerConfig {
  autoAdvanceTime?: boolean;
  timeMultiplier?: number;
}

export interface MockFileSystemConfig {
  simulateErrors?: boolean;
  responseDelay?: number;
  maxFileSize?: number;
  allowedExtensions?: string[];
}

// Test wrapper component
interface TestWrapperProps {
  children: React.ReactNode;
  options?: TestRenderOptions;
}

const TestWrapper: React.FC<TestWrapperProps> = ({
  children,
  options = {},
}) => {
  const {
    initialState = {},
    routerProps = {},
    mockServices = {},
    providers = [],
  } = options;

  // Initialize mock services (store references for potential future use)
  const mockDatabase = new MockDatabase(mockServices.database);
  const mockAIService = new MockAIService(mockServices.ai);
  const mockNotificationService = new MockNotificationService(
    mockServices.notifications
  );
  const mockTimerService = new MockTimerService(mockServices.timer);
  const mockFileSystemService = new MockFileSystemService(
    mockServices.fileSystem
  );

  // Store services for potential access in tests
  (window as unknown as { __testServices?: unknown }).__testServices = {
    mockDatabase,
    mockAIService,
    mockNotificationService,
    mockTimerService,
    mockFileSystemService,
  };

  // Seed initial data if provided
  if (initialState) {
    mockDatabase.seedData(initialState);
  }

  // For now, just wrap with BrowserRouter for basic testing
  // Individual tests can add more specific providers as needed
  let wrappedChildren = (
    <BrowserRouter {...routerProps}>{children}</BrowserRouter>
  );

  // Apply additional providers if specified
  providers.forEach(Provider => {
    wrappedChildren = React.createElement(Provider, {}, wrappedChildren);
  });

  return <>{wrappedChildren}</>;
};

// Enhanced render function
export const renderWithProviders = (
  ui: React.ReactElement,
  options: TestRenderOptions = {}
): RenderResult & { mockServices: MockServiceConfig } => {
  const result = render(ui, {
    wrapper: ({ children }) => (
      <TestWrapper options={options}>{children}</TestWrapper>
    ),
    ...options,
  });

  return {
    ...result,
    mockServices: options.mockServices || {},
  };
};

// Enhanced renderHook function
export const renderHookWithProviders = <TResult, TProps = {}>(
  hook: (props: TProps) => TResult,
  options: TestRenderOptions & RenderHookOptions<TProps> = {}
): RenderHookResult<TResult, TProps> & { mockServices: MockServiceConfig } => {
  const result = renderHook(hook, {
    wrapper: ({ children }) => (
      <TestWrapper options={options}>{children}</TestWrapper>
    ),
    ...options,
  });

  return {
    ...result,
    mockServices: options.mockServices || {},
  };
};

// Utility functions for common test operations
export const waitForAsyncUpdates = async (): Promise<void> => {
  await new Promise(resolve => setTimeout(resolve, 0));
};

export const createMockContext = <T extends unknown>(
  contextValue: T
): React.Context<T> => {
  return React.createContext<T>(contextValue);
};

// Test assertion helpers
export const expectElementToBeVisible = (element: HTMLElement | null): void => {
  expect(element).toBeInTheDocument();
  expect(element).toBeVisible();
};

export const expectElementToHaveAccessibleName = (
  element: HTMLElement | null,
  name: string
): void => {
  expect(element).toHaveAccessibleName(name);
};

export const expectElementToHaveRole = (
  element: HTMLElement | null,
  role: string
): void => {
  expect(element).toHaveRole(role);
};

// Export everything for easy importing
export * from '@testing-library/react';
export * from '@testing-library/user-event';
export { default as userEvent } from '@testing-library/user-event';
// Export TestWrapper for direct use in tests
export { TestWrapper };

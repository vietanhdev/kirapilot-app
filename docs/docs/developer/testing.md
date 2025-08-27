# Testing

KiraPilot uses a comprehensive testing strategy to ensure reliability, performance, and maintainability across the entire application stack.

## Testing Philosophy

### Testing Pyramid

KiraPilot follows the testing pyramid approach:

```
    /\
   /  \     E2E Tests (10%)
  /____\    Integration Tests (20%)
 /      \   Unit Tests (70%)
/__________\
```

- **Unit Tests (70%)**: Fast, isolated tests for individual functions and components
- **Integration Tests (20%)**: Test interactions between components and services
- **End-to-End Tests (10%)**: Full user workflow testing

### Testing Principles

1. **Fast Feedback**: Tests should run quickly to enable rapid development
2. **Reliable**: Tests should be deterministic and not flaky
3. **Maintainable**: Tests should be easy to understand and update
4. **Comprehensive**: Critical paths should have good test coverage
5. **Realistic**: Tests should use realistic data and scenarios

## Test Structure

### Directory Organization

```
src/
├── __tests__/                    # Global test configuration
│   ├── setup/                    # Test environment setup
│   │   ├── setupTests.ts         # Jest configuration
│   │   ├── testUtils.tsx         # Testing utilities
│   │   └── mockProviders.tsx     # Mock context providers
│   ├── mocks/                    # Global mocks
│   │   ├── mockDatabase.ts       # Database mock implementation
│   │   ├── mockTauri.ts          # Tauri API mocks
│   │   └── mockAI.ts             # AI service mocks
│   └── integration/              # Integration test suites
│       ├── taskManagement.test.ts
│       ├── timeTracking.test.ts
│       └── aiIntegration.test.ts
├── components/
│   └── __tests__/                # Component unit tests
│       ├── TaskCard.test.tsx
│       ├── TimerDisplay.test.tsx
│       └── Planner.test.tsx
├── hooks/
│   └── __tests__/                # Hook unit tests
│       ├── useDatabase.test.ts
│       ├── useTaskList.test.ts
│       └── useTimer.test.ts
├── services/
│   ├── database/
│   │   └── __tests__/            # Database service tests
│   │       ├── TaskService.test.ts
│   │       └── TaskListService.test.ts
│   └── ai/
│       └── __tests__/            # AI service tests
│           ├── ToolRegistry.test.ts
│           └── LoggingInterceptor.test.ts
└── utils/
    └── __tests__/                # Utility function tests
        ├── dateFormat.test.ts
        └── taskSorting.test.ts
```

### Test Configuration

#### Jest Configuration (`jest.config.js`)

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/**/__mocks__/**',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.{ts,tsx}',
    '<rootDir>/src/**/*.{test,spec}.{ts,tsx}',
  ],
};
```

#### Test Setup (`src/setupTests.ts`)

```typescript
import '@testing-library/jest-dom';
import { configure } from '@testing-library/react';

// Configure testing library
configure({ testIdAttribute: 'data-testid' });

// Mock Tauri APIs
jest.mock('@tauri-apps/api/core', () => ({
  invoke: jest.fn(),
}));

jest.mock('@tauri-apps/api/dialog', () => ({
  open: jest.fn(),
  save: jest.fn(),
}));

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Global test utilities
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));
```

## Running Tests

### Basic Test Commands

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run specific test file
npm test TaskCard.test.tsx

# Run tests matching a pattern
npm test -- --testNamePattern="should create task"
```

### Test Scripts

#### Development Testing

```bash
# Watch mode for active development
npm run test:watch

# Run tests for changed files only
npm test -- --onlyChanged

# Run tests related to specific files
npm test -- --findRelatedTests src/components/TaskCard.tsx
```

#### CI/CD Testing

```bash
# Full test suite with coverage
npm run test:coverage

# Run tests with JUnit output for CI
npm test -- --reporters=default --reporters=jest-junit

# Run tests in CI mode (no watch, exit after completion)
npm test -- --ci --coverage --watchAll=false
```

### Coverage Reports

Coverage reports are generated in the `coverage/` directory:

- **HTML Report**: `coverage/lcov-report/index.html`
- **LCOV Format**: `coverage/lcov.info`
- **JSON Format**: `coverage/coverage-final.json`

View coverage in browser:

```bash
npm run test:coverage
open coverage/lcov-report/index.html
```

## Writing Tests

### Unit Tests

#### Component Testing

```typescript
// src/components/__tests__/TaskCard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { TaskCard } from '../TaskCard';
import { Task, Priority, TaskStatus } from '../../types';

const mockTask: Task = {
  id: '1',
  title: 'Test Task',
  description: 'Test description',
  priority: Priority.MEDIUM,
  status: TaskStatus.PENDING,
  order: 0,
  dependencies: [],
  timePreset: TimePreset.THIRTY_MIN,
  timeEstimate: 30,
  actualTime: 0,
  tags: ['test'],
  taskListId: 'default',
  subtasks: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('TaskCard', () => {
  it('should display task title', () => {
    render(<TaskCard task={mockTask} onUpdate={jest.fn()} />);

    expect(screen.getByText('Test Task')).toBeInTheDocument();
  });

  it('should call onUpdate when task is clicked', () => {
    const mockOnUpdate = jest.fn();
    render(<TaskCard task={mockTask} onUpdate={mockOnUpdate} />);

    fireEvent.click(screen.getByText('Test Task'));

    expect(mockOnUpdate).toHaveBeenCalledWith(mockTask);
  });

  it('should display priority indicator', () => {
    render(<TaskCard task={mockTask} onUpdate={jest.fn()} />);

    const priorityIndicator = screen.getByTestId('priority-indicator');
    expect(priorityIndicator).toHaveClass('priority-medium');
  });
});
```

#### Hook Testing

```typescript
// src/hooks/__tests__/useTaskList.test.ts
import { renderHook, act } from '@testing-library/react';
import { useTaskList } from '../useTaskList';
import { TaskListProvider } from '../../contexts/TaskListContext';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <TaskListProvider>{children}</TaskListProvider>
);

describe('useTaskList', () => {
  it('should initialize with empty task list', () => {
    const { result } = renderHook(() => useTaskList(), { wrapper });

    expect(result.current.tasks).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it('should add task to list', async () => {
    const { result } = renderHook(() => useTaskList(), { wrapper });

    await act(async () => {
      await result.current.createTask({
        title: 'New Task',
        description: 'Test task',
      });
    });

    expect(result.current.tasks).toHaveLength(1);
    expect(result.current.tasks[0].title).toBe('New Task');
  });
});
```

#### Service Testing

```typescript
// src/services/database/__tests__/TaskService.test.ts
import { TaskService } from '../repositories/TaskService';
import { mockInvoke } from '../../__tests__/mocks/mockTauri';

jest.mock('@tauri-apps/api/core');

describe('TaskService', () => {
  let taskService: TaskService;

  beforeEach(() => {
    taskService = new TaskService();
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create task with correct parameters', async () => {
      const taskData = {
        title: 'Test Task',
        description: 'Test description',
        priority: Priority.HIGH,
      };

      const expectedTask = {
        id: 'generated-id',
        ...taskData,
        status: TaskStatus.PENDING,
        createdAt: new Date(),
      };

      mockInvoke.mockResolvedValue(expectedTask);

      const result = await taskService.create(taskData);

      expect(mockInvoke).toHaveBeenCalledWith('create_task', {
        title: taskData.title,
        description: taskData.description,
        priority: taskData.priority,
      });
      expect(result).toEqual(expectedTask);
    });

    it('should handle creation errors', async () => {
      const taskData = { title: 'Test Task' };
      const error = new Error('Database error');

      mockInvoke.mockRejectedValue(error);

      await expect(taskService.create(taskData)).rejects.toThrow(
        'Database error'
      );
    });
  });
});
```

### Integration Tests

#### Feature Integration

```typescript
// src/__tests__/integration/taskManagement.test.ts
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { App } from '../../App';
import { mockDatabase } from '../mocks/mockDatabase';

describe('Task Management Integration', () => {
  beforeEach(() => {
    mockDatabase.reset();
  });

  it('should create and display task in task list', async () => {
    render(<App />);

    // Open task creation dialog
    fireEvent.click(screen.getByText('Add Task'));

    // Fill in task details
    fireEvent.change(screen.getByLabelText('Task Title'), {
      target: { value: 'Integration Test Task' },
    });

    fireEvent.change(screen.getByLabelText('Description'), {
      target: { value: 'This is a test task' },
    });

    // Submit task
    fireEvent.click(screen.getByText('Create Task'));

    // Verify task appears in list
    await waitFor(() => {
      expect(screen.getByText('Integration Test Task')).toBeInTheDocument();
    });

    // Verify task can be clicked to view details
    fireEvent.click(screen.getByText('Integration Test Task'));

    await waitFor(() => {
      expect(screen.getByText('This is a test task')).toBeInTheDocument();
    });
  });

  it('should start timer for task', async () => {
    // Create a task first
    mockDatabase.addTask({
      id: '1',
      title: 'Timer Test Task',
      status: TaskStatus.PENDING,
    });

    render(<App />);

    // Find and click the task
    const task = await screen.findByText('Timer Test Task');
    fireEvent.click(task);

    // Start timer
    const startButton = screen.getByText('Start Timer');
    fireEvent.click(startButton);

    // Verify timer is running
    await waitFor(() => {
      expect(screen.getByText('00:00:01')).toBeInTheDocument();
    });
  });
});
```

#### AI Integration Testing

```typescript
// src/__tests__/integration/aiIntegration.test.ts
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AIProvider } from '../../contexts/AIContext';
import { ChatInterface } from '../../components/ai/ChatInterface';
import { mockAIService } from '../mocks/mockAI';

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <AIProvider>{children}</AIProvider>
);

describe('AI Integration', () => {
  beforeEach(() => {
    mockAIService.reset();
  });

  it('should create task through AI command', async () => {
    mockAIService.mockResponse({
      message: 'I\'ve created the task for you.',
      actions: [{
        type: 'CREATE_TASK',
        parameters: {
          title: 'AI Created Task',
          description: 'Created by AI assistant',
        },
      }],
    });

    render(
      <TestWrapper>
        <ChatInterface />
      </TestWrapper>
    );

    // Type AI command
    const input = screen.getByPlaceholderText('Ask your AI assistant...');
    fireEvent.change(input, {
      target: { value: 'Create a task to review the quarterly report' },
    });

    // Send message
    fireEvent.click(screen.getByText('Send'));

    // Wait for AI response and task creation
    await waitFor(() => {
      expect(screen.getByText('I\'ve created the task for you.')).toBeInTheDocument();
    });

    // Verify task was created
    expect(mockAIService.getCreatedTasks()).toHaveLength(1);
    expect(mockAIService.getCreatedTasks()[0].title).toBe('AI Created Task');
  });
});
```

### Test Utilities

#### Custom Render Function

```typescript
// src/__tests__/setup/testUtils.tsx
import { render, RenderOptions } from '@testing-library/react';
import { ReactElement } from 'react';
import { TaskListProvider } from '../../contexts/TaskListContext';
import { SettingsProvider } from '../../contexts/SettingsContext';
import { TimerProvider } from '../../contexts/TimerContext';

const AllProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    <SettingsProvider>
      <TaskListProvider>
        <TimerProvider>
          {children}
        </TimerProvider>
      </TaskListProvider>
    </SettingsProvider>
  );
};

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllProviders, ...options });

export * from '@testing-library/react';
export { customRender as render };
```

#### Mock Factories

```typescript
// src/__tests__/mocks/taskFactory.ts
import { Task, Priority, TaskStatus, TimePreset } from '../../types';

export const createMockTask = (overrides: Partial<Task> = {}): Task => ({
  id: 'mock-task-id',
  title: 'Mock Task',
  description: 'Mock task description',
  priority: Priority.MEDIUM,
  status: TaskStatus.PENDING,
  order: 0,
  dependencies: [],
  timePreset: TimePreset.THIRTY_MIN,
  timeEstimate: 30,
  actualTime: 0,
  tags: [],
  taskListId: 'default',
  subtasks: [],
  createdAt: new Date('2024-01-01T10:00:00Z'),
  updatedAt: new Date('2024-01-01T10:00:00Z'),
  ...overrides,
});

export const createMockTaskList = (count: number): Task[] => {
  return Array.from({ length: count }, (_, index) =>
    createMockTask({
      id: `task-${index}`,
      title: `Task ${index + 1}`,
      order: index,
    })
  );
};
```

## Mocking Strategies

### Database Mocking

```typescript
// src/services/database/__mocks__/mockDatabase.ts
import { Task, TaskList, TimerSession } from '../../../types';

class MockDatabase {
  private tasks: Task[] = [];
  private taskLists: TaskList[] = [];
  private sessions: TimerSession[] = [];

  reset() {
    this.tasks = [];
    this.taskLists = [];
    this.sessions = [];
  }

  async createTask(taskData: CreateTaskRequest): Promise<Task> {
    const task: Task = {
      id: `mock-${Date.now()}`,
      ...taskData,
      status: TaskStatus.PENDING,
      order: this.tasks.length,
      actualTime: 0,
      dependencies: [],
      subtasks: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.tasks.push(task);
    return task;
  }

  async getTasks(): Promise<Task[]> {
    return [...this.tasks];
  }

  async updateTask(id: string, updates: UpdateTaskRequest): Promise<Task> {
    const taskIndex = this.tasks.findIndex(t => t.id === id);
    if (taskIndex === -1) {
      throw new Error('Task not found');
    }

    this.tasks[taskIndex] = {
      ...this.tasks[taskIndex],
      ...updates,
      updatedAt: new Date(),
    };

    return this.tasks[taskIndex];
  }
}

export const mockDatabase = new MockDatabase();
```

### Tauri API Mocking

```typescript
// src/__tests__/mocks/mockTauri.ts
export const mockInvoke = jest.fn();

jest.mock('@tauri-apps/api/core', () => ({
  invoke: mockInvoke,
}));

// Helper to set up common mock responses
export const setupTauriMocks = () => {
  mockInvoke.mockImplementation((command: string, args?: any) => {
    switch (command) {
      case 'get_tasks':
        return Promise.resolve([]);
      case 'create_task':
        return Promise.resolve({
          id: 'generated-id',
          ...args,
          createdAt: new Date().toISOString(),
        });
      default:
        return Promise.resolve(null);
    }
  });
};
```

### AI Service Mocking

```typescript
// src/__tests__/mocks/mockAI.ts
import { AIResponse, AIAction } from '../../types';

class MockAIService {
  private responses: AIResponse[] = [];
  private createdTasks: any[] = [];

  reset() {
    this.responses = [];
    this.createdTasks = [];
  }

  mockResponse(response: AIResponse) {
    this.responses.push(response);
  }

  async sendMessage(message: string): Promise<AIResponse> {
    const response = this.responses.shift();
    if (!response) {
      throw new Error('No mock response configured');
    }

    // Simulate action execution
    response.actions?.forEach(action => {
      if (action.type === 'CREATE_TASK') {
        this.createdTasks.push(action.parameters);
      }
    });

    return response;
  }

  getCreatedTasks() {
    return [...this.createdTasks];
  }
}

export const mockAIService = new MockAIService();
```

## Performance Testing

### Component Performance

```typescript
// src/components/__tests__/TaskList.performance.test.tsx
import { render } from '@testing-library/react';
import { TaskList } from '../TaskList';
import { createMockTaskList } from '../../__tests__/mocks/taskFactory';

describe('TaskList Performance', () => {
  it('should render large task lists efficiently', () => {
    const largeTasks = createMockTaskList(1000);

    const startTime = performance.now();
    render(<TaskList tasks={largeTasks} onTaskUpdate={jest.fn()} />);
    const endTime = performance.now();

    const renderTime = endTime - startTime;
    expect(renderTime).toBeLessThan(100); // Should render in under 100ms
  });

  it('should handle frequent updates without performance degradation', () => {
    const tasks = createMockTaskList(100);
    const mockOnUpdate = jest.fn();

    const { rerender } = render(
      <TaskList tasks={tasks} onTaskUpdate={mockOnUpdate} />
    );

    const startTime = performance.now();

    // Simulate 10 rapid updates
    for (let i = 0; i < 10; i++) {
      const updatedTasks = tasks.map(task => ({
        ...task,
        updatedAt: new Date(),
      }));
      rerender(<TaskList tasks={updatedTasks} onTaskUpdate={mockOnUpdate} />);
    }

    const endTime = performance.now();
    const updateTime = endTime - startTime;

    expect(updateTime).toBeLessThan(50); // Should handle updates quickly
  });
});
```

### Memory Leak Testing

```typescript
// src/__tests__/integration/memoryLeaks.test.ts
import { render, cleanup } from '@testing-library/react';
import { App } from '../../App';

describe('Memory Leak Prevention', () => {
  afterEach(() => {
    cleanup();
  });

  it('should not leak memory on component unmount', () => {
    const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;

    // Render and unmount multiple times
    for (let i = 0; i < 10; i++) {
      const { unmount } = render(<App />);
      unmount();
    }

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
    const memoryIncrease = finalMemory - initialMemory;

    // Memory increase should be minimal
    expect(memoryIncrease).toBeLessThan(1024 * 1024); // Less than 1MB
  });
});
```

## Continuous Integration

### GitHub Actions Test Workflow

```yaml
# .github/workflows/test.yml
name: Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    strategy:
      matrix:
        node-version: [18, 20]

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run type checking
        run: npm run type-check

      - name: Run linting
        run: npm run lint

      - name: Run tests with coverage
        run: npm run test:coverage

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info
          flags: unittests
          name: codecov-umbrella
```

### Test Quality Gates

```javascript
// jest.config.js - Coverage thresholds
module.exports = {
  // ... other config
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
    './src/components/': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    './src/services/': {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85,
    },
  },
};
```

## Best Practices

### Test Writing Guidelines

1. **Descriptive Test Names**: Use clear, descriptive test names that explain what is being tested
2. **Arrange-Act-Assert**: Structure tests with clear setup, execution, and verification phases
3. **Single Responsibility**: Each test should verify one specific behavior
4. **Independent Tests**: Tests should not depend on each other
5. **Realistic Data**: Use realistic test data that represents actual usage

### Common Patterns

#### Testing Async Operations

```typescript
it('should handle async task creation', async () => {
  const mockCreate = jest.fn().mockResolvedValue(mockTask);

  render(<TaskForm onSubmit={mockCreate} />);

  fireEvent.click(screen.getByText('Create Task'));

  await waitFor(() => {
    expect(mockCreate).toHaveBeenCalled();
  });
});
```

#### Testing Error States

```typescript
it('should display error message on creation failure', async () => {
  const mockCreate = jest.fn().mockRejectedValue(new Error('Creation failed'));

  render(<TaskForm onSubmit={mockCreate} />);

  fireEvent.click(screen.getByText('Create Task'));

  await waitFor(() => {
    expect(screen.getByText('Creation failed')).toBeInTheDocument();
  });
});
```

#### Testing User Interactions

```typescript
it('should update task priority on dropdown selection', async () => {
  const mockUpdate = jest.fn();

  render(<TaskCard task={mockTask} onUpdate={mockUpdate} />);

  const priorityDropdown = screen.getByLabelText('Priority');
  fireEvent.change(priorityDropdown, { target: { value: 'high' } });

  expect(mockUpdate).toHaveBeenCalledWith({
    ...mockTask,
    priority: Priority.HIGH,
  });
});
```

This comprehensive testing strategy ensures KiraPilot maintains high quality, reliability, and performance across all features and platforms.

// Mock database service for development/browser environment
import { Task, TaskStatus, Priority } from '../../types';

/**
 * Mock database that stores data in localStorage for development
 */
export class MockDatabase {
  public readonly isMock = true;
  private storageKey = 'kirapilot-mock-db';
  private transactionActive = false;
  private transactionData: any = null;

  private getData(): any {
    const data = localStorage.getItem(this.storageKey);
    return data
      ? JSON.parse(data)
      : {
          tasks: [],
          timeSessions: [],
          focusSessions: [],
          patterns: [],
          preferences: {},
          suggestions: [],
        };
  }

  private saveData(data: any): void {
    localStorage.setItem(this.storageKey, JSON.stringify(data));
  }

  // Method to update tasks (for future use)
  updateTasks(tasks: Task[]): void {
    const data = this.getData();
    data.tasks = tasks;
    this.saveData(data);
  }

  async execute(query: string, params?: any[]): Promise<any> {
    console.log('Mock DB Execute:', query, params);

    // Handle transaction commands
    const cleanQuery = query.trim().toUpperCase();

    if (cleanQuery === 'BEGIN TRANSACTION') {
      this.transactionActive = true;
      this.transactionData = this.getData(); // Snapshot current data
      console.log('Mock DB: Transaction started');
      return { changes: 0 };
    }

    if (cleanQuery === 'COMMIT') {
      if (!this.transactionActive) {
        console.warn(
          'Mock DB: Commit called but no transaction is active - treating as no-op'
        );
        return { changes: 0 };
      }
      this.transactionActive = false;
      this.transactionData = null;
      console.log('Mock DB: Transaction committed');
      return { changes: 0 };
    }

    if (cleanQuery === 'ROLLBACK') {
      if (!this.transactionActive) {
        console.warn(
          'Mock DB: Rollback called but no transaction is active - treating as no-op'
        );
        return { changes: 0 };
      }
      // Restore data from transaction start
      if (this.transactionData) {
        this.saveData(this.transactionData);
      }
      this.transactionActive = false;
      this.transactionData = null;
      console.log('Mock DB: Transaction rolled back');
      return { changes: 0 };
    }

    // Handle INSERT INTO tasks
    if (cleanQuery.startsWith('INSERT INTO TASKS')) {
      if (params && params.length >= 17) {
        const data = this.getData();

        // Map the parameters to a task object based on the INSERT column order
        const newTask = {
          id: params[0],
          title: params[1],
          description: params[2],
          priority: params[3],
          status: params[4],
          dependencies: params[5], // JSON string
          timeEstimate: params[6],
          actualTime: params[7],
          dueDate: params[8], // ISO string
          scheduledDate: params[9], // ISO string - this is the key field!
          tags: params[10], // JSON string
          projectId: params[11],
          parentTaskId: params[12],
          subtasks: params[13], // JSON string
          completedAt: params[14], // ISO string
          createdAt: params[15], // ISO string
          updatedAt: params[16], // ISO string
        };

        data.tasks.push(newTask);
        this.saveData(data);

        return { changes: 1, lastInsertRowid: Date.now() };
      }
    }

    // For other queries, just return success
    return { changes: 1, lastInsertRowid: Date.now() };
  }

  async select<T>(query: string, params?: any[]): Promise<T> {
    console.log('Mock DB Select:', query, params);

    const data = this.getData();

    // Simple query parsing for common cases
    if (query.includes('sqlite_version')) {
      return [{ sqlite_version: 'mock-3.0.0' }] as T;
    }

    if (query.includes('FROM migrations')) {
      return [{ version: '002' }] as T;
    }

    if (query.includes('FROM sqlite_master')) {
      return [
        { name: 'tasks' },
        { name: 'time_sessions' },
        { name: 'focus_sessions' },
        { name: 'migrations' },
      ] as T;
    }

    if (query.includes('FROM tasks')) {
      return data.tasks as T;
    }

    return [] as T;
  }

  async close(): Promise<void> {
    console.log('Mock DB closed');
  }

  // Mock methods for compatibility
  static async load(path: string): Promise<MockDatabase> {
    console.log('Loading mock database:', path);
    return new MockDatabase();
  }
}

/**
 * Clear old localStorage data and reinitialize
 */
export function clearMockDatabase(): void {
  localStorage.removeItem('kirapilot-mock-db');
  console.log('Cleared old mock database data');
}

/**
 * Initialize mock database with sample data
 */
export async function initializeMockDatabase(): Promise<MockDatabase> {
  const mockDb = new MockDatabase();

  // Check if we have old format data and migrate it
  const existingData = localStorage.getItem('kirapilot-mock-db');
  if (existingData) {
    try {
      const parsed = JSON.parse(existingData);
      if (parsed.tasks && parsed.tasks.length > 0) {
        // Check if any task has old format ID or is missing scheduledDate field
        const hasOldFormatIds = parsed.tasks.some(
          (task: any) =>
            !task.id.match(
              /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
            )
        );
        const missingScheduledDate = parsed.tasks.some(
          (task: any) =>
            task.scheduledDate === undefined &&
            task.hasOwnProperty('scheduledDate') === false
        );

        if (hasOldFormatIds) {
          console.log('Found old format task IDs, migrating to UUID format...');
          // Import migration utilities
          const { migrateTaskData } = await import('../../utils/migration');
          const migratedTasks = migrateTaskData(parsed.tasks);

          const newData = {
            ...parsed,
            tasks: migratedTasks,
          };

          localStorage.setItem('kirapilot-mock-db', JSON.stringify(newData));
          console.log('Migration completed successfully');
          return mockDb;
        } else if (missingScheduledDate) {
          console.log(
            'Found tasks missing scheduledDate field, clearing database to reinitialize...'
          );
          clearMockDatabase();
        } else {
          // Data looks good, no need to reinitialize
          return mockDb;
        }
      }
    } catch {
      console.log('Error parsing existing data, clearing database...');
      clearMockDatabase();
    }
  }

  // Initialize with some sample data
  const sampleTasks: Task[] = [
    {
      id: '550e8400-e29b-41d4-a716-446655440001',
      title: 'Complete project documentation',
      description:
        'Write comprehensive documentation for the KiraPilot project',
      priority: Priority.HIGH,
      status: TaskStatus.IN_PROGRESS,
      dependencies: [],
      timeEstimate: 120,
      actualTime: 45,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      scheduledDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
      tags: ['documentation', 'project'],
      subtasks: [],
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      updatedAt: new Date(),
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440002',
      title: 'Review code changes',
      description: 'Review the latest pull requests and provide feedback',
      priority: Priority.MEDIUM,
      status: TaskStatus.PENDING,
      dependencies: [],
      timeEstimate: 60,
      actualTime: 0,
      dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
      scheduledDate: new Date(), // TODAY - scheduled for today
      tags: ['code-review', 'development'],
      subtasks: [],
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
      updatedAt: new Date(),
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440003',
      title: 'Update dependencies',
      description: 'Update all npm dependencies to latest versions',
      priority: Priority.LOW,
      status: TaskStatus.COMPLETED,
      dependencies: [],
      timeEstimate: 30,
      actualTime: 25,
      scheduledDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // YESTERDAY - was scheduled yesterday
      tags: ['maintenance', 'dependencies'],
      subtasks: [],
      completedAt: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
      updatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440004',
      title: 'Design new UI components',
      description:
        'Create mockups and designs for the new dashboard components',
      priority: Priority.HIGH,
      status: TaskStatus.PENDING,
      dependencies: ['550e8400-e29b-41d4-a716-446655440001'], // Depends on documentation
      timeEstimate: 180,
      actualTime: 0,
      dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days from now
      scheduledDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
      tags: ['design', 'ui', 'dashboard'],
      subtasks: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    // TEST TASKS FOR DEBUGGING
    {
      id: '550e8400-e29b-41d4-a716-446655440005',
      title: 'TASK SCHEDULED FOR TODAY',
      description: 'This task should appear in Today column when viewing today',
      priority: Priority.HIGH,
      status: TaskStatus.PENDING,
      dependencies: [],
      timeEstimate: 60,
      actualTime: 0,
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // Due in 3 days
      scheduledDate: new Date(), // SCHEDULED FOR TODAY
      tags: ['test', 'today'],
      subtasks: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440006',
      title: 'TASK SCHEDULED FOR YESTERDAY',
      description:
        'This task should appear in Today column when viewing today (overdue schedule)',
      priority: Priority.MEDIUM,
      status: TaskStatus.PENDING,
      dependencies: [],
      timeEstimate: 30,
      actualTime: 0,
      dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // Due tomorrow
      scheduledDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // SCHEDULED FOR YESTERDAY
      tags: ['test', 'yesterday'],
      subtasks: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440007',
      title: 'TASK SCHEDULED FOR TOMORROW',
      description: 'This task should appear in Next column when viewing today',
      priority: Priority.LOW,
      status: TaskStatus.PENDING,
      dependencies: [],
      timeEstimate: 45,
      actualTime: 0,
      dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // Due in 5 days
      scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // SCHEDULED FOR TOMORROW
      tags: ['test', 'tomorrow'],
      subtasks: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440008',
      title: 'TASK NO SCHEDULED DATE',
      description: 'This task should appear in Backlog',
      priority: Priority.LOW,
      status: TaskStatus.PENDING,
      dependencies: [],
      timeEstimate: 15,
      actualTime: 0,
      dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // Due in 2 days
      scheduledDate: undefined, // NO SCHEDULED DATE - should go to backlog
      tags: ['test', 'backlog'],
      subtasks: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  // Store sample data
  const data = {
    tasks: sampleTasks,
    timeSessions: [],
    focusSessions: [],
    patterns: [],
    preferences: {},
    suggestions: [],
  };

  localStorage.setItem('kirapilot-mock-db', JSON.stringify(data));

  console.log('Mock database initialized with sample data');
  return mockDb;
}

/**
 * Get sample tasks for development
 */
export function getSampleTasks(): Task[] {
  const data = JSON.parse(
    localStorage.getItem('kirapilot-mock-db') || '{"tasks":[]}'
  );
  const tasks = data.tasks || [];

  // Convert date strings back to Date objects
  return tasks.map((task: any) => ({
    ...task,
    createdAt: new Date(task.createdAt),
    updatedAt: new Date(task.updatedAt),
    dueDate: task.dueDate ? new Date(task.dueDate) : undefined,
    scheduledDate: task.scheduledDate
      ? new Date(task.scheduledDate)
      : undefined,
    completedAt: task.completedAt ? new Date(task.completedAt) : undefined,
  }));
}

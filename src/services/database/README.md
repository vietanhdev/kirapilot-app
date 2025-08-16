# KiraPilot Database System

This directory contains the complete database layer for KiraPilot, built on SQLite with Tauri integration.

## Overview

The database system provides:

- **SQLite Integration**: Local-first database with Tauri SQL plugin
- **Migration System**: Versioned schema migrations with rollback support
- **Connection Management**: Singleton database connection with health monitoring
- **React Integration**: Hooks and context providers for React components
- **Transaction Support**: ACID transactions for data integrity
- **Testing Tools**: Database testing and validation utilities

## Architecture

```
src/services/database/
├── index.ts              # Core database service and migrations
├── DatabaseProvider.tsx  # React context provider
├── utils.ts              # Database utilities and maintenance
└── README.md             # This documentation
```

## Core Components

### Database Service (`index.ts`)

The main database service provides:

```typescript
// Initialize database with migrations
const db = await initializeDatabase();

// Get database instance
const db = await getDatabase();

// Execute transactions
await executeTransaction(async db => {
  await db.execute('INSERT INTO tasks ...');
  await db.execute('UPDATE tasks ...');
});

// Check database health
const health = await checkDatabaseHealth();
```

### React Integration (`DatabaseProvider.tsx`)

React components can access the database through context:

```typescript
function MyComponent() {
  const { database, isInitialized, error } = useDatabaseContext();

  if (!isInitialized) {
    return <div>Loading database...</div>;
  }

  // Use database...
}

// Wrap your app
<DatabaseProvider>
  <App />
</DatabaseProvider>
```

### Database Hooks

Custom hooks for database operations:

```typescript
function useTaskOperations() {
  const { execute, isLoading, error } = useDatabaseOperation();

  const createTask = async taskData => {
    return await execute(async () => {
      const db = await getDatabase();
      return await db.execute('INSERT INTO tasks ...', [taskData]);
    });
  };

  return { createTask, isLoading, error };
}
```

## Database Schema

### Tables

#### `tasks`

Core task management table:

```sql
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  priority INTEGER DEFAULT 1,
  status TEXT DEFAULT 'pending',
  dependencies TEXT DEFAULT '[]',
  time_estimate INTEGER DEFAULT 0,
  actual_time INTEGER DEFAULT 0,
  due_date DATETIME,
  scheduled_date DATETIME,
  tags TEXT DEFAULT '[]',
  project_id TEXT,
  parent_task_id TEXT,
  subtasks TEXT DEFAULT '[]',
  completed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### `task_dependencies`

Task dependency relationships:

```sql
CREATE TABLE task_dependencies (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  depends_on_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (depends_on_id) REFERENCES tasks(id) ON DELETE CASCADE,
  UNIQUE(task_id, depends_on_id)
);
```

#### `time_sessions`

Time tracking sessions:

```sql
CREATE TABLE time_sessions (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  start_time DATETIME NOT NULL,
  end_time DATETIME,
  paused_time INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT 0,
  notes TEXT DEFAULT '',
  breaks TEXT DEFAULT '[]',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);
```

#### `focus_sessions`

Focus session tracking:

```sql
CREATE TABLE focus_sessions (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  planned_duration INTEGER NOT NULL,
  actual_duration INTEGER,
  focus_score REAL,
  distraction_count INTEGER DEFAULT 0,
  distraction_level TEXT DEFAULT 'moderate',
  background_audio TEXT,
  notes TEXT DEFAULT '',
  breaks TEXT DEFAULT '[]',
  metrics TEXT DEFAULT '{}',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);
```

#### `productivity_patterns`

Analytics and pattern recognition:

```sql
CREATE TABLE productivity_patterns (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'default',
  pattern_type TEXT NOT NULL,
  time_slot TEXT NOT NULL,
  productivity_score REAL NOT NULL,
  confidence_level REAL NOT NULL,
  sample_size INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### `user_preferences`

User settings and preferences:

```sql
CREATE TABLE user_preferences (
  id TEXT PRIMARY KEY DEFAULT 'default',
  working_hours TEXT NOT NULL DEFAULT '{"start":"09:00","end":"17:00"}',
  break_preferences TEXT NOT NULL DEFAULT '{"shortBreakDuration":5,"longBreakDuration":30,"breakInterval":60}',
  focus_preferences TEXT NOT NULL DEFAULT '{"defaultDuration":45,"distractionLevel":"moderate","backgroundAudio":{"type":"silence","volume":0}}',
  notifications TEXT NOT NULL DEFAULT '{"breakReminders":true,"taskDeadlines":true,"dailySummary":false,"weeklyReview":true}',
  theme TEXT DEFAULT 'auto',
  language TEXT DEFAULT 'en',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### `ai_suggestions`

AI assistant suggestions:

```sql
CREATE TABLE ai_suggestions (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  confidence REAL NOT NULL,
  actionable BOOLEAN DEFAULT 1,
  priority INTEGER DEFAULT 1,
  estimated_impact REAL DEFAULT 0,
  reasoning TEXT DEFAULT '',
  actions TEXT DEFAULT '[]',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  dismissed_at DATETIME,
  applied_at DATETIME
);
```

### Indexes

Performance indexes are automatically created:

- Task status, priority, due date, scheduled date, creation date
- Task dependencies for both directions
- Time sessions by task and start time
- Focus sessions by task and creation date
- Productivity patterns by user and type
- AI suggestions by type and creation date

## Migration System

### How Migrations Work

1. **Version Tracking**: Each migration has a unique version number
2. **Sequential Application**: Migrations are applied in order
3. **Rollback Support**: Each migration includes both `up` and `down` scripts
4. **Automatic Execution**: Migrations run automatically on database initialization

### Adding New Migrations

To add a new migration:

1. **Create Migration Object**:

```typescript
{
  version: '003',
  description: 'Add new feature table',
  up: [
    'CREATE TABLE new_feature (...)',
    'CREATE INDEX idx_new_feature_id ON new_feature(id)'
  ],
  down: [
    'DROP INDEX idx_new_feature_id',
    'DROP TABLE new_feature'
  ]
}
```

2. **Add to Migration List**: Add the migration to the `getMigrations()` function in `index.ts`

3. **Test Migration**: Ensure both up and down scripts work correctly

### Migration Best Practices

- **Incremental Changes**: Keep migrations small and focused
- **Backward Compatibility**: Avoid breaking changes when possible
- **Data Preservation**: Include data migration scripts when changing schemas
- **Testing**: Test both up and down migrations thoroughly
- **Documentation**: Document complex migrations clearly

## Database Operations

### Basic Operations

```typescript
// Insert
await db.execute(
  'INSERT INTO tasks (id, title, description) VALUES (?, ?, ?)',
  [id, title, description]
);

// Select
const tasks = await db.select<Task[]>('SELECT * FROM tasks WHERE status = ?', [
  'pending',
]);

// Update
await db.execute('UPDATE tasks SET status = ? WHERE id = ?', [
  'completed',
  taskId,
]);

// Delete
await db.execute('DELETE FROM tasks WHERE id = ?', [taskId]);
```

### Transactions

```typescript
await executeTransaction(async db => {
  // Create task
  await db.execute('INSERT INTO tasks ...', [taskData]);

  // Create dependencies
  for (const depId of dependencies) {
    await db.execute('INSERT INTO task_dependencies ...', [taskId, depId]);
  }

  // Update parent task
  await db.execute('UPDATE tasks SET subtasks = ? WHERE id = ?', [
    subtasks,
    parentId,
  ]);
});
```

### Complex Queries

```typescript
// Tasks with dependencies
const tasksWithDeps = await db.select(
  `
  SELECT 
    t.*,
    GROUP_CONCAT(td.depends_on_id) as dependency_ids
  FROM tasks t
  LEFT JOIN task_dependencies td ON t.id = td.task_id
  WHERE t.status = ?
  GROUP BY t.id
`,
  ['pending']
);

// Productivity analytics
const productivity = await db.select(`
  SELECT 
    DATE(created_at) as date,
    COUNT(*) as tasks_completed,
    AVG(actual_time) as avg_time
  FROM tasks 
  WHERE status = 'completed' 
    AND created_at >= date('now', '-30 days')
  GROUP BY DATE(created_at)
  ORDER BY date
`);
```

## Database Utilities

### Maintenance Operations

```typescript
import {
  resetDatabase,
  getDatabaseStats,
  vacuumDatabase,
  analyzeDatabase,
  checkDatabaseIntegrity,
} from './utils';

// Get database statistics
const stats = await getDatabaseStats();
console.log(`Total records: ${stats.totalRecords}`);

// Vacuum database to reclaim space
await vacuumDatabase();

// Check database integrity
const integrity = await checkDatabaseIntegrity();
if (!integrity.isValid) {
  console.error('Database integrity issues:', integrity.errors);
}
```

### Backup and Export

```typescript
// Export to JSON
const backup = await exportDatabaseToJSON();
localStorage.setItem('database_backup', backup);

// Reset database (development only)
await resetDatabase();
```

## Testing

### Database Testing Component

The `DatabaseTest` component provides:

- Connection testing
- CRUD operation validation
- Foreign key constraint verification
- Index performance checks
- Data integrity validation

### Running Tests

```typescript
// In your component
<DatabaseTest />

// Or programmatically
const { execute } = useDatabaseOperation();
await execute(async () => {
  // Your database test operations
});
```

## Performance Considerations

### Optimization Tips

1. **Use Indexes**: Ensure frequently queried columns have indexes
2. **Limit Results**: Use LIMIT for large result sets
3. **Batch Operations**: Use transactions for multiple related operations
4. **Analyze Regularly**: Run ANALYZE to update query planner statistics
5. **Vacuum Periodically**: Reclaim space with VACUUM

### Query Performance

```typescript
// Good: Use indexes
const tasks = await db.select(
  'SELECT * FROM tasks WHERE status = ? ORDER BY priority DESC LIMIT 10',
  ['pending']
);

// Better: Use prepared statements for repeated queries
const getTasksByStatus = await db.prepare(
  'SELECT * FROM tasks WHERE status = ? ORDER BY created_at DESC'
);
```

## Error Handling

### Common Error Patterns

```typescript
try {
  await db.execute('INSERT INTO tasks ...', [data]);
} catch (error) {
  if (error.message.includes('UNIQUE constraint failed')) {
    // Handle duplicate key
  } else if (error.message.includes('FOREIGN KEY constraint failed')) {
    // Handle foreign key violation
  } else {
    // Handle other database errors
    console.error('Database error:', error);
  }
}
```

### Connection Issues

```typescript
const { database, error, initialize } = useDatabaseContext();

if (error) {
  // Show error to user and provide retry option
  return (
    <div>
      <p>Database error: {error}</p>
      <button onClick={initialize}>Retry</button>
    </div>
  );
}
```

## Security Considerations

### SQL Injection Prevention

- **Always use parameterized queries**
- **Never concatenate user input into SQL strings**
- **Validate input data before database operations**

```typescript
// Good: Parameterized query
await db.execute('SELECT * FROM tasks WHERE title = ?', [userInput]);

// Bad: String concatenation
await db.execute(`SELECT * FROM tasks WHERE title = '${userInput}'`);
```

### Data Validation

```typescript
import { validateTask } from '../types/validation';

const result = validateTask(taskData);
if (!result.success) {
  throw new Error('Invalid task data');
}

await db.execute('INSERT INTO tasks ...', [result.data]);
```

This database system provides a robust foundation for KiraPilot's data management needs, with comprehensive error handling, performance optimization, and development tools.

# KiraPilot Repository Layer

This directory contains the repository layer that provides a clean abstraction over database operations for KiraPilot's core entities.

## Overview

The repository pattern provides:
- **Data Access Abstraction**: Clean interface between business logic and database
- **CRUD Operations**: Complete Create, Read, Update, Delete functionality
- **Query Optimization**: Efficient database queries with proper indexing
- **Transaction Management**: ACID transactions for data integrity
- **Validation Integration**: Runtime validation using Zod schemas
- **Error Handling**: Comprehensive error handling and meaningful error messages

## Architecture

```
src/services/database/repositories/
├── TaskRepository.ts           # Task management operations
├── TimeTrackingRepository.ts   # Time tracking and session management
├── FocusRepository.ts          # Focus session management
├── PatternRepository.ts        # Productivity analytics and patterns
├── index.ts                    # Repository exports and singletons
├── __tests__/                  # Unit tests
│   └── TaskRepository.test.ts  # Task repository tests
└── README.md                   # This documentation
```

## Repositories

### TaskRepository

Manages tasks, dependencies, and task relationships.

#### Key Features
- **CRUD Operations**: Create, read, update, delete tasks
- **Dependency Management**: Handle task dependencies with circular dependency detection
- **Filtering & Sorting**: Advanced filtering by status, priority, tags, dates
- **Search Functionality**: Full-text search across title and description
- **Subtask Management**: Hierarchical task relationships
- **Statistics**: Task completion metrics and analytics

#### Usage Examples

```typescript
import { getTaskRepository } from './repositories';

const taskRepo = getTaskRepository();

// Create a new task
const task = await taskRepo.create({
  title: 'Complete project proposal',
  description: 'Write and review the Q1 project proposal',
  priority: Priority.HIGH,
  timeEstimate: 120,
  tags: ['work', 'proposal'],
  dueDate: new Date('2024-02-15')
});

// Find tasks with filters
const pendingTasks = await taskRepo.findAll({
  status: [TaskStatus.PENDING],
  priority: [Priority.HIGH, Priority.URGENT]
}, {
  field: 'dueDate',
  direction: 'asc'
});

// Update task
const updatedTask = await taskRepo.update(task.id, {
  status: TaskStatus.IN_PROGRESS,
  actualTime: 30
});

// Get task dependencies
const dependencies = await taskRepo.getDependencies(task.id);

// Get task statistics
const stats = await taskRepo.getStatistics();
```

#### Advanced Features

**Dependency Validation**
```typescript
// Validate task dependencies
const validation = await taskRepo.validateDependencies(taskId);
if (!validation.isValid) {
  console.error('Dependency issues:', validation.errors);
}
```

**Search and Filtering**
```typescript
// Complex filtering
const filteredTasks = await taskRepo.findAll({
  status: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS],
  tags: ['urgent', 'important'],
  dueDate: {
    from: new Date(),
    to: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Next 7 days
  },
  search: 'project'
});

// Get overdue tasks
const overdueTasks = await taskRepo.getOverdue();

// Search by tag
const workTasks = await taskRepo.getByTag('work');
```

### TimeTrackingRepository

Manages timer sessions, breaks, and time tracking analytics.

#### Key Features
- **Session Management**: Start, pause, resume, stop timer sessions
- **Break Tracking**: Record breaks and interruptions
- **Time Analytics**: Comprehensive time tracking statistics
- **Productivity Scoring**: Calculate productivity scores based on work patterns
- **Session Validation**: Prevent multiple active sessions

#### Usage Examples

```typescript
import { getTimeTrackingRepository } from './repositories';

const timeRepo = getTimeTrackingRepository();

// Start a timer session
const session = await timeRepo.startSession(taskId, 'Working on feature implementation');

// Add a break
const updatedSession = await timeRepo.addBreak(session.id, 'Coffee break', 5 * 60 * 1000);

// Stop session
const completedSession = await timeRepo.stopSession(session.id, 'Completed initial implementation');

// Get time statistics
const stats = await timeRepo.getStatistics(startDate, endDate);
console.log(`Total work time: ${stats.totalWorkTime / (1000 * 60 * 60)} hours`);

// Get today's sessions
const todaySessions = await timeRepo.getTodaySessions();

// Get time summary
const summary = await timeRepo.getTimeSummary(startDate, endDate);
```

#### Session Management

**Active Session Control**
```typescript
// Get current active session
const activeSession = await timeRepo.getActiveSession();

// Pause active session
if (activeSession) {
  await timeRepo.pauseSession(activeSession.id);
}

// Resume session
await timeRepo.resumeSession(sessionId);
```

**Analytics and Reporting**
```typescript
// Get comprehensive statistics
const stats = await timeRepo.getStatistics();
console.log({
  totalSessions: stats.totalSessions,
  averageProductivity: stats.averageProductivity,
  mostProductiveHour: stats.mostProductiveHour
});

// Get sessions by date range
const sessions = await timeRepo.getByDateRange(startDate, endDate);
```

### FocusRepository

Manages focus sessions, distractions, and focus analytics.

#### Key Features
- **Focus Session Management**: Start, complete, and track focus sessions
- **Distraction Tracking**: Record and analyze distractions
- **Focus Scoring**: Calculate focus scores based on session quality
- **Break Management**: Handle planned and unplanned breaks
- **Energy Tracking**: Monitor energy levels during sessions

#### Usage Examples

```typescript
import { getFocusRepository } from './repositories';

const focusRepo = getFocusRepository();

// Start focus session
const session = await focusRepo.startSession({
  duration: 45,
  taskId: taskId,
  distractionLevel: DistractionLevel.MODERATE,
  breakReminders: true,
  backgroundAudio: {
    type: 'white_noise',
    volume: 30
  }
});

// Record distraction
await focusRepo.addDistraction(session.id, 'Phone notification');

// Update energy level
await focusRepo.updateEnergyLevel(session.id, 75);

// Complete session
const completedSession = await focusRepo.completeSession(session.id, 'Good focus session');

// Get focus statistics
const stats = await focusRepo.getStatistics(startDate, endDate);
```

#### Focus Analytics

**Session Analysis**
```typescript
// Get focus summary
const summary = await focusRepo.getFocusSummary(startDate, endDate);
console.log({
  averageFocusScore: summary.averageFocusScore,
  totalDistractions: summary.totalDistractions,
  focusEfficiency: summary.focusEfficiency
});

// Get sessions by task
const taskSessions = await focusRepo.getByTask(taskId);
```

### PatternRepository

Manages productivity patterns, analytics, and AI insights.

#### Key Features
- **Pattern Learning**: Record and analyze productivity patterns
- **Trend Analysis**: Track productivity trends over time
- **Optimal Time Detection**: Identify best times for different activities
- **AI Recommendations**: Generate intelligent suggestions based on patterns
- **Energy Pattern Analysis**: Track energy levels and optimal work times

#### Usage Examples

```typescript
import { getPatternRepository } from './repositories';

const patternRepo = getPatternRepository();

// Record productivity data
await patternRepo.recordTaskCompletion(
  userId,
  taskId,
  completionTime,
  actualTime,
  estimatedTime
);

// Record focus session data
await patternRepo.recordFocusSession(
  userId,
  sessionStart,
  duration,
  focusScore,
  distractionCount
);

// Get optimal work times
const optimalTimes = await patternRepo.getOptimalWorkTimes(userId, 5);

// Analyze productivity trends
const analysis = await patternRepo.analyzeProductivityTrends(userId, startDate, endDate);

// Get productivity trend data
const trendData = await patternRepo.getProductivityTrend(userId, startDate, endDate, 'day');
```

#### Pattern Analysis

**Daily Patterns**
```typescript
// Get daily productivity patterns
const dailyPatterns = await patternRepo.getDailyPatterns(userId);

// Get pattern statistics
const stats = await patternRepo.getPatternStatistics(userId);
console.log({
  totalPatterns: stats.totalPatterns,
  averageConfidence: stats.averageConfidence,
  mostReliableTimeSlot: stats.mostReliableTimeSlot
});
```

## Repository Pattern Benefits

### 1. Separation of Concerns
- Business logic separated from data access
- Clean interfaces for different data entities
- Testable code with mockable repositories

### 2. Data Consistency
- Transaction management ensures ACID properties
- Validation at the repository level
- Referential integrity maintenance

### 3. Performance Optimization
- Efficient queries with proper indexing
- Batch operations where appropriate
- Connection pooling and resource management

### 4. Error Handling
- Consistent error handling across all repositories
- Meaningful error messages for debugging
- Graceful degradation for non-critical failures

## Testing

### Unit Testing Strategy

Each repository has comprehensive unit tests covering:
- **CRUD Operations**: All create, read, update, delete operations
- **Edge Cases**: Invalid data, missing records, constraint violations
- **Business Logic**: Dependency validation, circular dependency detection
- **Error Scenarios**: Database errors, validation failures
- **Performance**: Query efficiency and resource usage

### Test Examples

```typescript
describe('TaskRepository', () => {
  test('should create task with dependencies', async () => {
    const depTask = await repository.create({
      title: 'Dependency Task',
      description: 'A dependency task'
    });

    const mainTask = await repository.create({
      title: 'Main Task',
      dependencies: [depTask.id]
    });

    expect(mainTask.dependencies).toContain(depTask.id);
  });

  test('should reject circular dependencies', async () => {
    // Test circular dependency detection
    await expect(repository.update(task1.id, {
      dependencies: [task2.id]
    })).rejects.toThrow('Circular dependency detected');
  });
});
```

### Running Tests

```bash
# Run all repository tests
npm test -- --testPathPattern=repositories

# Run specific repository tests
npm test -- --testPathPattern=TaskRepository.test.ts

# Run tests with coverage
npm run test:coverage
```

## Performance Considerations

### Query Optimization
- **Indexes**: All frequently queried columns have appropriate indexes
- **Query Planning**: Complex queries are optimized for performance
- **Batch Operations**: Multiple operations are batched when possible
- **Connection Management**: Efficient database connection usage

### Memory Management
- **Result Streaming**: Large result sets are streamed when possible
- **Connection Pooling**: Database connections are properly pooled
- **Resource Cleanup**: All resources are properly cleaned up

### Caching Strategy
- **Query Caching**: Frequently accessed data is cached
- **Invalidation**: Cache is properly invalidated on updates
- **Memory Limits**: Cache size is limited to prevent memory issues

## Error Handling Patterns

### Repository-Level Errors
```typescript
try {
  const task = await taskRepo.create(taskData);
} catch (error) {
  if (error.message.includes('Invalid task data')) {
    // Handle validation error
  } else if (error.message.includes('Circular dependency')) {
    // Handle business logic error
  } else {
    // Handle unexpected error
  }
}
```

### Transaction Errors
```typescript
try {
  await executeTransaction(async (db) => {
    // Multiple operations
    await taskRepo.create(task1);
    await taskRepo.create(task2);
  });
} catch (error) {
  // Transaction was rolled back
  console.error('Transaction failed:', error);
}
```

## Best Practices

### 1. Repository Usage
- Always use repository methods instead of direct database access
- Handle errors appropriately at the service layer
- Use transactions for multi-step operations
- Validate data before repository calls

### 2. Performance
- Use appropriate filters to limit result sets
- Implement pagination for large datasets
- Monitor query performance and optimize as needed
- Use batch operations for multiple related changes

### 3. Testing
- Write comprehensive unit tests for all repository methods
- Test error scenarios and edge cases
- Use in-memory database for testing
- Mock external dependencies

### 4. Maintenance
- Keep repository interfaces stable
- Document breaking changes
- Monitor repository performance
- Regular cleanup of old data

This repository layer provides a solid foundation for KiraPilot's data access needs, with comprehensive functionality, robust error handling, and excellent testability.
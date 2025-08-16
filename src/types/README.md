# KiraPilot Type System

This directory contains the comprehensive type definitions and validation schemas for KiraPilot.

## Overview

The type system is designed with the following principles:

- **Type Safety**: All data structures are strongly typed with TypeScript
- **Runtime Validation**: Zod schemas provide runtime type checking and validation
- **Data Transformation**: Utilities for converting between different data representations
- **Extensibility**: Easy to extend with new types and validation rules

## Files

### `index.ts`

Core TypeScript interfaces and enums for all KiraPilot data structures:

- **Task Management**: `Task`, `CreateTaskRequest`, `UpdateTaskRequest`
- **Time Tracking**: `TimerSession`, `CompletedSession`, `TimerBreak`
- **Focus Sessions**: `FocusSession`, `FocusConfig`, `FocusMetrics`
- **Analytics**: `EnergyMetrics`, `ProductivityPattern`, `PatternAnalysis`
- **AI Integration**: `AISuggestion`, `AIAction`, `AIResponse`
- **User Preferences**: `UserPreferences`, `AppContext`

### `validation.ts`

Zod validation schemas corresponding to each TypeScript interface:

- Runtime type validation
- Input sanitization
- Error message generation
- Default value application
- Complex validation rules (e.g., time ranges, circular dependencies)

## Key Features

### Enums

```typescript
enum Priority {
  LOW = 0,
  MEDIUM = 1,
  HIGH = 2,
  URGENT = 3,
}

enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}
```

### Core Data Models

#### Task

```typescript
interface Task {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  status: TaskStatus;
  dependencies: string[];
  timeEstimate: number; // in minutes
  actualTime: number; // in minutes
  dueDate?: Date;
  tags: string[];
  // ... additional fields
}
```

#### Timer Session

```typescript
interface TimerSession {
  id: string;
  taskId: string;
  startTime: Date;
  endTime?: Date;
  pausedTime: number; // in milliseconds
  isActive: boolean;
  notes: string;
  breaks: TimerBreak[];
}
```

#### Focus Session

```typescript
interface FocusSession {
  id: string;
  taskId: string;
  plannedDuration: number; // in minutes
  actualDuration?: number;
  focusScore?: number; // 0-100
  distractionCount: number;
  metrics: FocusMetrics;
  // ... additional fields
}
```

### Validation Examples

#### Creating a Task

```typescript
import { validateCreateTaskRequest } from './validation';

const taskData = {
  title: 'Complete project proposal',
  description: 'Write and review the Q1 project proposal',
  priority: Priority.HIGH,
  timeEstimate: 120,
  tags: ['work', 'proposal'],
  dueDate: new Date('2024-02-15'),
};

const result = validateCreateTaskRequest(taskData);
if (result.success) {
  // Data is valid, use result.data
  const validatedTask = result.data;
} else {
  // Handle validation errors
  console.error(result.error.issues);
}
```

#### Focus Configuration

```typescript
import { validateFocusConfig } from './validation';

const focusConfig = {
  duration: 45,
  taskId: 'task-uuid',
  distractionLevel: DistractionLevel.MODERATE,
  breakReminders: true,
  backgroundAudio: {
    type: 'white_noise',
    volume: 30,
  },
};

const result = validateFocusConfig(focusConfig);
```

### Validation Features

#### Built-in Validations

- **String Length**: Min/max length validation for titles, descriptions
- **Number Ranges**: Valid ranges for durations, scores, volumes
- **Date Validation**: Proper date formats and logical date ranges
- **UUID Validation**: Proper UUID format for IDs
- **Time Format**: HH:MM format validation for time slots
- **Enum Validation**: Valid enum values only

#### Custom Validations

- **Time Range Logic**: End time must be after start time
- **Circular Dependencies**: Prevent circular task dependencies
- **Working Hours**: Logical working hour ranges
- **Break Intervals**: Sensible break timing

#### Error Handling

```typescript
const result = validateCreateTaskRequest(invalidData);
if (!result.success) {
  result.error.issues.forEach(issue => {
    console.log(`${issue.path.join('.')}: ${issue.message}`);
  });
}
```

## Usage Patterns

### 1. API Input Validation

```typescript
// In API handlers
const result = validateCreateTaskRequest(req.body);
if (!result.success) {
  return res.status(400).json({ errors: result.error.issues });
}
const task = createTaskRequestToTask(result.data);
```

### 2. Form Validation

```typescript
// In React components
const [errors, setErrors] = useState<string[]>([]);

const handleSubmit = (formData: unknown) => {
  const result = validateCreateTaskRequest(formData);
  if (!result.success) {
    setErrors(result.error.issues.map(i => i.message));
    return;
  }
  // Process valid data
  onTaskCreate(result.data);
};
```

### 3. Database Operations

```typescript
// Before saving to database
const result = validateTask(taskData);
if (result.success) {
  const dbRow = taskToDbRow(result.data);
  await database.insert('tasks', dbRow);
}
```

## Testing

The validation schemas are thoroughly tested with:

- Valid input cases
- Invalid input cases
- Edge cases
- Default value application
- Complex validation rules

Run tests with:

```bash
npm test
```

## Extension Guidelines

When adding new types:

1. **Define TypeScript Interface**: Add to `index.ts`
2. **Create Zod Schema**: Add to `validation.ts`
3. **Add Validation Function**: Export validation helper
4. **Write Tests**: Add comprehensive test cases
5. **Update Documentation**: Document the new types

### Example: Adding a New Type

```typescript
// 1. TypeScript interface
interface Project {
  id: string;
  name: string;
  description: string;
  color: string;
  createdAt: Date;
}

// 2. Zod schema
const ProjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(500),
  color: z.string().regex(/^#[0-9A-F]{6}$/i),
  createdAt: z.date(),
});

// 3. Validation function
export function validateProject(data: unknown) {
  return ProjectSchema.safeParse(data);
}
```

This type system provides a solid foundation for data integrity and type safety throughout the KiraPilot application.

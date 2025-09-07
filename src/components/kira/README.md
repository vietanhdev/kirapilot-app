# Kira Chat View - Assignment Context Integration

This document explains how thread assignment context is integrated with the AI service to provide contextual assistance.

## Overview

The Kira chat view supports thread assignments that provide contextual information to the AI service. When a thread is assigned to a task or day, the AI receives relevant context to provide more targeted assistance.

## Assignment Types

### Task Assignment

When a thread is assigned to a specific task:

- The AI receives the complete task details (title, description, status, priority, etc.)
- The task is set as `currentTask` in the AppContext
- Additional task metadata is added to `recentActivity`

### Day Assignment

When a thread is assigned to a specific day:

- The AI receives all tasks scheduled for that day
- Tasks are added to `recentActivity` with scheduling information
- The assignment date is included in the context

### General Assignment

When a thread has no specific assignment:

- The AI operates with default context
- No additional task or day-specific information is provided

## Implementation Details

### Context Building (`useThreadMessages.buildAppContext`)

The `buildAppContext` function in `useThreadMessages` hook is responsible for building the appropriate context based on thread assignment:

```typescript
const buildAppContext = async (
  assignment?: ThreadAssignment
): Promise<AppContext> => {
  const baseContext: AppContext = {
    // ... default context fields
  };

  if (assignment) {
    if (assignment.type === 'task' && assignment.taskId) {
      // Load task details and add to context
      const task = await taskService.findById(assignment.taskId);
      if (task) {
        baseContext.currentTask = task;
        // Add task metadata to recent activity
      }
    } else if (assignment.type === 'day' && assignment.date) {
      // Load all tasks for the day
      const dayTasks = await taskService.findScheduledBetween(
        startOfDay,
        endOfDay
      );
      baseContext.recentActivity = dayTasks.map(task => ({
        // Map tasks to activity events with day context
      }));
    }
  }

  return baseContext;
};
```

### Message Sending Integration

The `KiraView` component demonstrates proper integration by passing the thread assignment to the `sendMessage` function:

```typescript
const handleSendMessage = async (message: string) => {
  if (!selectedThread) return;

  // Pass thread assignment to provide AI with proper context
  await sendMessage(message, selectedThread.assignment);
};
```

### AI Service Integration

The AI service receives the built `AppContext` which includes:

- `currentTask`: When thread is assigned to a task
- `recentActivity`: Task list when assigned to a day, or task metadata
- Assignment metadata in activity events for AI awareness

## Usage Example

```typescript
// Create a thread assigned to a task
const taskAssignment: ThreadAssignment = {
  type: 'task',
  taskId: 'task-123',
};

const thread = await createThread({ assignment: taskAssignment });

// When sending messages in this thread, AI will have task context
await sendMessage('How can I complete this task?', taskAssignment);
// AI receives task details and can provide specific guidance
```

## Benefits

1. **Contextual Assistance**: AI understands what task or day the user is working on
2. **Relevant Suggestions**: AI can provide task-specific or schedule-aware recommendations
3. **Improved Accuracy**: Context helps AI give more precise and useful responses
4. **Seamless Integration**: Assignment context is automatically included without user intervention

## Requirements Satisfied

This implementation satisfies the following requirements:

- **3.2**: AI has access to task context when thread is assigned to a task
- **3.3**: AI has access to day schedule when thread is assigned to a day
- **5.1**: Existing AI service infrastructure is reused with enhanced context

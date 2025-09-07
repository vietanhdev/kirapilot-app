# Design Document

## Overview

The Kira chat view feature introduces a dedicated full-screen chat interface that replaces the current floating chat UI with a more comprehensive conversation management system. The design follows ChatGPT's layout patterns while maintaining consistency with KiraPilot's existing design system using HeroUI components.

The feature consists of three main components:

1. **Thread Management System** - Sidebar for organizing conversations
2. **Chat Interface** - Main conversation area with message display and input
3. **Context Assignment** - System for linking threads to tasks or days

## Architecture

### Component Structure

```
KiraView/
├── KiraView.tsx                    # Main view container
├── components/
│   ├── ThreadSidebar.tsx          # Thread list and management
│   ├── ChatArea.tsx               # Main conversation interface
│   ├── MessageList.tsx            # Message display component
│   ├── MessageInput.tsx           # Message composition
│   ├── ThreadAssignmentModal.tsx  # Context assignment dialog
│   └── ThreadItem.tsx             # Individual thread list item
├── hooks/
│   ├── useThreads.tsx             # Thread management logic
│   ├── useThreadMessages.tsx      # Message handling for threads
│   └── useKiraNavigation.tsx      # Navigation and keyboard shortcuts
└── types/
    └── thread.ts                  # Thread-specific type definitions
```

### Navigation Integration

The Kira view integrates into the existing navigation system by:

- Adding a "Kira" button to the Header component navigation
- Using the existing NavigationContext for view management
- Maintaining state persistence when switching between views
- Following the same navigation patterns as Week/Day views

### State Management

The feature leverages existing context providers:

- **AIContext** - For AI service integration and conversation handling
- **TaskListContext** - For task assignment and context
- **NavigationContext** - For view management
- **New ThreadContext** - For thread-specific state management

## Components and Interfaces

### Core Components

#### KiraView

Main container component that orchestrates the entire chat interface.

```typescript
interface KiraViewProps {
  // No props needed - uses contexts for state
}
```

**Responsibilities:**

- Layout management (sidebar + chat area)
- Keyboard shortcut handling
- Thread creation and deletion
- Integration with existing AI context

#### ThreadSidebar

Left sidebar component for thread management and navigation.

```typescript
interface ThreadSidebarProps {
  threads: Thread[];
  activeThreadId: string | null;
  onThreadSelect: (threadId: string) => void;
  onThreadCreate: () => void;
  onThreadDelete: (threadId: string) => void;
  onThreadAssign: (threadId: string) => void;
}
```

**Features:**

- Thread list with search/filter
- New thread creation button
- Thread assignment indicators
- Context menu for thread actions
- Keyboard navigation support

#### ChatArea

Main conversation interface reusing existing chat components.

```typescript
interface ChatAreaProps {
  thread: Thread | null;
  messages: ThreadMessage[];
  isLoading: boolean;
  onSendMessage: (message: string) => void;
}
```

**Features:**

- Message display using existing MarkdownRenderer
- Message input with keyboard shortcuts
- Tool execution display using ContextualActionButtons
- Feedback collection using existing components
- Auto-scroll functionality

#### MessageList

Displays conversation messages with existing styling.

```typescript
interface MessageListProps {
  messages: ThreadMessage[];
  isLoading: boolean;
  threadAssignment?: ThreadAssignment;
}
```

**Features:**

- Reuses existing message display components
- Shows user messages on right, AI on left
- Displays tool executions and reasoning
- Handles message actions and feedback

#### MessageInput

Message composition area with enhanced features.

```typescript
interface MessageInputProps {
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  placeholder?: string;
  disabled?: boolean;
}
```

**Features:**

- Multi-line text input with auto-resize
- Send button with loading state
- Keyboard shortcuts (Enter to send, Shift+Enter for new line)
- Message validation and error handling

### Custom Hooks

#### useThreads

Manages thread CRUD operations and state.

```typescript
interface UseThreadsReturn {
  threads: Thread[];
  activeThread: Thread | null;
  isLoading: boolean;
  error: string | null;
  createThread: (assignment?: ThreadAssignment) => Promise<Thread>;
  selectThread: (threadId: string) => void;
  deleteThread: (threadId: string) => Promise<void>;
  updateThread: (threadId: string, updates: Partial<Thread>) => Promise<void>;
  assignThread: (
    threadId: string,
    assignment: ThreadAssignment
  ) => Promise<void>;
}
```

#### useThreadMessages

Handles message operations within threads.

```typescript
interface UseThreadMessagesReturn {
  messages: ThreadMessage[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (message: string) => Promise<void>;
  loadMessages: (threadId: string) => Promise<void>;
  clearMessages: () => void;
}
```

## Data Models

### Thread Types

```typescript
interface Thread {
  id: string;
  title: string; // Auto-generated from first message
  assignment?: ThreadAssignment;
  messageCount: number;
  lastMessageAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface ThreadAssignment {
  type: 'task' | 'day' | 'general';
  taskId?: string;
  date?: Date;
  context?: Record<string, unknown>;
}

interface ThreadMessage {
  id: string;
  threadId: string;
  type: 'user' | 'assistant';
  content: string;
  reasoning?: string;
  actions?: AIAction[];
  suggestions?: AISuggestion[];
  toolExecutions?: ToolExecution[];
  timestamp: Date;
  userFeedback?: UserFeedback;
}

interface CreateThreadRequest {
  assignment?: ThreadAssignment;
}

interface UpdateThreadRequest {
  title?: string;
  assignment?: ThreadAssignment;
}

interface CreateThreadMessageRequest {
  threadId: string;
  type: 'user' | 'assistant';
  content: string;
  reasoning?: string;
  actions?: AIAction[];
  suggestions?: AISuggestion[];
  toolExecutions?: ToolExecution[];
}
```

### Database Schema

#### Threads Table

```sql
CREATE TABLE threads (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  assignment_type TEXT, -- 'task', 'day', 'general'
  assignment_task_id TEXT,
  assignment_date TEXT, -- ISO string for day assignments
  assignment_context TEXT, -- JSON for additional context
  message_count INTEGER DEFAULT 0,
  last_message_at TEXT, -- ISO string
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (assignment_task_id) REFERENCES tasks(id) ON DELETE SET NULL
);
```

#### Thread Messages Table

```sql
CREATE TABLE thread_messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  type TEXT NOT NULL, -- 'user' or 'assistant'
  content TEXT NOT NULL,
  reasoning TEXT,
  actions TEXT, -- JSON serialized AIAction[]
  suggestions TEXT, -- JSON serialized AISuggestion[]
  tool_executions TEXT, -- JSON serialized ToolExecution[]
  user_feedback TEXT, -- JSON serialized UserFeedback
  timestamp TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE
);
```

## Error Handling

### Database Errors

- Graceful fallback when database is unavailable
- Error messages using existing translation system
- Retry mechanisms for transient failures
- Data validation before database operations

### AI Service Errors

- Reuse existing AI error handling from AIContext
- Display error messages in chat interface
- Maintain thread state during service failures
- Fallback to offline mode when possible

### User Experience Errors

- Form validation for thread creation
- Confirmation dialogs for destructive actions
- Loading states during async operations
- Toast notifications for success/error feedback

## Testing Strategy

### Unit Tests

- Thread CRUD operations
- Message handling logic
- Context assignment functionality
- Database service methods
- Custom hooks behavior

### Integration Tests

- Thread creation and message flow
- AI service integration
- Database persistence
- Navigation between threads
- Keyboard shortcuts

### Component Tests

- Thread sidebar interactions
- Message display and formatting
- Input validation and submission
- Modal dialogs and confirmations
- Responsive layout behavior

### End-to-End Tests

- Complete conversation workflows
- Thread assignment scenarios
- Cross-view navigation
- Data persistence across sessions
- Error recovery scenarios

## Performance Considerations

### Message Loading

- Implement pagination for large conversations
- Lazy loading of older messages
- Virtual scrolling for performance
- Message caching strategies

### Thread Management

- Efficient thread list rendering
- Search and filter optimization
- Database query optimization
- Memory management for large datasets

### AI Integration

- Reuse existing AI service connections
- Efficient context building for assignments
- Tool execution result caching
- Response streaming for better UX

## Accessibility

### Keyboard Navigation

- Tab navigation through thread list
- Arrow key navigation between threads
- Keyboard shortcuts for common actions
- Focus management for modals and inputs

### Screen Reader Support

- Proper ARIA labels and roles
- Semantic HTML structure
- Live regions for dynamic content
- Alternative text for visual elements

### Visual Accessibility

- High contrast mode support
- Scalable text and UI elements
- Color-blind friendly indicators
- Reduced motion preferences

## Migration Strategy

### Existing Chat Data

- Migrate existing conversations to thread format
- Preserve conversation history and context
- Maintain compatibility with existing AI logs
- Gradual migration with fallback support

### Component Reuse

- Leverage existing ChatUI components
- Maintain existing AI service integration
- Preserve current keyboard shortcuts
- Keep existing feedback mechanisms

### User Experience Transition

- Smooth transition from floating chat
- Preserve user preferences and settings
- Maintain familiar interaction patterns
- Provide migration guidance if needed

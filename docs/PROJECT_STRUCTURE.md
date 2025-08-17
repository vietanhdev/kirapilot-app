# KiraPilot Project Structure

## Overview

KiraPilot is built with Tauri + React + TypeScript, providing a cross-platform productivity application with AI assistant integration. This document outlines the architectural decisions and organization patterns used in the codebase.

## Core Architecture

```
kirapilot-app/
├── src/                          # Frontend source code
│   ├── components/               # React components by feature
│   │   ├── common/              # Shared UI components (Header, DatePicker, etc.)
│   │   ├── planning/            # Task planning and scheduling
│   │   ├── timer/               # Time tracking and session management
│   │   ├── ai/                  # AI assistant components
│   │   ├── reports/             # Analytics and reporting
│   │   ├── settings/            # Application settings
│   │   └── TitleBar.tsx         # Custom window title bar
│   ├── services/                # Business logic and external integrations
│   │   ├── database/            # Database layer with repositories
│   │   ├── ai/                  # AI service integration
│   │   ├── notifications/       # System notifications
│   │   └── security/            # Data security utilities
│   ├── contexts/                # React context providers
│   ├── hooks/                   # Custom React hooks
│   ├── types/                   # TypeScript type definitions
│   ├── utils/                   # Pure utility functions
│   ├── i18n/                    # Internationalization
│   └── App.tsx                  # Main application component
├── src-tauri/                   # Tauri backend (Rust)
│   ├── src/                     # Rust source code
│   ├── icons/                   # Application icons
│   ├── capabilities/            # Tauri permissions
│   └── tauri.conf.json         # Tauri configuration
├── docs/                        # Documentation
└── .kiro/                       # Kiro AI steering documents
```

## Technology Stack

### Frontend

- **React 19+** with TypeScript for UI components
- **Vite 7+** for fast development and building
- **Tailwind CSS 4+** with HeroUI components for styling
- **Framer Motion** for smooth animations
- **Tiptap** for rich text editing
- **Lucide React** for icons
- **Zod** for runtime validation

### Backend

- **Tauri v2** (Rust) for native desktop integration
- **SQLite** via Tauri SQL plugin for local data storage
- **Database migrations** for schema versioning

### Development Tools

- **ESLint 9+** with TypeScript rules
- **Prettier** for code formatting
- **Jest** with React Testing Library for testing
- **Husky** with lint-staged for git hooks

## Component Organization

### Feature-Based Structure

Components are organized by domain/feature rather than by type:

```
components/
├── common/              # Reusable UI components
│   ├── Header.tsx
│   ├── DatePicker.tsx
│   ├── MarkdownRenderer.tsx
│   └── index.ts        # Clean exports
├── planning/           # Task management features
│   ├── Planner.tsx
│   ├── TaskCard.tsx
│   ├── TaskModal.tsx
│   └── WeekView.tsx
├── timer/              # Time tracking
│   ├── SessionHistory.tsx
│   └── index.ts
└── ai/                 # AI assistant UI
    ├── ChatUI.tsx
    ├── AIFloatingButton.tsx
    └── CollapsibleConversation.tsx
```

### Index File Pattern

Each feature folder includes an `index.ts` file for clean imports:

```typescript
// components/planning/index.ts
export { Planner } from './Planner';
export { TaskCard } from './TaskCard';
export { WeekView } from './WeekView';

// Usage elsewhere
import { Planner, TaskCard } from '../planning';
```

## Service Layer Architecture

### Repository Pattern

Database operations are abstracted through repositories:

```typescript
// services/database/repositories/TaskRepository.ts
export class TaskRepository {
  async createTask(task: Task): Promise<Task> {
    // Database implementation
  }

  async findByStatus(status: TaskStatus): Promise<Task[]> {
    // Query implementation
  }
}
```

### Database Layer

```
services/database/
├── index.ts                    # Core database service & migrations
├── DatabaseProvider.tsx       # React context provider
├── mockDatabase.ts            # Development fallback
├── utils.ts                   # Database utilities
└── repositories/              # Data access objects
    ├── TaskRepository.ts
    ├── TimeTrackingRepository.ts
    ├── PatternRepository.ts
    └── index.ts
```

### Migration System

Database schema changes are versioned and applied automatically:

```typescript
{
  version: '002',
  description: 'Add task dependencies',
  up: [
    'CREATE TABLE task_dependencies (...)',
    'CREATE INDEX idx_task_deps ON task_dependencies(task_id)'
  ],
  down: [
    'DROP INDEX idx_task_deps',
    'DROP TABLE task_dependencies'
  ]
}
```

## State Management

### Context + Hooks Pattern

Application state is managed through React Context and custom hooks:

```typescript
// contexts/TimerContext.tsx
export const TimerProvider = ({ children }) => {
  const [session, setSession] = useState<TimerSession | null>(null);
  // Timer logic
  return (
    <TimerContext.Provider value={{ session, startTimer, stopTimer }}>
      {children}
    </TimerContext.Provider>
  );
};

// hooks/useTimer.ts
export const useTimer = () => {
  const context = useContext(TimerContext);
  if (!context) {
    throw new Error('useTimer must be used within TimerProvider');
  }
  return context;
};
```

### Context Organization

```
contexts/
├── TimerContext.tsx        # Timer state and operations
├── SettingsContext.tsx     # User preferences
├── AIContext.tsx          # AI assistant state
└── PrivacyContext.tsx     # Privacy-aware data handling
```

## Type System

### Comprehensive TypeScript

All data structures are fully typed with TypeScript:

```typescript
// types/index.ts
export interface Task {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  status: TaskStatus;
  dependencies: string[];
  timeEstimate: number;
  actualTime: number;
  dueDate?: Date;
  scheduledDate?: Date;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}
```

### Runtime Validation

Zod schemas provide runtime type checking:

```typescript
// types/validation.ts
export const TaskSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200),
  priority: z.enum(['low', 'medium', 'high']),
  // ... other fields
});

export const validateTask = (data: unknown) => TaskSchema.safeParse(data);
```

## Naming Conventions

### Files and Folders

- **Components**: PascalCase (`TaskCard.tsx`)
- **Hooks**: camelCase with `use` prefix (`useDatabase.ts`)
- **Services**: PascalCase (`TaskRepository.ts`)
- **Utils**: camelCase (`validation.ts`)
- **Types**: camelCase (`index.ts`)

### Code Elements

- **Interfaces**: PascalCase (`Task`, `TimerSession`)
- **Enums**: PascalCase (`TaskStatus`, `Priority`)
- **Functions**: camelCase (`createTask`, `updateTimer`)
- **Constants**: UPPER_SNAKE_CASE (`DEFAULT_BREAK_DURATION`)

## Import Organization

Imports are organized by proximity and type:

```typescript
// External libraries first
import { useState, useEffect } from 'react';
import { Button, Card } from '@heroui/react';
import { format } from 'date-fns';

// Internal imports by proximity
import { Task, TaskStatus } from '../types';
import { useDatabase } from '../hooks/useDatabase';
import { TaskCard } from './TaskCard';
```

## Testing Strategy

### Test Organization

```
src/
├── components/
│   └── common/
│       ├── __tests__/
│       │   └── DatePicker.test.tsx
│       └── DatePicker.tsx
├── hooks/
│   ├── __tests__/
│   │   └── useClipboard.test.ts
│   └── useClipboard.ts
└── utils/
    ├── __tests__/
    │   └── validation.test.ts
    └── validation.ts
```

### Test Types

- **Unit Tests**: Components, hooks, utilities (Jest + RTL)
- **Integration Tests**: Database operations (Tauri environment)
- **E2E Tests**: Full application workflows (manual testing)

## Development Workflow

### Code Quality Pipeline

1. **Pre-commit**: Husky runs lint-staged
2. **Linting**: ESLint checks for code quality
3. **Formatting**: Prettier ensures consistent style
4. **Type Checking**: TypeScript validates types
5. **Testing**: Jest runs unit tests

### Build Process

```bash
# Development
npm run dev              # Vite dev server
npm run tauri dev        # Tauri app with hot reload

# Production
npm run build            # Frontend build
npm run tauri build      # Application bundle
```

## Key Architectural Decisions

### 1. Local-First Architecture

- SQLite database for offline-first functionality
- Optional cloud sync with user control
- Privacy-focused data handling

### 2. Component Isolation

- Feature-based folder organization
- Minimal prop drilling with React Context
- Self-contained components with clear interfaces

### 3. Type Safety

- Comprehensive TypeScript coverage
- Runtime validation with Zod schemas
- Database type safety through interface definitions

### 4. Migration Strategy

- Versioned database schema changes
- Automatic migration on app startup
- Rollback support for development

### 5. AI Integration

- Tool-based architecture for AI capabilities
- Context-aware suggestions and insights
- Privacy-preserving local processing

This architecture provides a scalable foundation for KiraPilot's productivity features while maintaining code quality, type safety, and development velocity.

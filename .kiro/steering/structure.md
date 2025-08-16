# Project Structure & Organization

## Directory Layout

```
src/
├── components/           # React components by feature
│   ├── common/          # Shared UI components (Header, DatePicker, etc.)
│   ├── planning/        # Task planning and scheduling
│   ├── timer/           # Time tracking and session management
│   └── TitleBar.tsx     # Custom window title bar
├── services/            # Business logic and external integrations
│   ├── database/        # Database layer with repositories
│   └── notifications/   # System notifications
├── contexts/            # React context providers
├── hooks/               # Custom React hooks
├── types/               # TypeScript type definitions
├── utils/               # Pure utility functions
└── App.tsx             # Main application component
```

## Architecture Patterns

### Component Organization

- **Feature-based folders**: Group related components together
- **Common components**: Reusable UI elements in `components/common/`
- **Index exports**: Use `index.ts` files for clean imports

### Service Layer

- **Repository pattern**: Database operations in `services/database/repositories/`
- **Provider pattern**: Context providers for dependency injection
- **Mock implementations**: Fallback services for development

### Data Flow

- **Context + Hooks**: State management via React Context
- **Repository abstraction**: Database operations through typed repositories with direct SQL
- **Validation layer**: Zod schemas for runtime type checking

## Naming Conventions

### Files & Folders

- **Components**: PascalCase (e.g., `TaskCard.tsx`)
- **Hooks**: camelCase with `use` prefix (e.g., `useDatabase.ts`)
- **Services**: PascalCase (e.g., `TaskRepository.ts`)
- **Utils**: camelCase (e.g., `validation.ts`)
- **Types**: camelCase (e.g., `index.ts`)

### Code Style

- **Interfaces**: PascalCase (e.g., `Task`, `TimerSession`)
- **Enums**: PascalCase (e.g., `TaskStatus`, `Priority`)
- **Functions**: camelCase (e.g., `createTask`, `updateTimer`)
- **Constants**: UPPER_SNAKE_CASE for module-level constants

## Import Patterns

```typescript
// External libraries first
import { useState } from 'react';
import { Button } from '@heroui/react';

// Internal imports by proximity
import { Task, TaskStatus } from '../types';
import { useDatabase } from '../hooks/useDatabase';
import { TaskCard } from './TaskCard';
```

## Testing Structure

- **Unit tests**: `__tests__/` folders alongside source files
- **Mock implementations**: `__mocks__/` folders for service mocks
- **Test utilities**: Shared test helpers in `src/setupTests.ts`

## Key Architectural Decisions

1. **Database abstraction**: Repository pattern with mock fallback
2. **Type safety**: Comprehensive TypeScript with Zod validation
3. **Component isolation**: Feature-based organization
4. **Context over props**: Minimize prop drilling with React Context
5. **Migration system**: Versioned database schema changes

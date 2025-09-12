# Project Structure

Learn about the organization and structure of the KiraPilot codebase.

## Directory Layout

```
kirapilot-app/
├── src/                          # Frontend React application
│   ├── components/               # React components by feature
│   │   ├── common/              # Shared UI components (Header, DatePicker, etc.)
│   │   ├── planning/            # Task planning and scheduling (Planner, WeekView)
│   │   ├── timer/               # Time tracking and session management
│   │   ├── ai/                  # AI assistant interface components
│   │   ├── settings/            # Application settings and preferences
│   │   ├── reports/             # Analytics and reporting components
│   │   ├── debug/               # Development and debugging tools
│   │   └── TitleBar.tsx         # Custom window title bar
│   ├── services/                # Business logic and external integrations
│   │   ├── database/            # Database layer with repositories
│   │   │   ├── repositories/    # Data access services (TaskService, etc.)
│   │   │   └── __mocks__/       # Mock implementations for testing
│   │   ├── ai/                  # AI service implementations
│   │   │   ├── AIServiceInterface.ts    # Common AI service interface
│   │   │   ├── LocalAIService.ts        # Local LLM integration
│   │   │   ├── GeminiAIService.ts       # Google Gemini integration
│   │   │   ├── ModelManager.ts          # AI model management
│   │   │   ├── ToolRegistry.ts          # AI tool management
│   │   │   ├── ToolExecutionEngine.ts   # Tool execution logic
│   │   │   ├── LoggingInterceptor.ts    # AI conversation logging
│   │   │   ├── LogRetentionManager.ts   # Log cleanup and retention
│   │   │   ├── FeedbackAnalysisService.ts # User feedback analysis
│   │   │   └── tools.ts                 # AI tool definitions
│   │   ├── notifications/       # System notifications
│   │   ├── security/            # Security and privacy utilities
│   │   ├── errorHandling/       # Error management services
│   │   └── startup/             # Application startup services
│   ├── contexts/                # React context providers
│   │   ├── AIContext.tsx        # AI assistant state management
│   │   ├── TaskListContext.tsx  # Task list state and operations
│   │   ├── TimerContext.tsx     # Timer and session management
│   │   ├── SettingsContext.tsx  # User preferences and settings
│   │   ├── NavigationContext.tsx # App navigation state
│   │   ├── PrivacyContext.tsx   # Privacy and data protection
│   │   ├── LoggingStatusContext.tsx # AI logging status tracking
│   │   └── ToastContext.tsx     # Toast notification management
│   ├── hooks/                   # Custom React hooks
│   │   ├── useDatabase.ts       # Database connection and operations
│   │   ├── useTaskWithPreferences.ts # Task management with user prefs
│   │   ├── useTimerWithPreferences.ts # Timer with user preferences
│   │   ├── useTranslation.ts    # Internationalization support
│   │   ├── usePrivacyAware.ts   # Privacy-aware data handling
│   │   ├── useProductivityInsights.ts # Productivity analytics
│   │   ├── useThreads.ts        # AI conversation threads
│   │   ├── useThreadMessages.ts # Thread message management
│   │   ├── useConfirmationDialog.ts # Confirmation dialogs
│   │   ├── useNotifications.ts  # System notifications
│   │   ├── useToast.ts          # Toast notifications
│   │   └── useUserPreferences.ts # User preference management
│   ├── types/                   # TypeScript type definitions
│   │   ├── index.ts             # Core interfaces and enums
│   │   ├── aiLogging.ts         # AI logging type definitions
│   │   ├── aiConfirmation.ts    # AI confirmation types
│   │   ├── emotionalIntelligence.ts # Emotional AI types
│   │   ├── taskMatching.ts      # Task matching types
│   │   ├── thread.ts            # Conversation thread types
│   │   ├── database.ts          # Database-related types
│   │   └── validation.ts        # Data validation schemas
│   ├── utils/                   # Pure utility functions
│   │   ├── dateFormat.ts        # Date formatting utilities
│   │   ├── taskSorting.ts       # Task organization logic
│   │   ├── migration.ts         # Database migration utilities
│   │   ├── translationUtils.ts  # i18n helper functions
│   │   ├── translationDevTools.ts # Translation development tools
│   │   ├── translationValidation.ts # Translation validation
│   │   ├── dataBackup.ts        # Data export/import utilities
│   │   ├── performanceMonitoring.ts # Performance tracking
│   │   ├── errorTracking.ts     # Error tracking utilities
│   │   ├── retryMechanism.ts    # Retry logic utilities
│   │   ├── circuitBreakerUtils.ts # Circuit breaker patterns
│   │   ├── debugCommands.ts     # Debug command utilities
│   │   └── version.ts           # Version management
│   ├── i18n/                    # Internationalization
│   │   ├── locales/             # Translation files
│   │   └── index.ts             # i18n configuration
│   ├── __tests__/               # Test configuration and utilities
│   │   ├── setup/               # Test environment setup
│   │   ├── mocks/               # Mock implementations
│   │   └── integration/         # Integration test suites
│   └── App.tsx                  # Main application component
├── src-tauri/                   # Rust backend (Tauri v2)
│   ├── src/
│   │   ├── commands/            # Tauri command handlers
│   │   ├── database/            # SeaORM database models and migrations
│   │   ├── services/            # Backend business logic
│   │   ├── bin/                 # Additional binaries (LLM chat, etc.)
│   │   ├── lib.rs               # Library entry point
│   │   └── main.rs              # Application entry point
│   ├── migrations/              # Database schema migrations
│   ├── Cargo.toml               # Rust dependencies and configuration
│   └── tauri.conf.json          # Tauri application configuration
├── docs/                        # Documentation (Docusaurus)
│   ├── docs/                    # Documentation content
│   │   ├── api/                 # API documentation
│   │   ├── developer/           # Developer guides
│   │   └── user-guide/          # User documentation
│   ├── src/                     # Docusaurus customization
│   └── package.json             # Documentation dependencies
├── scripts/                     # Build and development scripts
│   ├── generate-build-info.js   # Build metadata generation
│   ├── sync-version.js          # Version synchronization
│   └── build-cross-platform.js # Cross-platform build automation
├── .github/                     # GitHub Actions workflows
│   └── workflows/               # CI/CD pipeline definitions
├── package.json                 # Frontend dependencies and scripts
├── vite.config.ts               # Vite build configuration
├── tailwind.config.js           # Tailwind CSS configuration
├── tsconfig.json                # TypeScript configuration
└── README.md                    # Project overview and setup
```

## Architecture Patterns

### Component Organization

#### Feature-Based Structure

Components are organized by feature rather than by type, promoting better maintainability and code locality:

```
src/components/
├── common/          # Reusable UI components
│   ├── Header.tsx
│   ├── DatePicker.tsx
│   ├── TaskCard.tsx
│   └── LoadingSpinner.tsx
├── planning/        # Task planning features
│   ├── Planner.tsx
│   ├── WeekView.tsx
│   ├── TaskColumn.tsx
│   └── WeeklyPlan.tsx
├── timer/           # Time tracking features
│   ├── TimerDisplay.tsx
│   ├── SessionNotes.tsx
│   └── TimerControls.tsx
├── ai/              # AI assistant interface
│   ├── ChatInterface.tsx
│   ├── AIToolsPanel.tsx
│   └── ConversationHistory.tsx
└── settings/        # Configuration UI
    ├── PreferencesPanel.tsx
    ├── AISettings.tsx
    └── PrivacySettings.tsx
```

#### Component Patterns

- **Container Components**: Handle state and business logic
- **Presentational Components**: Focus on UI rendering
- **Custom Hooks**: Encapsulate reusable logic
- **Context Providers**: Manage global state

### Service Layer Architecture

#### Repository Pattern

All database operations go through service classes that act as repositories:

```
src/services/database/repositories/
├── TaskService.ts           # Task CRUD operations
├── TimeTrackingService.ts   # Timer and session management
├── TaskListService.ts       # Task list operations
├── FocusService.ts          # Focus session tracking
├── PatternService.ts        # Productivity pattern analysis
└── LogStorageService.ts     # AI conversation logging
```

#### AI Service Architecture

AI functionality is modularized with clear separation of concerns:

```
src/services/ai/
├── AIServiceInterface.ts    # Common AI service interface
├── LocalAIService.ts        # Local LLM integration
├── ReactAIService.ts        # Google Gemini integration
├── ToolRegistry.ts          # AI tool management
├── ToolExecutionEngine.ts   # Tool execution logic
├── LoggingInterceptor.ts    # Conversation logging
├── PrivacyFilter.ts         # Data privacy protection
└── tools.ts                 # AI tool definitions
```

### State Management

#### React Context Pattern

KiraPilot uses React Context for state management:

```typescript
// Context structure
TaskListContext; // Task and list management
TimerContext; // Time tracking state
SettingsContext; // User preferences
NavigationContext; // App navigation state
AIContext; // AI assistant state
PrivacyContext; // Privacy settings and data protection
```

### Data Flow

#### Unidirectional Data Flow

```
User Action → Context → Service → Tauri Command → SeaORM → SQLite
                ↓
            Component ← Context ← Service ← Tauri Response ← Database
```

## Key Files and Folders

### Frontend Core Files

#### `src/App.tsx`

Main application component that sets up routing, contexts, and global layout.

#### `src/main.tsx`

Application entry point with React 19 setup and context providers.

#### `src/types/index.ts`

Central type definitions including:

- Core interfaces (Task, TimerSession, etc.)
- Enums (Priority, TaskStatus, etc.)
- API request/response types
- User preferences and configuration types

### Context Providers

#### `src/contexts/TaskListContext.tsx`

Manages task list state, current selection, and task operations.

#### `src/contexts/TimerContext.tsx`

Handles timer state, session management, and time tracking.

#### `src/contexts/AIContext.tsx`

AI assistant state, conversation history, and tool execution.

#### `src/contexts/SettingsContext.tsx`

User preferences, theme settings, and application configuration.

### Service Layer

#### `src/services/database/repositories/TaskService.ts`

Primary task management service with CRUD operations, filtering, and sorting.

#### `src/services/ai/ToolRegistry.ts`

Manages AI tools that can interact with the application (create tasks, start timers, etc.).

#### `src/services/ai/LoggingInterceptor.ts`

Handles AI conversation logging with privacy controls and data retention.

### Utility Functions

#### `src/utils/translationUtils.ts`

Internationalization utilities for multi-language support.

#### `src/utils/dataBackup.ts`

Data export/import functionality for user data portability.

#### `src/utils/migration.ts`

Database migration utilities for schema updates.

### Backend Structure

#### `src-tauri/src/commands/`

Tauri command handlers that expose Rust functionality to the frontend.

#### `src-tauri/src/database/`

SeaORM models and database connection management.

#### `src-tauri/migrations/`

Database schema migrations for SQLite.

### Configuration Files

#### `vite.config.ts`

Vite build configuration with Tauri integration, TypeScript paths, and Tailwind CSS.

#### `tailwind.config.js`

Tailwind CSS configuration with HeroUI integration and custom theme.

#### `tsconfig.json`

TypeScript configuration with strict mode and modern ES features.

#### `package.json`

Frontend dependencies, scripts, and project metadata.

### Development Tools

#### `scripts/`

Build automation and development utilities:

- Cross-platform build scripts
- Version synchronization
- Build metadata generation

#### `.github/workflows/`

CI/CD pipeline definitions for automated testing and releases.

#### `docs/`

Docusaurus-based documentation site with API references and user guides.

## Import Patterns

### Recommended Import Order

```typescript
// External libraries first
import { useState, useEffect } from 'react';
import { Button, Card } from '@heroui/react';

// Internal imports by proximity
import { Task, TaskStatus, Priority } from '../types';
import { useDatabase } from '../hooks/useDatabase';
import { getTaskRepository } from '../services/database/repositories';
import { TaskCard } from './TaskCard';
```

### Path Aliases

The project uses TypeScript path mapping for cleaner imports:

```typescript
// Instead of: import { Task } from '../../../types'
import { Task } from '@/types';

// Instead of: import { useDatabase } from '../../hooks/useDatabase'
import { useDatabase } from '@/hooks/useDatabase';
```

## Testing Structure

### Test Organization

```
src/
├── __tests__/
│   ├── setup/           # Test configuration and global setup
│   ├── mocks/           # Mock implementations for services
│   └── integration/     # Integration test suites
└── components/
    └── __tests__/       # Component unit tests
```

### Mock Strategy

- **Database Mocks**: In-memory SQLite for tests
- **Service Mocks**: Predictable test data and responses
- **Component Mocks**: Isolated component testing
- **Tauri Mocks**: Mock Tauri commands for frontend testing

This structure provides clear separation of concerns, maintainable code organization, and excellent developer experience while supporting the application's growth and feature expansion.

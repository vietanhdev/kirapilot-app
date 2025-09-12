# Architecture Overview

Understand the technical architecture and design decisions behind KiraPilot.

## Technology Stack

### Core Technologies

- **Frontend**: React 19+ with TypeScript
- **Backend**: Tauri v2 (Rust)
- **Build Tool**: Vite 7+ with HMR
- **Database**: SQLite via Tauri SQL plugin
- **Styling**: Tailwind CSS 4+ with HeroUI components
- **Icons**: Lucide React
- **Animations**: Framer Motion
- **Rich Text**: Tiptap editor
- **Drag & Drop**: @dnd-kit
- **Validation**: Zod schemas

### Development Tools

- **Linting**: ESLint 9+ with TypeScript rules
- **Formatting**: Prettier with single quotes, 2-space tabs, don't use "any" as ts type
- **Testing**: Jest with ts-jest, React Testing Library
- **Git Hooks**: Husky with lint-staged
- **Type Checking**: TypeScript 5.8+ in strict mode

## Architecture Patterns

### Overall Architecture

KiraPilot follows a **layered architecture** with clear separation of concerns:

```
┌─────────────────────────────────────┐
│           Presentation Layer        │
│         (React Components)          │
├─────────────────────────────────────┤
│            Context Layer            │
│        (React Contexts)             │
├─────────────────────────────────────┤
│            Service Layer            │
│      (Business Logic)               │
├─────────────────────────────────────┤
│           Repository Layer          │
│        (Data Access)                │
├─────────────────────────────────────┤
│            Tauri Layer              │
│         (Rust Backend)              │
├─────────────────────────────────────┤
│           Database Layer            │
│           (SQLite)                  │
└─────────────────────────────────────┘
```

### Component Architecture

#### Feature-Based Organization

Components are organized by feature rather than by type:

```
src/components/
├── common/          # Shared UI components
├── planning/        # Task planning and scheduling
├── timer/           # Time tracking components
├── ai/              # AI assistant interface
├── settings/        # Application settings
└── reports/         # Analytics and reporting
```

#### Component Patterns

- **Container Components**: Handle state and business logic
- **Presentational Components**: Focus on UI rendering
- **Custom Hooks**: Encapsulate reusable logic
- **Context Providers**: Manage global state

### State Management

#### React Context Pattern

KiraPilot uses React Context for state management instead of external libraries:

```typescript
// Context structure
TaskListContext; // Task and list management
TimerContext; // Time tracking state
SettingsContext; // User preferences
NavigationContext; // App navigation state
AIContext; // AI assistant state
```

#### Benefits of Context Pattern

- **No external dependencies**: Reduces bundle size
- **Type safety**: Full TypeScript integration
- **React DevTools**: Built-in debugging support
- **Simplicity**: Easy to understand and maintain

### Data Flow Architecture

#### Unidirectional Data Flow

```
User Action → Context → Service → Tauri Command → SeaORM → SQLite
                ↓
            Component ← Context ← Service ← Tauri Response ← Database
```

#### Repository Pattern

All database operations go through repositories:

```typescript
interface TaskRepository {
  create(task: CreateTaskInput): Promise<Task>;
  findById(id: string): Promise<Task | null>;
  update(id: string, updates: UpdateTaskInput): Promise<Task>;
  delete(id: string): Promise<void>;
}
```

### Database Architecture

#### SQLite with SeaORM

- **Primary**: SQLite with SeaORM migrations system
- **Fallback**: Mock database for development/testing
- **Queries**: Direct SQL with type-safe interfaces via SeaORM
- **Transactions**: Proper concurrency handling with queue system

#### Entity Design

```
Tasks ←→ TaskLists
  ↓
TaskDependencies
  ↓
TimerSessions
  ↓
FocusSessions
  ↓
PeriodicTaskTemplates
  ↓
AIInteractionLogs
```

## Design Decisions

### Why Tauri?

1. **Native Performance**: Rust backend provides excellent performance
2. **Small Bundle Size**: Significantly smaller than Electron
3. **Security**: Sandboxed environment with explicit permissions
4. **Cross-Platform**: Single codebase for all desktop platforms
5. **Web Technologies**: Familiar React/TypeScript frontend

### Why SQLite?

1. **Privacy First**: Local data storage, no cloud dependency
2. **Performance**: Fast queries for productivity app use cases
3. **Reliability**: ACID compliance and crash recovery
4. **Simplicity**: No server setup or maintenance
5. **Portability**: Single file database

### Why React Context over Redux?

1. **Simplicity**: Less boilerplate code
2. **Bundle Size**: No external dependencies
3. **Type Safety**: Better TypeScript integration
4. **Learning Curve**: Easier for new contributors
5. **React Integration**: Built-in DevTools support

### Why Repository Pattern?

1. **Testability**: Easy to mock for unit tests
2. **Abstraction**: Database implementation can change
3. **Consistency**: Standardized data access patterns
4. **Type Safety**: Strongly typed interfaces
5. **Error Handling**: Centralized error management

## Security Architecture

### Data Protection

- **Local Storage**: All data stays on user's device
- **Encryption**: Sensitive data encrypted at rest
- **Sandboxing**: Tauri's security model prevents unauthorized access
- **Permissions**: Explicit permission system for system access

### Input Validation

- **Zod Schemas**: Runtime type validation
- **Sanitization**: XSS prevention in rich text
- **SQL Injection**: Parameterized queries only
- **File System**: Restricted file access through Tauri APIs

## Performance Architecture

### Frontend Optimization

- **Code Splitting**: Lazy loading of route components
- **Memoization**: React.memo and useMemo for expensive operations
- **Virtual Scrolling**: For large task lists
- **Debouncing**: Search and auto-save operations

### Backend Optimization

- **Connection Pooling**: SQLite connection management
- **Query Optimization**: Indexed queries and efficient joins
- **Caching**: In-memory caching for frequently accessed data
- **Background Tasks**: Non-blocking operations

### Build Optimization

- **Tree Shaking**: Remove unused code
- **Bundle Analysis**: Monitor bundle size
- **Asset Optimization**: Compress images and fonts
- **Hot Module Replacement**: Fast development iteration

## Testing Architecture

### Testing Strategy

```
Unit Tests (70%)     # Individual functions and components
Integration Tests (20%)  # Feature workflows
E2E Tests (10%)      # Critical user journeys
```

### Test Organization

```
src/
├── __tests__/
│   ├── setup/           # Test configuration
│   ├── mocks/           # Mock implementations
│   └── integration/     # Integration tests
└── components/
    └── __tests__/       # Component unit tests
```

### Mock Strategy

- **Database Mocks**: In-memory SQLite for tests
- **Service Mocks**: Predictable test data
- **Component Mocks**: Isolated component testing
- **API Mocks**: Tauri command mocking

## Deployment Architecture

### Build Process

1. **Frontend Build**: Vite builds React app
2. **Type Checking**: TypeScript compilation
3. **Linting**: ESLint validation
4. **Testing**: Jest test suite
5. **Tauri Build**: Rust compilation and bundling

### Distribution

- **GitHub Releases**: Automated release pipeline
- **Code Signing**: Platform-specific signing
- **Auto Updates**: Tauri's built-in updater
- **Platform Packages**: Native installers for each OS

## Scalability Considerations

### Performance Scaling

- **Database Indexing**: Optimized for large datasets
- **Pagination**: Efficient data loading
- **Background Processing**: Non-blocking operations
- **Memory Management**: Efficient React patterns

### Feature Scaling

- **Plugin Architecture**: Extensible AI tools
- **Theme System**: Customizable UI
- **Localization**: Multi-language support
- **Configuration**: User preferences system

## Future Architecture Plans

### Planned Improvements

1. **Plugin System**: Third-party integrations
2. **Cloud Sync**: Optional cloud backup
3. **Mobile Apps**: React Native companion
4. **Web Version**: Browser-based access
5. **API Layer**: External integrations

### Migration Strategy

- **Backward Compatibility**: Database migration system
- **Feature Flags**: Gradual feature rollout
- **A/B Testing**: User experience optimization
- **Monitoring**: Performance and error tracking

This architecture provides a solid foundation for KiraPilot's current needs while remaining flexible for future growth and improvements.

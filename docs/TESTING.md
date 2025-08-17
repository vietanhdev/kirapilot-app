# Testing Strategy

KiraPilot uses a multi-layered testing approach designed around the constraints of the Tauri + React architecture.

## Test Architecture

### Unit Tests ✅ Active

- **Location**: `src/**/__tests__/*.test.ts`
- **Framework**: Jest + ts-jest + React Testing Library
- **Coverage**: Utility functions, validation schemas, business logic, React components
- **Status**: Fully functional in Node.js environment

### Integration Tests ⚠️ Manual

- **Environment**: Tauri development environment
- **Method**: Built-in database test component
- **Coverage**: Database operations, Tauri-specific functionality
- **Limitation**: Tauri SQL plugin requires Tauri runtime, not available in Jest

## Running Tests

### Automated Testing

```bash
# Run all unit tests
npm test

# Watch mode for development
npm run test:watch

# Generate coverage report
npm run test:coverage

# Test specific patterns
npm test -- --testPathPattern=validation.test.ts
```

### Manual Integration Testing

```bash
# Start development environment
npm run tauri dev

# Use the DatabaseTest component in the application UI to test:
# - Database connectivity and migrations
# - Repository CRUD operations
# - Data integrity and constraints
```

## What to Test Where

### Jest Environment (Automated)

- ✅ **Validation Logic**: Zod schema validation and error handling
- ✅ **Utility Functions**: Pure functions with predictable I/O
- ✅ **Business Logic**: Data transformations and calculations
- ✅ **React Components**: UI behavior and user interactions
- ✅ **Hooks**: Custom React hooks with mock contexts

### Tauri Environment (Manual)

- ⚠️ **Database Operations**: SQL queries, transactions, migrations
- ⚠️ **File System**: Local data storage and backup operations
- ⚠️ **Native APIs**: Tauri-specific functionality
- ⚠️ **Cross-Component Integration**: End-to-end user workflows

## Testing Best Practices

### Repository Testing Strategy

Repository tests are **excluded** from Jest runs because the Tauri SQL plugin requires the Tauri runtime:

```typescript
// Jest config excludes repository tests
testPathIgnorePatterns: ['src/services/database/repositories/__tests__'];
```

Instead, use the built-in `DatabaseTest` component for integration testing in the actual Tauri environment.

### Mock Database for Development

A simplified mock database is available for basic repository logic testing:

- **File**: `src/services/database/__mocks__/mockDatabase.ts`
- **Purpose**: Allows repository instantiation in Jest environment
- **Limitations**: Simplified SQL parsing, no complex queries

### Recommended Workflow

1. **Unit Test First**: Write Jest tests for all business logic and validation
2. **Integration Test Second**: Use DatabaseTest component for database operations
3. **Manual Test Last**: Full application testing for user workflows

## Test Coverage Goals

- **95%+ Coverage**: Utility functions and validation logic
- **80%+ Coverage**: Business logic and data transformations
- **Manual Coverage**: Database operations and Tauri integration
- **E2E Coverage**: Critical user workflows through manual testing

## Future Improvements

- **Component Testing**: Expand React Testing Library usage for UI components
- **E2E Testing**: Consider Playwright for automated end-to-end testing
- **Performance Testing**: Automated benchmarks for database operations
- **Visual Regression**: Screenshot testing for UI consistency

This testing strategy balances automated testing where possible with manual testing where necessary, ensuring code quality within the constraints of the Tauri development environment.

# Testing Strategy for KiraPilot

## Overview

KiraPilot uses a multi-layered testing approach to ensure code quality and reliability.

## Test Categories

### 1. Unit Tests ✅ Working
- **Location**: `src/**/__tests__/*.test.ts`
- **Framework**: Jest + ts-jest
- **Coverage**: Utility functions, validation schemas, business logic
- **Status**: Fully functional

#### Examples:
- `src/utils/__tests__/validation.test.ts` - Zod schema validation tests
- Type validation and error handling
- Data transformation utilities

### 2. Repository Tests ⚠️ Excluded from Jest Environment
- **Location**: `src/services/database/repositories/__tests__/*.test.ts`
- **Framework**: Designed for Tauri runtime testing
- **Limitation**: Tauri SQL plugin only works in Tauri runtime, not Node.js/Jest
- **Status**: Excluded from Jest runs, should be tested in Tauri environment

#### Current Approach:
- Repository tests are excluded from Jest runs (`testPathIgnorePatterns`)
- Integration tests should be run in Tauri environment using the DatabaseTest component
- Focus on business logic validation in Jest, database operations in Tauri

### 3. Integration Tests (Recommended)
- **Environment**: Tauri development environment
- **Method**: Manual testing through the application UI
- **Coverage**: Database operations, cross-component interactions
- **Tools**: Database test component in the application

## Running Tests

### Unit Tests (Validation, Utils)
```bash
# Run all working tests
npm test -- --testPathPattern=validation.test.ts

# Run with coverage
npm run test:coverage -- --testPathPattern=validation.test.ts

# Watch mode
npm run test:watch -- --testPathPattern=validation.test.ts
```

### Repository Tests (Excluded from Jest)
```bash
# Repository tests are excluded from Jest runs
# They should be tested in the Tauri environment using:

# Start the application
npm run tauri dev

# Use the DatabaseTest component in the UI for repository testing
```

### Integration Tests (Manual)
```bash
# Start the application
npm run tauri dev

# Use the Database Test component in the UI to test:
# - Database connectivity
# - CRUD operations
# - Migration system
# - Data integrity
```

## Test Database

### Mock Database for Jest
- **File**: `src/services/database/__mocks__/mockDatabase.ts`
- **Purpose**: Allows basic repository tests to run in Jest environment
- **Limitations**: Simplified SQL parsing, no complex queries, no foreign keys

### Real Database for Integration
- **Environment**: Tauri runtime
- **Database**: SQLite with full Tauri SQL plugin functionality
- **Testing**: Use the DatabaseTest component in the application

## Testing Best Practices

### What Works Well ✅
1. **Validation Tests**: Comprehensive Zod schema validation
2. **Utility Functions**: Pure functions with predictable inputs/outputs
3. **Business Logic**: Type transformations and calculations
4. **Error Handling**: Validation error scenarios

### What Needs Manual Testing ⚠️
1. **Database Operations**: CRUD operations, transactions, migrations
2. **Tauri Integration**: File system access, native APIs
3. **Cross-Component Integration**: Repository + UI interactions
4. **Performance**: Query optimization, large datasets

### Recommended Testing Workflow

1. **Development Phase**:
   - Write unit tests for new utility functions
   - Test validation schemas thoroughly
   - Use mock database for basic repository logic

2. **Integration Phase**:
   - Test database operations manually in Tauri environment
   - Use DatabaseTest component for CRUD validation
   - Verify migrations and data integrity

3. **Quality Assurance**:
   - Run full application testing
   - Test cross-platform compatibility
   - Performance testing with realistic data

## Future Improvements

### Potential Enhancements
1. **E2E Testing**: Playwright or similar for full application testing
2. **Database Testing**: More sophisticated mock or test database
3. **Component Testing**: React Testing Library for UI components
4. **Performance Testing**: Automated performance benchmarks

### Current Limitations
1. **Tauri Dependencies**: Cannot fully test Tauri-specific code in Jest
2. **Database Complexity**: Mock database is simplified
3. **Integration Coverage**: Limited automated integration testing

## Conclusion

The current testing strategy focuses on what can be reliably tested in a Node.js environment (validation, utilities, business logic) while acknowledging the limitations of testing Tauri-specific functionality. 

For comprehensive testing, developers should:
1. Run unit tests regularly during development
2. Use the built-in database testing tools for integration testing
3. Perform manual testing in the Tauri environment for full functionality validation

This approach ensures code quality while working within the constraints of the Tauri + Jest testing environment.
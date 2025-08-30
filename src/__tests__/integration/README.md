# AI Backend Integration Tests

This directory contains comprehensive integration tests for the AI architecture refactor. These tests validate end-to-end workflows, provider switching, tool execution, and performance characteristics.

## Test Files

### `ai-backend-integration.test.ts`

Comprehensive integration tests covering the complete AI workflow from frontend to backend.

**Test Coverage:**

- **End-to-End AI Workflow**: Tests complete conversation flows with session management
- **Tool Execution**: Validates multi-step tool execution with ReAct reasoning
- **Provider Switching**: Tests manual and automatic provider switching scenarios
- **Provider Health Monitoring**: Validates health tracking and failover mechanisms
- **Error Handling**: Tests various error scenarios and recovery mechanisms
- **Logging and Interaction Tracking**: Validates comprehensive logging of all AI interactions
- **Configuration Management**: Tests logging and provider preference updates

**Key Test Scenarios:**

1. Complete AI conversation workflow with session continuity
2. Multi-step tool execution with ReAct reasoning steps
3. Manual provider switching between Gemini and local models
4. Automatic failover when providers become unavailable
5. Provider health tracking with success/failure metrics
6. Comprehensive error handling with proper error codes
7. Interaction logging with complete metadata capture
8. Configuration updates for logging and provider preferences

### `ai-performance-load.test.ts`

Performance and load testing scenarios to validate system behavior under various conditions.

**Test Coverage:**

- **Response Time Performance**: Validates acceptable response times under normal load
- **Concurrent Request Handling**: Tests high concurrency without performance degradation
- **Memory and Resource Usage**: Validates stable memory usage during extended operations
- **Throughput and Scalability**: Tests system throughput under increasing load
- **Error Rate and Reliability**: Validates low error rates and graceful recovery

**Key Test Scenarios:**

1. Response time consistency across multiple sequential requests
2. Handling of varying message lengths efficiently
3. High concurrency (20+ concurrent requests) without degradation
4. Session isolation under concurrent load across multiple sessions
5. Stable memory usage during extended operations (20+ requests)
6. Resource cleanup after failed requests
7. Throughput maintenance under increasing load levels
8. Low error rate maintenance (10% or less) under normal conditions

## Test Architecture

### Mock Strategy

- **Tauri API Mocking**: All tests mock the Tauri `invoke` function to simulate backend responses
- **Isolated Test Execution**: Each test uses its own mock instance to prevent interference
- **Realistic Response Simulation**: Mock responses include realistic timing, metadata, and error scenarios

### Test Data Patterns

- **Session Management**: Tests use consistent session IDs to validate conversation continuity
- **Performance Metrics**: Mock responses include realistic performance timing data
- **Error Scenarios**: Comprehensive error types with proper error codes and details
- **Provider Health**: Simulated health metrics for provider monitoring tests

### Validation Approach

- **Response Structure**: Validates complete response structure including metadata
- **Timing Constraints**: Ensures performance requirements are met
- **Error Handling**: Verifies proper error propagation and recovery
- **State Management**: Validates session and provider state consistency

## Integration Points Tested

### Frontend-Backend Communication

- Tauri command invocation (`process_ai_message`, `get_ai_model_status`, etc.)
- Request/response serialization and validation
- Error propagation from backend to frontend
- Real-time status updates and health monitoring

### AI Service Manager

- Message processing with provider selection
- Session management and conversation continuity
- Provider switching and failover logic
- Performance metrics collection and reporting

### Provider Management

- Health monitoring and status tracking
- Automatic failover between providers
- Provider preference management
- Performance-based provider selection

### Logging and Analytics

- Comprehensive interaction logging
- ReAct step tracking and analysis
- Performance metrics collection
- Log retention and cleanup operations

### Tool Execution

- Multi-step tool execution workflows
- Parameter inference and validation
- Tool result integration into responses
- Error handling during tool execution

## Performance Benchmarks

### Response Time Targets

- **Normal Load**: < 100ms average response time for mocked operations
- **High Concurrency**: < 5 seconds for 20+ concurrent requests
- **Memory Stability**: < 20% memory growth over extended operations
- **Throughput**: > 5 requests per second under load

### Error Rate Targets

- **Normal Operations**: < 10% error rate under simulated conditions
- **Recovery Time**: Immediate recovery after provider restoration
- **Failover Speed**: < 3 seconds for automatic provider switching

## Running the Tests

### Individual Test Suites

```bash
# Run AI backend integration tests
npm test -- --testPathPattern="ai-backend-integration"

# Run performance and load tests
npm test -- --testPathPattern="ai-performance-load"

# Run both integration test suites
npm test -- --testPathPattern="ai-backend-integration|ai-performance-load"
```

### Test Configuration

- Tests use Jest with TypeScript support
- Tauri APIs are mocked globally for all tests
- Each test suite has isolated mock state
- Tests include realistic timing and performance simulation

## Test Maintenance

### Adding New Tests

1. Follow the existing mock pattern for Tauri API calls
2. Use realistic response structures matching backend interfaces
3. Include proper error scenarios and edge cases
4. Validate both success and failure paths

### Mock Data Updates

- Update mock responses when backend interfaces change
- Maintain realistic performance timing in mock data
- Include comprehensive metadata in mock responses
- Test both success and error scenarios

### Performance Baselines

- Update performance expectations as system improves
- Monitor test execution time for regression detection
- Adjust concurrency levels based on system capabilities
- Validate memory usage patterns remain stable

## Integration with CI/CD

These integration tests are designed to run in CI/CD pipelines to validate:

- AI architecture changes don't break existing workflows
- Performance regressions are detected early
- Provider switching logic remains robust
- Error handling continues to work correctly

The tests use mocked Tauri APIs so they can run without requiring actual AI providers or backend services, making them suitable for automated testing environments.

# Local AI Tool Usage Tests

This directory contains integration tests for AI tool usage with local models in KiraPilot.

## Overview

The tests are designed to verify that the AI system can properly:

1. Initialize and use local AI models (with fallback to mock providers)
2. Handle tool selection and execution
3. Process complex reasoning workflows using the ReAct pattern
4. Manage conversation context and continuity
5. Handle errors gracefully
6. Perform efficiently under various conditions

## Test Files

### `local_ai_integration.rs`

Comprehensive integration tests for local AI functionality including:

- **Provider Initialization**: Tests creating and initializing local AI providers
- **Mock Provider Functionality**: Tests with a mock provider that simulates realistic model responses
- **Tool Registry Integration**: Tests the smart tool registry with various permission levels
- **ReAct Engine Integration**: Tests the reasoning and acting pattern with local AI
- **Context Awareness**: Tests AI responses with different user contexts
- **Generation Options**: Tests various text generation parameters
- **Error Handling**: Tests graceful handling of provider failures
- **Conversation Flow**: Tests maintaining context across multiple interactions
- **Performance Characteristics**: Tests response times and throughput

## Running the Tests

To run all local AI integration tests:

```bash
cargo test --manifest-path src-tauri/Cargo.toml --test local_ai_integration
```

To run a specific test:

```bash
cargo test --manifest-path src-tauri/Cargo.toml --test local_ai_integration test_local_ai_provider_initialization
```

To run with output:

```bash
cargo test --manifest-path src-tauri/Cargo.toml --test local_ai_integration -- --nocapture
```

## Test Architecture

### Mock Provider Strategy

The tests use a `MockLocalProvider` that:

- Simulates realistic AI model responses
- Provides contextual responses based on prompt content
- Supports various generation options
- Can simulate failure conditions for error testing

### Fallback Strategy

The tests are designed to work in environments where:

- Real local models may not be available (CI/CD, development machines without models)
- System dependencies might be missing
- Hardware requirements aren't met

### Test Coverage

The tests cover:

- ✅ Basic provider initialization and configuration
- ✅ Text generation with various prompts and options
- ✅ Tool registry creation and management
- ✅ ReAct reasoning engine workflows
- ✅ Context-aware response generation
- ✅ Error handling and recovery
- ✅ Performance characteristics
- ✅ Conversation continuity

## Key Features Tested

### 1. Local Model Integration

- Provider initialization with fallback to mock
- Model information retrieval
- Status checking and readiness verification

### 2. Tool Usage Simulation

- Smart tool registry functionality
- Permission-based tool access
- Tool suggestion algorithms

### 3. ReAct Pattern Implementation

- Multi-step reasoning workflows
- Thought-Action-Observation cycles
- Final answer generation
- Debug information extraction

### 4. Context Management

- User preference handling
- Conversation history maintenance
- Active task and session tracking
- Metadata propagation

### 5. Error Resilience

- Provider failure handling
- Graceful degradation
- Appropriate error messages
- Recovery mechanisms

## Performance Expectations

The tests verify that:

- Individual text generations complete within reasonable time (< 1s for mock, < 30s for real models)
- Multiple generations can be processed efficiently
- Memory usage remains stable across multiple operations
- Response quality meets minimum standards

## Future Enhancements

Potential areas for test expansion:

- Integration with actual tool implementations
- Real local model testing (when available)
- Stress testing with high concurrency
- Memory usage profiling
- Integration with database operations
- End-to-end workflow testing

## Notes

- Tests use mock providers by default to ensure reliability in CI/CD environments
- Real local model testing requires appropriate hardware and model files
- Performance benchmarks are calibrated for mock providers and may differ with real models
- Error conditions are simulated to ensure robust error handling

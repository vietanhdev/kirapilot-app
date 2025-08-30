# AI Logging Guide

This document explains how to monitor and debug AI interactions in KiraPilot.

## Overview

Comprehensive logging has been added to track all AI model interactions, including:

- **Prompts sent to models** (both local and Gemini)
- **Responses received from models**
- **Processing times and performance metrics**
- **Error handling and fallback mechanisms**
- **Tool executions and results**

## Log Locations

### Frontend (Browser Console)

All frontend AI interactions are logged to the browser console with distinctive emojis:

- 🤖 **LocalAI Service** - Local model interactions
- 🌟 **Gemini Service** - Google Gemini API interactions
- 🎯 **ModelManager** - Service coordination and fallbacks
- 🔄 **Fallback Operations** - When switching between services

### Backend (Rust Logs)

Backend AI operations are logged via Rust's `log` crate:

- 🧠 **Local AI Generation** - Direct model generation calls
- 🤖 **AI Request Processing** - High-level request handling

## Log Levels

You can control logging verbosity:

### Browser Console

Set log level in localStorage:

```javascript
// In browser console
localStorage.setItem('ai-log-level', 'DEBUG'); // Show all logs
localStorage.setItem('ai-log-level', 'INFO'); // Default level
localStorage.setItem('ai-log-level', 'WARN'); // Only warnings and errors
localStorage.setItem('ai-log-level', 'ERROR'); // Only errors
localStorage.setItem('ai-log-level', 'OFF'); // No logs
```

### Environment Variable

Set in your `.env` file:

```bash
VITE_LOG_LEVEL=DEBUG
```

## What Gets Logged

### Request Logging

```
🤖 [LocalAI] Processing message: {
  messageLength: 45,
  message: "Create a task called 'Review project'...",
  hasCurrentTask: true,
  hasActiveSession: false,
  focusMode: false,
  recentActivityCount: 3,
  timestamp: "2025-08-29T16:10:00.000Z"
}
```

### Response Logging

```
✅ [LocalAI] Final response constructed: {
  messageLength: 156,
  message: "I'll create that task for you. The task...",
  actionsCount: 1,
  suggestionsCount: 2,
  toolExecutions: 1,
  duration: 2340,
  timestamp: "2025-08-29T16:10:02.340Z"
}
```

### Error Logging

```
❌ [Gemini] Processing failed: {
  error: "API key not valid",
  duration: 1200,
  messageLength: 45,
  timestamp: "2025-08-29T16:10:01.200Z"
}
```

### Fallback Logging

```
🔄 [ModelManager] Fallback: {
  from: "local",
  to: "gemini",
  reason: "Model not initialized",
  timestamp: "2025-08-29T16:10:01.500Z"
}
```

## Rust Backend Logs

### Enable Rust Logging

Set the `RUST_LOG` environment variable:

```bash
# Show all AI-related logs
RUST_LOG=info

# Show debug logs (very verbose)
RUST_LOG=debug

# Show only warnings and errors
RUST_LOG=warn
```

### Backend Log Examples

```
INFO [kirapilot_app] 🤖 AI Request - Session: abc123, Message length: 45 chars
DEBUG [kirapilot_app] 🤖 AI Request - Full message: Create a task called 'Review project'
INFO [kirapilot_app] 🧠 Local AI Generation - Prompt length: 234 chars, max_tokens: Some(150), temperature: Some(0.7)
INFO [kirapilot_app] ✅ Local AI Generation successful - Response length: 89 chars, Duration: 2.34s
```

## Debugging Tips

### 1. Check Service Initialization

Look for these logs to ensure services start correctly:

```
🎯 [ModelManager] Processing with service: { modelType: "local", ... }
```

### 2. Monitor Performance

Track response times in the logs:

```
✅ [LocalAI] Raw response received: { duration: 2340, ... }
```

### 3. Identify Fallback Triggers

Watch for fallback operations:

```
🔄 [ModelManager] Attempting fallback due to error: { originalService: "local", error: "..." }
```

### 4. Tool Execution Tracking

Monitor tool calls and results:

```
✅ [Gemini] Final response constructed: { toolExecutions: 2, actionsCount: 2, ... }
```

## Privacy and Security

- **Prompts are truncated** in logs (first 200-500 chars only)
- **Responses are truncated** in logs (first 300-500 chars only)
- **Sensitive context data is sanitized** before logging
- **API keys are never logged**
- **Full messages are only shown in DEBUG level**

## Troubleshooting Common Issues

### No AI Response

1. Check for initialization errors in logs
2. Verify API keys (Gemini) or model files (Local)
3. Look for fallback attempts

### Slow Responses

1. Monitor duration metrics in logs
2. Check if local model is downloading
3. Verify system resources

### Unexpected Fallbacks

1. Check original service error messages
2. Verify service health status
3. Monitor initialization logs

## Production Considerations

- Set log level to `WARN` or `ERROR` in production
- Monitor log volume to avoid performance impact
- Consider log rotation for backend logs
- Use structured logging for better analysis

## Example: Full Interaction Log Flow

```
🎯 [ModelManager] Processing with service: { modelType: "local", messageLength: 45 }
🤖 [LocalAI] Processing message: { messageLength: 45, message: "Create a task...", hasCurrentTask: true }
🧠 [LocalAI] Formatted prompt: { promptLength: 234, prompt: "You are KiraPilot..." }
🔧 [LocalAI] Generation options: { maxTokens: 150, temperature: 0.7 }
✅ [LocalAI] Raw response received: { responseLength: 89, duration: 2340 }
✅ [LocalAI] Final response constructed: { messageLength: 156, actionsCount: 1, toolExecutions: 1 }
✅ [ModelManager] Service completed successfully: { modelType: "local", responseLength: 156, actionsCount: 1 }
```

This comprehensive logging system helps you understand exactly what's happening with AI interactions and quickly identify any issues.

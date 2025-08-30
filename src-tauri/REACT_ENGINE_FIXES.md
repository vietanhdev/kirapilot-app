# ReAct Engine Fixes for "Today" Task Filtering

## Problem

The AI was not calling the `get_tasks` tool when users asked "list tasks for today". Instead, it was providing generic responses without actually retrieving the user's tasks.

## Root Cause

The ReAct engine's initial prompt was not clear enough about when and how to use tools, and the action parsing was not robust enough to handle different formats.

## Changes Made

### 1. Improved Initial Prompt (`src-tauri/src/ai/react_engine.rs`)

**Before:**

- Vague instructions about using tools
- Unclear format requirements
- No specific examples for task-related requests

**After:**

- Clear ReAct pattern: Thought -> Action -> Observation -> Answer
- Explicit requirement to ALWAYS use tools for task/timer/productivity requests
- Specific examples showing exact format: `Action: tool_name: {json_args}`
- Clear instruction that "list tasks" or "tasks for today" MUST use get_tasks tool

### 2. Enhanced Action Parsing (`src-tauri/src/ai/react_engine.rs`)

**Before:**

- Only handled `Action: tool_name: args` format
- Limited error handling for malformed JSON

**After:**

- Handles multiple formats:
  - `Action: tool_name: args`
  - `Action: tool_name with args: args`
  - `Action: tool_name` (no args)
- Better JSON parsing with fallback to string arguments
- More robust parsing logic

### 3. Made parse_action_line Public

- Changed `fn parse_action_line` to `pub fn parse_action_line` for testing

## Testing

### Created comprehensive tests (`src-tauri/tests/test_react_get_tasks.rs`):

1. **test_react_engine_calls_get_tasks_tool**: Verifies that the ReAct engine correctly calls the get_tasks tool when asked "list tasks for today"
2. **test_react_engine_with_different_requests**: Tests various ways users might ask for tasks

### Existing tests still pass:

- `test_today_task_filtering.rs`: Confirms the GetTasksTool logic works correctly
- All other existing tests continue to pass

## Expected Behavior Now

When a user says:

- "list tasks for today"
- "show me my tasks"
- "what tasks do I have today"
- "tasks for today"

The AI should:

1. **Think**: "The user wants to see their tasks for today. I need to use the get_tasks tool."
2. **Act**: `Action: get_tasks: {}`
3. **Observe**: Tool returns task data
4. **Answer**: Provide a clean, formatted list of tasks

## Verification

Run these commands to verify the fixes:

```bash
# Test the ReAct engine with get_tasks tool
cargo test --test test_react_get_tasks

# Test the today filtering logic
cargo test --test test_today_task_filtering

# Build to ensure no compilation errors
cargo build
```

## Key Improvements

1. **Clearer Instructions**: The AI now has explicit instructions about when to use tools
2. **Better Examples**: Concrete examples show the exact format required
3. **Robust Parsing**: Multiple action formats are supported
4. **Comprehensive Testing**: Tests verify the complete flow works correctly

The AI should now consistently call the get_tasks tool when users ask about their tasks, instead of providing generic responses.

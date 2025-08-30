# Removed Rule-Based Tool Selection

## Problem

The ReAct engine had rule-based logic that was interfering with the LLM's natural ability to decide when to use tools. This was causing issues where the system would make assumptions about when tools were needed instead of letting the LLM decide.

## Changes Made

### 1. Simplified Initial Prompt (`src-tauri/src/ai/react_engine.rs`)

**Before:**

- Rule-based logic to determine if tools were needed based on keywords
- Different prompts for "tool-requiring" vs "non-tool" requests
- Forced tool usage for certain keywords

**After:**

- Single, clean prompt that presents available tools
- Clear instructions on how to use tools (`Action: [tool_name]: [args]`)
- Clear instructions on how to provide final answers (`Answer: [response]`)
- Let the LLM decide when tools are appropriate

### 2. Removed Rule-Based Inference from Action Parsing

**Before:**

- If no explicit "Action:" found, would infer tool usage from content
- Rule-based patterns like "contains('list') && contains('task')" → get_tasks
- Automatic tool selection based on keywords

**After:**

- Only parses explicit "Action:" lines
- No rule-based inference whatsoever
- LLM must explicitly use the correct format to trigger tools

### 3. Updated Tests to Reflect New Behavior

**Before:**

- Tests expected rule-based inference to work
- Mock models could trigger tools without explicit format

**After:**

- Tests verify that only explicit "Action:" format works
- Mock models demonstrate proper tool usage format
- Tests confirm no rule-based inference occurs

## Key Benefits

### 1. **LLM Autonomy**

- The LLM now has full control over when to use tools
- No system interference with the model's decision-making
- More natural conversation flow

### 2. **Cleaner Architecture**

- Removed complex rule-based logic
- Simpler, more maintainable code
- Clear separation of concerns

### 3. **Better Model Training Compatibility**

- Works with any model that can learn the Action: format
- No dependency on specific keywords or patterns
- More robust across different model types

### 4. **Predictable Behavior**

- Tools are only called when explicitly requested by the LLM
- No unexpected tool executions
- Easier to debug and understand

## Expected Behavior Now

### When User Says: "list tasks for today"

**Well-trained model should respond:**

```
Action: get_tasks: {}
```

**After tool execution, model should respond:**

```
Answer: Here are your tasks for today:
• Task 1: Complete project
• Task 2: Review code
• Task 3: Team meeting
```

### When User Says: "How are you?"

**Model should respond:**

```
Answer: I'm doing well! I'm here to help you manage your tasks. What would you like to do?
```

## Files Modified

- `src-tauri/src/ai/react_engine.rs` - Removed rule-based logic
- `src-tauri/tests/test_local_model_integration.rs` - Updated tests

## What Remains

The `GetTasksTool` still has parameter inference logic (like interpreting "today", "urgent", etc.), which is appropriate because:

1. It's called AFTER the LLM decides to use the tool
2. It helps interpret natural language parameters
3. It's part of the tool's functionality, not the decision to use the tool

## Testing

Run the tests to verify the new behavior:

```bash
cargo test --test test_local_model_integration
```

All tests should pass, demonstrating that:

- Only explicit "Action:" format triggers tools
- No rule-based inference occurs
- Models must be properly trained to use the correct format

## Impact on New Gemma Model

The new 3B parameter Gemma model should be much better at:

- Learning the explicit Action: format
- Deciding when tools are appropriate
- Following the ReAct pattern correctly

This change, combined with the new model, should resolve the issue where the AI was providing generic responses instead of actually calling tools when needed.

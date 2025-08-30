# Fix for AI Model Switching Error

## Problem

Users were getting this error when trying to switch AI models:

```
Failed to switch to undefined: Failed to switch to undefined model: invalid args `providerName` for command `switch_ai_model`: command switch_ai_model missing required key providerName
```

## Root Cause

**Parameter name mismatch** between frontend and backend:

- **Frontend (TypeScript)**: Was using `providerName` as the parameter name
- **Backend (Rust)**: Expected `provider_name` as the parameter name

## The Issue

In `src/services/ai/BackendAIService.ts`, line 212:

```typescript
// ❌ BEFORE (incorrect parameter name)
await invoke('switch_ai_model', { providerName: modelType });
```

The Rust function signature in `src-tauri/src/lib.rs`:

```rust
#[tauri::command]
async fn switch_ai_model(provider_name: String) -> Result<String, serde_json::Value>
```

Tauri expects the JavaScript parameter names to match the Rust parameter names (with automatic camelCase to snake_case conversion), but `providerName` doesn't convert to `provider_name`.

## Solution

Fixed the frontend parameter name to match the backend:

```typescript
// ✅ AFTER (correct parameter name)
await invoke('switch_ai_model', { provider_name: modelType });
```

## File Changed

- `src/services/ai/BackendAIService.ts` - Line 212

## Verification

1. ✅ **Build Success**: The Rust backend compiles without errors
2. ✅ **Parameter Match**: Frontend now uses `provider_name` to match Rust function parameter
3. ✅ **Type Safety**: The parameter name aligns with Tauri's expectations

## Expected Behavior After Fix

Users should now be able to switch AI models successfully:

- Switch to Gemini: `modelType = "gemini"`
- Switch to Local: `modelType = "local"`

The command will:

1. Validate the provider name (must be "gemini" or "local")
2. Switch the AI service to use the specified provider
3. Return a success message
4. Clear the current session when switching models

## Error Handling

The backend properly handles various error cases:

- Empty provider name → "Provider name cannot be empty"
- Invalid provider → "Invalid provider 'xyz'. Valid options: gemini, local"
- Service unavailable → "AI service unavailable: [error details]"
- Switch failure → Returns the specific error from the AI service

## Testing

To test the fix:

1. Try switching to Gemini model
2. Try switching to Local model
3. Verify error handling with invalid provider names
4. Confirm session is cleared after successful switch

## Related Commands

Other AI service commands that work correctly:

- `process_ai_message` - Process AI messages
- `get_ai_model_status` - Get current model status
- `get_ai_model_info` - Get current model information
- `clear_ai_conversation` - Clear conversation history

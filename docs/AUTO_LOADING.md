# Auto-Loading Local LLM Feature

## Overview

The auto-loading feature automatically initializes the local LLM when a user switches from Gemini to local in the settings, providing a seamless user experience without blocking the UI.

## How It Works

### 1. Background Initialization

When a user switches to the local model in settings:

1. **Immediate Response**: The UI updates immediately to show the local model is selected
2. **Background Loading**: The local model starts initializing in the background
3. **Status Updates**: The UI shows loading progress and status updates
4. **Completion**: Once loaded, the model is ready for use

### 2. Preloading Strategy

The system uses intelligent preloading to improve switching performance:

- **Predictive Loading**: When switching to one model, the other model starts preloading in the background
- **Smart Caching**: Already initialized models are kept in memory for instant switching
- **Resource Management**: Background operations are managed to avoid system overload

### 3. User Experience Flow

```
User clicks "Local" in settings
         ↓
UI immediately shows "Local" selected
         ↓
Background: Local model starts downloading/initializing
         ↓
UI shows: "Local model is initializing..."
         ↓
Background: Model download progress (if needed)
         ↓
Background: Model initialization
         ↓
UI updates: "Local model ready"
         ↓
User can now chat with local model
```

## Implementation Details

### ModelManager Enhancements

- **`autoLoadLocalModel()`**: Starts background initialization when switching to local
- **`startBackgroundPreloading()`**: Manages background service initialization
- **`preloadService()`**: Handles the actual preloading logic
- **`isPreloading()`**: Checks if a service is currently being preloaded

### LocalAIService Improvements

- **Progress Tracking**: Reports download and initialization progress
- **Status Management**: Provides detailed status information during loading
- **Error Handling**: Graceful handling of initialization failures

### AIContext Integration

- **Auto-loading Trigger**: Detects preference changes and triggers auto-loading
- **Status Monitoring**: Periodic checks for auto-loading completion
- **Seamless Updates**: Updates UI state when auto-loading completes

## Configuration

### Settings Integration

The feature integrates with the existing settings system:

```typescript
// In ModelSelectionCard.tsx
const handleModelTypeChange = async (modelType: 'local' | 'gemini') => {
  if (modelType === 'local') {
    // Start auto-loading immediately (non-blocking)
    modelManager.autoLoadLocalModel({
      type: 'local',
      options: preferences.aiSettings.localModelConfig,
    });
  }
  // ... rest of the switching logic
};
```

### User Preferences

The system respects user preferences for:

- Model selection
- Local model configuration (threads, context size, etc.)
- Download preferences

## Error Handling

### Graceful Degradation

- **Download Failures**: Falls back to on-demand loading
- **Initialization Errors**: Provides clear error messages
- **Network Issues**: Handles offline scenarios gracefully

### User Feedback

- **Progress Indicators**: Shows download and initialization progress
- **Status Messages**: Clear communication about current state
- **Error Messages**: Helpful error descriptions and recovery suggestions

## Performance Benefits

### Reduced Wait Times

- **Background Loading**: Users don't wait for model initialization
- **Preloading**: Switching between models is nearly instantaneous
- **Smart Caching**: Avoids redundant downloads and initializations

### Resource Optimization

- **Memory Management**: Efficient use of system resources
- **Download Optimization**: Resume interrupted downloads
- **CPU Throttling**: Background operations don't block the UI

## Testing

The feature includes comprehensive tests covering:

- Auto-loading functionality
- Background preloading
- Status reporting
- Error handling
- Performance scenarios

Run tests with:

```bash
npm test -- AutoLoading.test.ts
```

## Future Enhancements

### Planned Improvements

1. **Predictive Preloading**: Learn user patterns to preload likely-to-be-used models
2. **Progressive Loading**: Load model components incrementally for faster initial response
3. **Resource Monitoring**: Dynamic adjustment based on system resources
4. **User Preferences**: Allow users to control auto-loading behavior

### Configuration Options

Future versions may include settings for:

- Auto-loading enable/disable
- Preloading aggressiveness
- Resource usage limits
- Download scheduling

## Troubleshooting

### Common Issues

1. **Slow Auto-loading**: Check system resources and network connection
2. **Failed Initialization**: Verify model files and system compatibility
3. **Memory Issues**: Adjust model configuration or system resources

### Debug Information

Enable debug logging to troubleshoot issues:

```typescript
// In browser console
localStorage.setItem('debug', 'kirapilot:ai:*');
```

## API Reference

### ModelManager Methods

```typescript
// Start auto-loading local model
await modelManager.autoLoadLocalModel(config?: ModelConfig): Promise<void>

// Check preloading status
modelManager.isPreloading(type: ModelType): boolean

// Get all preloading statuses
modelManager.getPreloadingStatus(): Record<ModelType, boolean>

// Manually preload a service
await modelManager.preloadServiceManually(type: ModelType, config?: ModelConfig): Promise<void>
```

### Status Monitoring

```typescript
// Get current model status (includes loading state)
const status = modelManager.getModelStatus();

// Check if auto-loading is complete
if (status.isReady && !status.isLoading) {
  // Model is ready for use
}
```

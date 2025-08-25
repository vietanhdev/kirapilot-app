import {
  AIServiceInterface,
  ModelInfo,
  ModelStatus,
  AIServiceError,
  ModelNotAvailableError,
  ModelInitializationError,
  ModelProcessingError,
} from '../AIServiceInterface';
import { AppContext } from '../../../types';

describe('AIServiceInterface', () => {
  describe('Error classes', () => {
    it('should create AIServiceError with correct properties', () => {
      const error = new AIServiceError('Test error', 'TEST_CODE', false);

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.recoverable).toBe(false);
      expect(error.name).toBe('AIServiceError');
    });

    it('should create ModelNotAvailableError', () => {
      const error = new ModelNotAvailableError('local');

      expect(error.message).toBe('Model local is not available');
      expect(error.code).toBe('MODEL_NOT_AVAILABLE');
      expect(error.recoverable).toBe(false);
    });

    it('should create ModelInitializationError', () => {
      const error = new ModelInitializationError('gemini', 'API key missing');

      expect(error.message).toBe(
        'Failed to initialize gemini model: API key missing'
      );
      expect(error.code).toBe('MODEL_INITIALIZATION_FAILED');
      expect(error.recoverable).toBe(true);
    });

    it('should create ModelProcessingError', () => {
      const error = new ModelProcessingError('Network timeout');

      expect(error.message).toBe('Failed to process message: Network timeout');
      expect(error.code).toBe('MODEL_PROCESSING_FAILED');
      expect(error.recoverable).toBe(true);
    });
  });

  describe('Type definitions', () => {
    it('should define ModelInfo interface correctly', () => {
      const modelInfo: ModelInfo = {
        name: 'Test Model',
        type: 'local',
        status: 'ready',
        capabilities: ['text_generation', 'tool_calling'],
        version: '1.0',
        size: '7B',
        contextSize: 4096,
      };

      expect(modelInfo.name).toBe('Test Model');
      expect(modelInfo.type).toBe('local');
      expect(modelInfo.status).toBe('ready');
      expect(modelInfo.capabilities).toContain('text_generation');
    });

    it('should define ModelStatus interface correctly', () => {
      const modelStatus: ModelStatus = {
        type: 'gemini',
        isReady: true,
        isLoading: false,
        downloadProgress: 75,
        error: 'Connection timeout',
        modelInfo: {
          name: 'Gemini',
          type: 'cloud',
          status: 'ready',
          capabilities: ['text_generation'],
        },
      };

      expect(modelStatus.type).toBe('gemini');
      expect(modelStatus.isReady).toBe(true);
      expect(modelStatus.downloadProgress).toBe(75);
    });
  });

  describe('Interface contract', () => {
    // Mock implementation for testing
    class MockAIService implements AIServiceInterface {
      private initialized = false;

      async processMessage() {
        return {
          message: 'Mock response',
          actions: [],
          suggestions: [],
          context: {} as AppContext,
        };
      }

      isInitialized() {
        return this.initialized;
      }

      getModelInfo(): ModelInfo {
        return {
          name: 'Mock Model',
          type: 'local',
          status: this.initialized ? 'ready' : 'not_initialized',
          capabilities: ['text_generation'],
        };
      }

      setTranslationFunction() {
        // Mock implementation
      }

      clearConversation() {
        // Mock implementation
      }

      getStatus(): ModelStatus {
        return {
          type: 'local',
          isReady: this.initialized,
          isLoading: false,
        };
      }

      initialize() {
        this.initialized = true;
        return Promise.resolve();
      }

      cleanup() {
        this.initialized = false;
      }
    }

    it('should implement all required methods', () => {
      const service = new MockAIService();

      expect(typeof service.processMessage).toBe('function');
      expect(typeof service.isInitialized).toBe('function');
      expect(typeof service.getModelInfo).toBe('function');
      expect(typeof service.setTranslationFunction).toBe('function');
      expect(typeof service.clearConversation).toBe('function');
      expect(typeof service.getStatus).toBe('function');
    });

    it('should handle initialization lifecycle', async () => {
      const service = new MockAIService();

      expect(service.isInitialized()).toBe(false);
      expect(service.getModelInfo().status).toBe('not_initialized');

      await service.initialize?.();

      expect(service.isInitialized()).toBe(true);
      expect(service.getModelInfo().status).toBe('ready');
    });

    it('should handle cleanup', () => {
      const service = new MockAIService();

      service.initialize?.();
      expect(service.isInitialized()).toBe(true);

      service.cleanup?.();
      expect(service.isInitialized()).toBe(false);
    });
  });
});

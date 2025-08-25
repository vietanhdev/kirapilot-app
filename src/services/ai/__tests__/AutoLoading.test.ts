import { ModelManager } from '../ModelManager';
import { LocalAIService } from '../LocalAIService';
import { ReactAIService } from '../ReactAIService';

// Mock the services
jest.mock('../LocalAIService');
jest.mock('../ReactAIService');

describe('ModelManager Auto-Loading', () => {
  let modelManager: ModelManager;
  let mockLocalService: jest.Mocked<LocalAIService>;
  let mockGeminiService: jest.Mocked<ReactAIService>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock services
    mockLocalService = {
      initialize: jest.fn().mockResolvedValue(undefined),
      isInitialized: jest.fn().mockReturnValue(true),
      getStatus: jest.fn().mockReturnValue({
        type: 'local',
        isReady: true,
        isLoading: false,
        error: undefined,
      }),
      getModelInfo: jest.fn().mockReturnValue({
        name: 'test-local-model',
        type: 'local',
        status: 'ready',
      }),
      setTranslationFunction: jest.fn(),
      processMessage: jest.fn(),
      clearConversation: jest.fn(),
      analyzePatterns: jest.fn(),
    } as jest.Mocked<LocalAIService>;

    mockGeminiService = {
      initialize: jest.fn().mockResolvedValue(undefined),
      isInitialized: jest.fn().mockReturnValue(true),
      getStatus: jest.fn().mockReturnValue({
        type: 'gemini',
        isReady: true,
        isLoading: false,
        error: undefined,
      }),
      getModelInfo: jest.fn().mockReturnValue({
        name: 'gemini-pro',
        type: 'gemini',
        status: 'ready',
      }),
      setTranslationFunction: jest.fn(),
      setApiKey: jest.fn(),
      processMessage: jest.fn(),
      clearConversation: jest.fn(),
      analyzePatterns: jest.fn(),
    } as jest.Mocked<ReactAIService>;

    // Mock the constructors
    (
      LocalAIService as jest.MockedClass<typeof LocalAIService>
    ).mockImplementation(() => mockLocalService);
    (
      ReactAIService as jest.MockedClass<typeof ReactAIService>
    ).mockImplementation(() => mockGeminiService);

    modelManager = new ModelManager();
  });

  afterEach(() => {
    modelManager.cleanup();
  });

  describe('autoLoadLocalModel', () => {
    it('should start background initialization of local model', async () => {
      // Initially on Gemini
      expect(modelManager.getCurrentModelType()).toBe('gemini');

      // Start auto-loading local model
      const autoLoadPromise = modelManager.autoLoadLocalModel({
        type: 'local',
      });

      // Should not throw
      await expect(autoLoadPromise).resolves.toBeUndefined();

      // Local service should have been initialized
      expect(mockLocalService.initialize).toHaveBeenCalled();
    });

    it('should not auto-load if already on local model', async () => {
      // Switch to local first
      await modelManager.switchModel('local');
      expect(modelManager.getCurrentModelType()).toBe('local');

      // Reset mock call counts
      jest.clearAllMocks();

      // Try to auto-load
      await modelManager.autoLoadLocalModel();

      // Should not initialize again
      expect(mockLocalService.initialize).not.toHaveBeenCalled();
    });

    it('should handle auto-loading failures gracefully', async () => {
      // Make local service initialization fail
      mockLocalService.initialize.mockRejectedValue(
        new Error('Initialization failed')
      );

      // Auto-loading should not throw
      await expect(
        modelManager.autoLoadLocalModel({ type: 'local' })
      ).resolves.toBeUndefined();
    });
  });

  describe('background preloading', () => {
    it('should preload services in background after switching', async () => {
      // Switch to local model
      await modelManager.switchModel('local');

      // Should have started preloading Gemini in background
      // (This is tested indirectly through the preloading status)
      expect(modelManager.getCurrentModelType()).toBe('local');
    });

    it('should use preloaded service when switching', async () => {
      // Start preloading local service
      await modelManager.preloadServiceManually('local');

      // Count how many times initialize was called during preloading
      const preloadInitCalls = mockLocalService.initialize.mock.calls.length;

      // Switch to local model
      await modelManager.switchModel('local');

      // Should have used the preloaded service (may call initialize once more during switch)
      expect(modelManager.getCurrentModelType()).toBe('local');
      expect(
        mockLocalService.initialize.mock.calls.length
      ).toBeGreaterThanOrEqual(preloadInitCalls);
    });

    it('should report preloading status correctly', async () => {
      // Initially no preloading
      const initialStatus = modelManager.getPreloadingStatus();
      expect(initialStatus.local).toBe(false);
      expect(initialStatus.gemini).toBe(false);

      // Start preloading (but don't await)
      const preloadPromise = modelManager.preloadServiceManually('local');

      // Should report as preloading
      expect(modelManager.isPreloading('local')).toBe(true);

      // Wait for completion
      await preloadPromise;

      // Should no longer be preloading
      expect(modelManager.isPreloading('local')).toBe(false);
    });
  });

  describe('enhanced model status', () => {
    it('should track preloading status correctly', async () => {
      // Mock local service initialization to take some time
      let resolveInit: () => void;
      const initPromise = new Promise<void>(resolve => {
        resolveInit = resolve;
      });
      mockLocalService.initialize.mockReturnValue(initPromise);

      // Start preloading (don't await)
      const preloadPromise = modelManager.preloadServiceManually('local');

      // Should be preloading now
      expect(modelManager.isPreloading('local')).toBe(true);

      // Complete the initialization
      resolveInit!();
      await preloadPromise;

      // Should no longer be preloading
      expect(modelManager.isPreloading('local')).toBe(false);
    });
  });
});

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import {
  BackendAIService,
  initializeBackendAIService,
} from '../services/ai/BackendAIService';
import { ModelStatus } from '../services/ai/AIServiceInterface';
import { LogRetentionManager } from '../services/ai/LogRetentionManager';
import { LogStorageService } from '../services/database/repositories/LogStorageService';
import { LoggingConfigService } from '../services/database/repositories/LoggingConfigService';
import { useTranslation } from '../hooks/useTranslation';
import { useDatabaseContext } from '../services/database/DatabaseProvider';
import {
  AIResponse,
  AISuggestion,
  AppContext,
  AIAction,
  PatternAnalysis,
  BackendInteractionLog,
} from '../types';
import { getLocalModelErrorMessage } from '../services/ai/LocalModelDiagnostics';

// Model types supported by the backend
export type ModelType = 'local' | 'gemini';

// Model configuration interface
export interface ModelConfig {
  type: ModelType;
  apiKey?: string;
  options?: Record<string, unknown>;
}

interface AIContextType {
  aiService: BackendAIService | null;
  currentModelType: ModelType;
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
  conversations: AIConversation[];
  suggestions: AISuggestion[];
  sendMessage: (
    message: string,
    context: AppContext
  ) => Promise<AIResponse | null>;
  switchModel: (modelType: ModelType, config?: ModelConfig) => Promise<void>;
  clearConversation: () => void;
  dismissSuggestion: (suggestionId: string) => void;
  applySuggestion: (suggestionId: string) => Promise<void>;
  analyzePatterns: () => Promise<PatternAnalysis | null>;
  initializeWithApiKey: (apiKey: string) => void;
  reinitializeAI: () => void;
  getModelStatus: () => ModelStatus;
  getModelStatusAsync: () => Promise<ModelStatus>;
  getAvailableModels: () => ModelType[];
  // Backend service management
  getInteractionLogs: (limit?: number) => Promise<BackendInteractionLog[]>;
  isServiceAvailable: (type: ModelType) => boolean;
  cleanup: () => void;
}

interface AIConversation {
  id: string;
  message: string;
  response: string;
  timestamp: Date;
  actions: AIAction[];
  suggestions: AISuggestion[];
  reasoning?: string;
}

interface AIProviderProps {
  children: ReactNode;
}

const AIContext = createContext<AIContextType | undefined>(undefined);

export function AIProvider({ children }: AIProviderProps) {
  const { t } = useTranslation();
  const { isInitialized: isDatabaseReady } = useDatabaseContext();
  const [aiService, setAiService] = useState<BackendAIService | null>(null);
  const [currentModelType, setCurrentModelType] = useState<ModelType>('gemini');
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [retentionManager, setRetentionManager] =
    useState<LogRetentionManager | null>(null);

  // Get AI preferences - we'll use a ref to avoid circular dependencies during initialization
  const getAIPreferences = () => {
    const stored = localStorage.getItem('kirapilot-preferences');
    if (stored) {
      try {
        const prefs = JSON.parse(stored);
        return (
          prefs.aiSettings || {
            conversationHistory: true,
            autoSuggestions: true,
            toolPermissions: true,
            responseStyle: 'balanced',
            suggestionFrequency: 'moderate',
            geminiApiKey: undefined,
            modelType: 'gemini',
          }
        );
      } catch {
        return {
          conversationHistory: true,
          autoSuggestions: true,
          toolPermissions: true,
          responseStyle: 'balanced',
          suggestionFrequency: 'moderate',
          geminiApiKey: undefined,
        };
      }
    }
    return {
      conversationHistory: true,
      autoSuggestions: true,
      toolPermissions: true,
      responseStyle: 'balanced',
      suggestionFrequency: 'moderate',
      geminiApiKey: undefined,
      modelType: 'gemini',
    };
  };

  // Get privacy settings - we'll use a ref to avoid circular dependencies
  const getPrivacySettings = () => {
    const stored = localStorage.getItem('kirapilot-privacy-settings');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return null;
      }
    }
    return null;
  };

  useEffect(() => {
    console.log(
      '🔍 [KIRAPILOT] AIContext useEffect triggered, calling initializeAI...'
    );
    initializeAI();

    // Listen for storage changes to reinitialize when preferences change
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'kirapilot-preferences' && e.newValue !== e.oldValue) {
        // Small delay to ensure the preferences are fully updated
        setTimeout(() => {
          initializeAI();
        }, 100);
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      // Cleanup resources when component unmounts
      if (aiService) {
        aiService.cleanup();
      }
    };
  }, []); // Remove t dependency to prevent infinite re-initialization

  // Backend service doesn't need periodic checks or translation functions
  // The backend handles all model management internally

  // Effect to initialize logging when database becomes ready
  useEffect(() => {
    if (isDatabaseReady && aiService && !retentionManager) {
      console.log('🔍 Debug: Database is now ready, initializing logging...');
      initializeLogging();
    }
  }, [isDatabaseReady, aiService, retentionManager]);

  const initializeLogging = async () => {
    if (!aiService) {
      return;
    }

    try {
      console.log('🔍 Debug: Initializing logging for backend AI service...');
      const logStorageService = new LogStorageService();
      const loggingConfigService = new LoggingConfigService();

      // Initialize log retention manager
      // Backend handles interaction logging internally, so we only need retention management
      const retentionMgr = new LogRetentionManager(
        logStorageService,
        loggingConfigService
      );
      setRetentionManager(retentionMgr);

      // Start automatic cleanup if enabled
      await retentionMgr.startAutomaticCleanup();
      console.log('🔍 Debug: Logging system initialized for backend service');
    } catch (error) {
      console.error('🔍 Debug: Failed to initialize logging:', error);
    }
  };

  const initializeAI = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Initialize the backend AI service
      console.log('🔍 Debug: Initializing Backend AI Service...');
      const service = await initializeBackendAIService();

      setAiService(service);

      // Get model type preference from user settings
      const preferences = getAIPreferences();
      const preferredModelType: ModelType = preferences.modelType || 'local';

      // Update the current model type state to match the preference
      setCurrentModelType(preferredModelType);

      // Get the current status first to see what's available
      const initialStatus = await service.getStatusFromBackend();
      console.log(`🔍 Debug: Initial backend status:`, initialStatus);

      // If the service isn't ready, wait a bit and check again
      if (!initialStatus.isReady) {
        console.log(`🔍 Debug: Backend service not ready, waiting...`);
        await new Promise(resolve => setTimeout(resolve, 1000));

        const retryStatus = await service.getStatusFromBackend();
        console.log(`🔍 Debug: Retry backend status:`, retryStatus);
      }

      // Try to switch to the preferred model with retry
      let switchSuccess = false;
      let lastError: any = null;

      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          console.log(
            `🔍 Debug: Attempt ${attempt} to switch to ${preferredModelType} model`
          );
          await service.switchModel(preferredModelType);
          setCurrentModelType(preferredModelType);
          setIsInitialized(true);
          setError(null);
          switchSuccess = true;

          console.log(
            `🔍 Debug: Successfully initialized with ${preferredModelType} model on attempt ${attempt}`
          );
          break;
        } catch (modelErr) {
          lastError = modelErr;
          console.warn(`🔍 Debug: Attempt ${attempt} failed:`, modelErr);

          if (attempt < 3) {
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, 500 * attempt));
          }
        }
      }

      if (!switchSuccess) {
        const modelErr = lastError;
        console.error(
          `Failed to switch to ${preferredModelType} model after 3 attempts:`,
          modelErr
        );

        // Extract detailed error message
        let detailedError = 'Unknown error';
        if (modelErr instanceof Error) {
          detailedError = modelErr.message;
        } else if (typeof modelErr === 'object' && modelErr !== null) {
          // Handle structured error responses from backend
          const errorObj = modelErr as Record<string, unknown>;
          if (typeof errorObj.message === 'string') {
            detailedError = errorObj.message;
          } else if (
            typeof errorObj.error_type === 'string' &&
            typeof errorObj.message === 'string'
          ) {
            detailedError = `${errorObj.error_type}: ${errorObj.message}`;
          }
        }

        // If preferred model fails, try fallback
        const fallbackModel =
          preferredModelType === 'local' ? 'gemini' : 'local';

        try {
          console.log(`🔍 Debug: Attempting fallback to ${fallbackModel}...`);
          await service.switchModel(fallbackModel);
          setCurrentModelType(fallbackModel);
          setIsInitialized(true);

          // Show detailed error for failed model but indicate successful fallback
          if (preferredModelType === 'local') {
            const friendlyError = getLocalModelErrorMessage(detailedError);
            setError(
              `Local model unavailable: ${friendlyError}. Using Gemini instead. The local model requires compatible system dependencies - check Settings > AI for details.`
            );
          } else {
            setError(
              `Failed to initialize ${preferredModelType} model (${detailedError}), using ${fallbackModel} instead.`
            );
          }
        } catch (fallbackErr) {
          console.error(`${fallbackModel} fallback also failed:`, fallbackErr);
          setError(
            `Failed to initialize both ${preferredModelType} and ${fallbackModel} models. ${preferredModelType}: ${detailedError}. ${fallbackModel}: ${fallbackErr instanceof Error ? fallbackErr.message : 'Unknown error'}`
          );
          setIsInitialized(false);
        }
      }
    } catch (err) {
      console.error('Failed to initialize Backend AI service:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to initialize AI service'
      );
      setIsInitialized(false);
    } finally {
      setIsLoading(false);
    }
  };

  const initializeWithApiKey = async (apiKey: string) => {
    try {
      // Store the API key in preferences for backend to use
      const preferences = getAIPreferences();
      const updatedPreferences = {
        ...preferences,
        geminiApiKey: apiKey,
      };

      const storedPrefs = localStorage.getItem('kirapilot-preferences');
      const allPrefs = storedPrefs ? JSON.parse(storedPrefs) : {};
      allPrefs.aiSettings = updatedPreferences;
      localStorage.setItem('kirapilot-preferences', JSON.stringify(allPrefs));

      // Reinitialize the AI service to pick up the new API key
      await initializeAI();
    } catch (err) {
      console.error('Failed to initialize AI with API key:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to initialize AI service'
      );
    }
  };

  const reinitializeAI = () => {
    initializeAI();
  };

  const sendMessage = async (
    message: string,
    context: AppContext
  ): Promise<AIResponse | null> => {
    if (!aiService) {
      setError('AI service not initialized');
      return null;
    }

    if (!isInitialized) {
      setError(t('ai.status.setupRequired'));
      return null;
    }

    // Check privacy settings before processing
    const privacySettings = getPrivacySettings();
    if (privacySettings && !privacySettings.aiDataUsage) {
      setError('AI data usage is disabled in privacy settings');
      return null;
    }

    // Get AI preferences
    const aiPreferences = getAIPreferences();

    setIsLoading(true);
    setError(null);

    try {
      // Log which model we think we're using before sending the message
      console.log(
        `🎯 [AIContext] Sending message with model: ${currentModelType}`
      );
      const currentStatus = await getModelStatusAsync();
      console.log(
        `🔍 [AIContext] Actual backend status before message:`,
        currentStatus
      );

      const response = await aiService.processMessage(message, context);

      // Apply response style preferences
      if (aiPreferences.responseStyle === 'concise') {
        response.message = response.message.split('\n').slice(0, 3).join('\n');
      } else if (aiPreferences.responseStyle === 'detailed') {
        // Keep full response as is
      }

      // Only add to conversation history if retention is enabled
      if (
        aiPreferences.conversationHistory &&
        (!privacySettings || privacySettings.conversationRetention)
      ) {
        const conversation: AIConversation = {
          id: `conv-${Date.now()}`,
          message,
          response: response.message,
          timestamp: new Date(),
          actions: response.actions,
          suggestions: response.suggestions,
          reasoning: response.reasoning,
        };

        setConversations(prev => [...prev, conversation]);
      }

      // Update suggestions based on auto-suggestions preference
      if (aiPreferences.autoSuggestions) {
        setSuggestions(prev => {
          const newSuggestions = response.suggestions.filter(
            (newSugg: AISuggestion) =>
              !prev.some(existingSugg => existingSugg.id === newSugg.id)
          );
          return [...prev, ...newSuggestions];
        });
      }

      return response;
    } catch (err) {
      console.error('Error sending message to AI:', err);

      // Enhanced error handling with service status propagation
      let errorMessage = 'Failed to send message';
      if (err instanceof Error) {
        errorMessage = err.message;
      }

      // Check if this is a service-specific error that might benefit from fallback
      const currentStatus = aiService.getStatus();
      if (!currentStatus.isReady) {
        errorMessage = `${currentModelType} service is not ready: ${currentStatus.error || 'Unknown error'}`;

        // Try to reinitialize if the service became unavailable
        try {
          await initializeAI();

          // If reinitialization succeeded, don't show the error
          if (aiService && aiService.isInitialized()) {
            setError(null);
            // Retry the message
            return await sendMessage(message, context);
          }
        } catch (reinitErr) {
          console.error('Failed to reinitialize AI service:', reinitErr);
          errorMessage += ` (Reinitialization also failed: ${reinitErr instanceof Error ? reinitErr.message : 'Unknown error'})`;
        }
      }

      setError(errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const switchModel = async (modelType: ModelType, _config?: ModelConfig) => {
    console.log(`🎯 [AIContext] switchModel called with: ${modelType}`);

    if (!aiService) {
      console.error('❌ [AIContext] AI service not initialized');
      setError('AI service not initialized');
      return;
    }

    console.log(
      `🔄 [AIContext] Starting model switch from ${currentModelType} to ${modelType}`
    );
    setIsLoading(true);
    setError(null);

    try {
      // Check if we have the necessary configuration for the target model
      if (modelType === 'gemini') {
        const preferences = getAIPreferences();
        console.log(
          `🔍 [AIContext] Switching to Gemini - API key available: ${!!preferences.geminiApiKey}`
        );
        if (!preferences.geminiApiKey) {
          setError(
            'Gemini API key is required. Please set it in Settings > AI.'
          );
          return;
        }
      }

      await aiService.switchModel(modelType);

      console.log(
        `✅ [AIContext] Backend switch completed, updating UI state...`
      );

      // Trust that the switch worked since the backend returned success
      setCurrentModelType(modelType);
      setIsInitialized(true);
      setError(null);

      // Verify the switch actually worked by checking backend status
      setTimeout(async () => {
        try {
          const verifyStatus = await getModelStatusAsync();
          console.log(
            `🔍 [AIContext] Verification check - Backend reports model: ${verifyStatus.type}, UI shows: ${modelType}`
          );
          if (verifyStatus.type !== modelType) {
            console.warn(
              `⚠️ [AIContext] Model mismatch detected! Backend: ${verifyStatus.type}, UI: ${modelType}`
            );
            // Update UI to match backend reality
            setCurrentModelType(verifyStatus.type);
          }
        } catch (error) {
          console.warn(`⚠️ [AIContext] Failed to verify model switch:`, error);
        }
      }, 1000);

      // Update preferences to remember the selected model type
      const preferences = getAIPreferences();
      const updatedPreferences = {
        ...preferences,
        modelType: modelType,
      };

      const storedPrefs = localStorage.getItem('kirapilot-preferences');
      const allPrefs = storedPrefs ? JSON.parse(storedPrefs) : {};
      allPrefs.aiSettings = updatedPreferences;
      localStorage.setItem('kirapilot-preferences', JSON.stringify(allPrefs));

      console.log(
        `🎉 [AIContext] Successfully switched to ${modelType} model and updated UI state`
      );
    } catch (err) {
      console.error('Failed to switch model:', err);

      // Extract the detailed error message
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to switch model';

      // Handle local model specific errors with user-friendly messages
      if (modelType === 'local') {
        if (
          errorMessage.includes('not available on this system') ||
          errorMessage.includes('required dependencies') ||
          errorMessage.includes('system dependencies')
        ) {
          const friendlyError = getLocalModelErrorMessage(errorMessage);
          setError(`Cannot switch to local model: ${friendlyError}`);
        } else {
          setError(`Local model switch failed: ${errorMessage}`);
        }

        // Don't attempt automatic fallback for manual user switches
        // Let the user decide what to do next
      } else if (modelType === 'gemini') {
        if (
          errorMessage.includes('API key') ||
          errorMessage.includes('unavailable')
        ) {
          setError(
            `Cannot switch to Gemini: ${errorMessage}. Please check your API key in Settings.`
          );
        } else {
          setError(`Gemini model switch failed: ${errorMessage}`);
        }
      } else {
        setError(`Failed to switch to ${modelType}: ${errorMessage}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const clearConversation = () => {
    if (aiService) {
      aiService.clearConversation();
    }
    setConversations([]);
  };

  const dismissSuggestion = (suggestionId: string) => {
    setSuggestions(prev =>
      prev.map(sugg =>
        sugg.id === suggestionId ? { ...sugg, dismissedAt: new Date() } : sugg
      )
    );
  };

  const applySuggestion = async (suggestionId: string) => {
    // In ReAct architecture, suggestions are applied through natural language
    // Mark suggestion as applied and let user interact via chat
    setSuggestions(prev =>
      prev.map(sugg =>
        sugg.id === suggestionId ? { ...sugg, appliedAt: new Date() } : sugg
      )
    );
  };

  const analyzePatterns = async (): Promise<PatternAnalysis | null> => {
    if (!aiService) {
      setError(t('ai.status.setupRequired'));
      return null;
    }

    try {
      setIsLoading(true);
      const analysis = await aiService.analyzePatterns();
      return analysis;
    } catch (err) {
      console.error('Error analyzing patterns:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to analyze patterns'
      );
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const getModelStatus = (): ModelStatus => {
    if (!aiService) {
      return {
        type: 'gemini' as const,
        isReady: false,
        isLoading: false,
        error: 'AI service not initialized',
      };
    }
    return aiService.getStatus();
  };

  const getModelStatusAsync = async (): Promise<ModelStatus> => {
    if (!aiService) {
      return {
        type: 'gemini' as const,
        isReady: false,
        isLoading: false,
        error: 'AI service not initialized',
      };
    }

    // Use the async version to get real backend status
    const backendService = aiService as BackendAIService;
    if (backendService.getStatusFromBackend) {
      return await backendService.getStatusFromBackend();
    }

    return backendService.getStatus();
  };

  const getAvailableModels = (): ModelType[] => {
    // Backend supports both local and gemini models
    console.log('🔍 [KIRAPILOT] getAvailableModels called, returning:', [
      'local',
      'gemini',
    ]);
    return ['local', 'gemini'];
  };

  const getInteractionLogs = async (
    limit: number = 50
  ): Promise<BackendInteractionLog[]> => {
    if (!aiService) {
      throw new Error('AI service not initialized');
    }
    return await aiService.getInteractionLogs(limit);
  };

  const isServiceAvailable = (type: ModelType): boolean => {
    // Backend supports both local and gemini models
    return type === 'local' || type === 'gemini';
  };

  const cleanup = () => {
    if (aiService) {
      aiService.cleanup();
    }
    if (retentionManager) {
      retentionManager.stopAutomaticCleanup();
    }
    setAiService(null);
    setRetentionManager(null);
    setIsInitialized(false);
    setError(null);
    setConversations([]);
    setSuggestions([]);
  };

  const value: AIContextType = {
    aiService,
    currentModelType,
    isInitialized,
    isLoading,
    error,
    conversations,
    suggestions: suggestions.filter(s => !s.dismissedAt), // Only show non-dismissed suggestions
    sendMessage,
    switchModel,
    clearConversation,
    dismissSuggestion,
    applySuggestion,
    analyzePatterns,
    initializeWithApiKey,
    reinitializeAI,
    getModelStatus,
    getModelStatusAsync,
    getAvailableModels,
    // Backend service management
    getInteractionLogs,
    isServiceAvailable,
    cleanup,
  };

  return <AIContext.Provider value={value}>{children}</AIContext.Provider>;
}

export function useAI(): AIContextType {
  const context = useContext(AIContext);
  if (context === undefined) {
    throw new Error('useAI must be used within an AIProvider');
  }
  return context;
}

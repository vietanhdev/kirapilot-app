import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import {
  ModelManager,
  getModelManager,
  ModelType,
  ModelConfig,
} from '../services/ai/ModelManager';
import { AIServiceInterface } from '../services/ai/AIServiceInterface';
import { useTranslation } from '../hooks/useTranslation';
import {
  AIResponse,
  AISuggestion,
  AppContext,
  AIAction,
  PatternAnalysis,
} from '../types';

interface AIContextType {
  modelManager: ModelManager | null;
  aiService: AIServiceInterface | null;
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
  getModelStatus: () => import('../services/ai/AIServiceInterface').ModelStatus;
  getAvailableModels: () => ModelType[];
  // Enhanced service management
  initializeService: (type: ModelType, config?: ModelConfig) => Promise<void>;
  getServiceStatus: (
    type: ModelType
  ) => import('../services/ai/AIServiceInterface').ModelStatus | null;
  getAllServiceStatuses: () => Record<
    ModelType,
    import('../services/ai/AIServiceInterface').ModelStatus
  >;
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
  const [modelManager, setModelManager] = useState<ModelManager | null>(null);
  const [aiService, setAiService] = useState<AIServiceInterface | null>(null);
  const [currentModelType, setCurrentModelType] = useState<ModelType>('gemini');
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);

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
      if (modelManager) {
        modelManager.cleanup();
      }
    };
  }, []); // Remove t dependency to prevent infinite re-initialization

  // Separate effect to update translation function without re-initializing
  useEffect(() => {
    if (modelManager && t) {
      modelManager.setTranslationFunction(t);
    }
  }, [modelManager, t]);

  const initializeAI = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Create ModelManager instance
      const manager = getModelManager();

      setModelManager(manager);

      // Check if API key is available in environment, settings, or legacy localStorage
      const preferences = getAIPreferences();
      const apiKey =
        import.meta.env.VITE_GOOGLE_API_KEY ||
        preferences.geminiApiKey ||
        localStorage.getItem('kira_api_key') || // Legacy fallback
        localStorage.getItem('kirapilot-gemini-api-key'); // Legacy fallback

      // Get model type preference from user settings
      const modelType: ModelType = preferences.modelType || 'gemini';

      // Always try to initialize the preferred model first
      try {
        const config: ModelConfig = {
          type: modelType,
          apiKey: apiKey || undefined,
        };
        await manager.switchModel(modelType, config);

        const service = manager.getCurrentService();
        setAiService(service);
        setCurrentModelType(manager.getCurrentModelType());
        setIsInitialized(manager.isReady());
        setError(null);
      } catch (modelErr) {
        console.error(`Failed to initialize ${modelType} model:`, modelErr);

        // If preferred model fails and it's not Gemini, try Gemini as fallback
        if (modelType !== 'gemini') {
          try {
            console.log('Attempting fallback to Gemini...');
            const geminiConfig: ModelConfig = {
              type: 'gemini',
              apiKey: apiKey || undefined,
            };
            await manager.switchModel('gemini', geminiConfig);

            const service = manager.getCurrentService();
            setAiService(service);
            setCurrentModelType(manager.getCurrentModelType());
            setIsInitialized(manager.isReady());

            if (apiKey) {
              setError(
                `Failed to initialize ${modelType} model, using Gemini instead: ${modelErr instanceof Error ? modelErr.message : 'Unknown error'}`
              );
            } else {
              setError(t('ai.error.apiKeyRequired'));
              setIsInitialized(false);
            }
          } catch (geminiErr) {
            console.error('Gemini fallback also failed:', geminiErr);
            setError(
              apiKey
                ? `Failed to initialize both ${modelType} and Gemini models: ${geminiErr instanceof Error ? geminiErr.message : 'Unknown error'}`
                : t('ai.error.apiKeyRequired')
            );
            setIsInitialized(false);
          }
        } else {
          // Gemini failed and it was the preferred model
          if (apiKey) {
            setError(
              modelErr instanceof Error
                ? modelErr.message
                : 'Failed to initialize Gemini model'
            );
          } else {
            setError(t('ai.error.apiKeyRequired'));
          }
          setIsInitialized(false);
        }
      }
    } catch (err) {
      console.error('Failed to initialize AI service:', err);
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
      if (modelManager) {
        await modelManager.switchModel(currentModelType, {
          type: currentModelType,
          apiKey,
        });
        const service = modelManager.getCurrentService();

        setAiService(service);
        setIsInitialized(modelManager.isReady());
        setError(null);
      } else {
        // Initialize ModelManager if it doesn't exist
        await initializeAI();
      }
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
    if (!modelManager) {
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
      const response = await modelManager.processMessage(message, context);

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
      const currentStatus = modelManager.getModelStatus();
      if (!currentStatus.isReady) {
        errorMessage = `${currentModelType} service is not ready: ${currentStatus.error || 'Unknown error'}`;

        // Try to reinitialize if the service became unavailable
        try {
          console.log('Attempting to reinitialize AI service...');
          await initializeAI();

          // If reinitialization succeeded, don't show the error
          if (modelManager.isReady()) {
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

  const switchModel = async (modelType: ModelType, config?: ModelConfig) => {
    if (!modelManager) {
      setError('Model manager not initialized');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Use provided config or build from preferences
      let modelConfig = config;
      if (!modelConfig) {
        const preferences = getAIPreferences();
        const apiKey =
          import.meta.env.VITE_GOOGLE_API_KEY ||
          preferences.geminiApiKey ||
          localStorage.getItem('kira_api_key') ||
          localStorage.getItem('kirapilot-gemini-api-key');

        modelConfig = {
          type: modelType,
          apiKey: apiKey || undefined,
        };
      }

      await modelManager.switchModel(modelType, modelConfig);

      const service = modelManager.getCurrentService();
      setAiService(service);
      setCurrentModelType(modelManager.getCurrentModelType());
      setIsInitialized(modelManager.isReady());

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
    } catch (err) {
      console.error('Failed to switch model:', err);
      setError(err instanceof Error ? err.message : 'Failed to switch model');

      // If switching to local model fails, try to fallback to Gemini
      if (modelType === 'local' && currentModelType !== 'gemini') {
        try {
          console.log(
            'Attempting fallback to Gemini after local model failure...'
          );
          const preferences = getAIPreferences();
          const apiKey =
            import.meta.env.VITE_GOOGLE_API_KEY ||
            preferences.geminiApiKey ||
            localStorage.getItem('kira_api_key') ||
            localStorage.getItem('kirapilot-gemini-api-key');

          await modelManager.switchModel('gemini', {
            type: 'gemini',
            apiKey: apiKey || undefined,
          });

          const service = modelManager.getCurrentService();
          setAiService(service);
          setCurrentModelType(modelManager.getCurrentModelType());
          setIsInitialized(modelManager.isReady());

          setError(
            `Failed to switch to ${modelType} model, using Gemini instead: ${err instanceof Error ? err.message : 'Unknown error'}`
          );
        } catch (fallbackErr) {
          console.error('Fallback to Gemini also failed:', fallbackErr);
          setError(
            `Failed to switch to ${modelType} model and fallback failed: ${fallbackErr instanceof Error ? fallbackErr.message : 'Unknown error'}`
          );
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const clearConversation = () => {
    if (modelManager) {
      modelManager.clearConversation();
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
    if (!modelManager) {
      setError(t('ai.status.setupRequired'));
      return null;
    }

    try {
      setIsLoading(true);
      const analysis = await modelManager.analyzePatterns();
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

  const getModelStatus = () => {
    if (!modelManager) {
      return {
        type: 'gemini' as const,
        isReady: false,
        isLoading: false,
        error: 'Model manager not initialized',
      };
    }
    return modelManager.getModelStatus();
  };

  const getAvailableModels = (): ModelType[] => {
    if (!modelManager) {
      return ['gemini'];
    }
    return modelManager.getAvailableModels();
  };

  const initializeService = async (type: ModelType, config?: ModelConfig) => {
    if (!modelManager) {
      setError('Model manager not initialized');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Build config if not provided
      let serviceConfig = config;
      if (!serviceConfig) {
        const preferences = getAIPreferences();
        const apiKey =
          import.meta.env.VITE_GOOGLE_API_KEY ||
          preferences.geminiApiKey ||
          localStorage.getItem('kira_api_key') ||
          localStorage.getItem('kirapilot-gemini-api-key');

        serviceConfig = {
          type: type,
          apiKey: apiKey || undefined,
        };
      }

      // Initialize the service without switching to it
      await modelManager.switchModel(type, serviceConfig);

      // If this was the current model type, update the context
      if (type === currentModelType) {
        const service = modelManager.getCurrentService();
        setAiService(service);
        setIsInitialized(modelManager.isReady());
      }
    } catch (err) {
      console.error(`Failed to initialize ${type} service:`, err);
      setError(
        err instanceof Error
          ? err.message
          : `Failed to initialize ${type} service`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const getServiceStatus = (type: ModelType) => {
    if (!modelManager) {
      return null;
    }

    // If it's the current service, get the current status
    if (type === currentModelType) {
      return modelManager.getModelStatus();
    }

    // For other services, check if they're available
    if (modelManager.isModelAvailable(type)) {
      return {
        type: type,
        isReady: false,
        isLoading: false,
        error: undefined,
      };
    }

    return {
      type: type,
      isReady: false,
      isLoading: false,
      error: 'Service not available',
    };
  };

  const getAllServiceStatuses = () => {
    const statuses: Record<
      ModelType,
      import('../services/ai/AIServiceInterface').ModelStatus
    > = {} as Record<
      ModelType,
      import('../services/ai/AIServiceInterface').ModelStatus
    >;

    const availableModels = getAvailableModels();
    for (const modelType of availableModels) {
      const status = getServiceStatus(modelType);
      if (status) {
        statuses[modelType] = status;
      }
    }

    return statuses;
  };

  const isServiceAvailable = (type: ModelType): boolean => {
    if (!modelManager) {
      return type === 'gemini'; // Gemini is always available as fallback
    }
    return modelManager.isModelAvailable(type);
  };

  const cleanup = () => {
    if (modelManager) {
      modelManager.cleanup();
    }
    setModelManager(null);
    setAiService(null);
    setIsInitialized(false);
    setError(null);
    setConversations([]);
    setSuggestions([]);
  };

  const value: AIContextType = {
    modelManager,
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
    getAvailableModels,
    // Enhanced service management
    initializeService,
    getServiceStatus,
    getAllServiceStatuses,
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

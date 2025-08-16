import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import {
  ReactAIService,
  getReactAIService,
} from '../services/ai/ReactAIService';
import {
  AIResponse,
  AISuggestion,
  AppContext,
  AIAction,
  PatternAnalysis,
} from '../types';

interface AIContextType {
  aiService: ReactAIService | null;
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
  conversations: AIConversation[];
  suggestions: AISuggestion[];
  sendMessage: (
    message: string,
    context: AppContext
  ) => Promise<AIResponse | null>;
  clearConversation: () => void;
  dismissSuggestion: (suggestionId: string) => void;
  applySuggestion: (suggestionId: string) => Promise<void>;
  analyzePatterns: () => Promise<PatternAnalysis | null>;
  initializeWithApiKey: (apiKey: string) => void;
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
  const [aiService, setAiService] = useState<ReactAIService | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);

  useEffect(() => {
    initializeAI();
  }, []);

  const initializeAI = () => {
    try {
      // Always create the service instance, but don't require API key initially
      const service = getReactAIService();
      setAiService(service);

      // Check if API key is available in environment or localStorage
      const apiKey =
        import.meta.env.VITE_GOOGLE_API_KEY ||
        localStorage.getItem('kira_api_key');

      if (apiKey) {
        service.setApiKey(apiKey);
        setIsInitialized(true);
        setError(null);
      } else {
        setError(
          'Google API key not configured. Please provide an API key to enable Kira AI.'
        );
        setIsInitialized(false);
      }
    } catch (err) {
      console.error('Failed to initialize AI service:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to initialize AI service'
      );
      setIsInitialized(false);
    }
  };

  const initializeWithApiKey = (apiKey: string) => {
    try {
      // Store API key securely (in production, consider more secure storage)
      localStorage.setItem('kira_api_key', apiKey);

      if (aiService) {
        aiService.setApiKey(apiKey);
        setIsInitialized(true);
        setError(null);
      } else {
        const service = getReactAIService();
        service.setApiKey(apiKey);
        setAiService(service);
        setIsInitialized(true);
        setError(null);
      }
    } catch (err) {
      console.error('Failed to initialize AI with API key:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to initialize AI service'
      );
    }
  };

  const sendMessage = async (
    message: string,
    context: AppContext
  ): Promise<AIResponse | null> => {
    if (!aiService || !isInitialized) {
      setError('AI service not initialized');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await aiService.processMessage(message, context);

      // Add to conversation history
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

      // Update suggestions
      setSuggestions(prev => {
        const newSuggestions = response.suggestions.filter(
          (newSugg: AISuggestion) =>
            !prev.some(existingSugg => existingSugg.id === newSugg.id)
        );
        return [...prev, ...newSuggestions];
      });

      return response;
    } catch (err) {
      console.error('Error sending message to AI:', err);
      setError(err instanceof Error ? err.message : 'Failed to send message');
      return null;
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
      setError('AI service not initialized');
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

  const value: AIContextType = {
    aiService,
    isInitialized,
    isLoading,
    error,
    conversations,
    suggestions: suggestions.filter(s => !s.dismissedAt), // Only show non-dismissed suggestions
    sendMessage,
    clearConversation,
    dismissSuggestion,
    applySuggestion,
    analyzePatterns,
    initializeWithApiKey,
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

import { useState, useEffect, useCallback } from 'react';
import {
  ProductivityInsightsService,
  WorkingStyle,
  PersonalizedRecommendation,
} from '../services/ai/ProductivityInsightsService';
import { PatternAnalysis, AISuggestion, Task } from '../types';

interface UseProductivityInsightsReturn {
  // Data
  workingStyle: WorkingStyle | null;
  patternAnalysis: PatternAnalysis | null;
  personalizedTips: PersonalizedRecommendation[];
  contextualAdvice: AISuggestion[];

  // Loading states
  isAnalyzing: boolean;
  isGeneratingTips: boolean;
  isGeneratingAdvice: boolean;

  // Error states
  analysisError: string | null;
  tipsError: string | null;
  adviceError: string | null;

  // Actions
  analyzePatterns: (daysBack?: number) => Promise<void>;
  generateTips: (context?: {
    currentTime?: Date;
    currentTask?: Task;
    recentActivity?: 'high' | 'medium' | 'low';
  }) => Promise<void>;
  getContextualAdvice: (context: {
    currentTask?: Task;
    timeOfDay: Date;
    recentPerformance: 'high' | 'medium' | 'low';
    upcomingDeadlines: Task[];
  }) => Promise<void>;
  refreshWorkingStyle: () => Promise<void>;

  // Utilities
  clearErrors: () => void;
  reset: () => void;
}

export function useProductivityInsights(
  userId: string = 'current-user',
  autoAnalyze: boolean = true
): UseProductivityInsightsReturn {
  const [service] = useState(() => new ProductivityInsightsService());

  // Data state
  const [workingStyle, setWorkingStyle] = useState<WorkingStyle | null>(null);
  const [patternAnalysis, setPatternAnalysis] =
    useState<PatternAnalysis | null>(null);
  const [personalizedTips, setPersonalizedTips] = useState<
    PersonalizedRecommendation[]
  >([]);
  const [contextualAdvice, setContextualAdvice] = useState<AISuggestion[]>([]);

  // Loading states
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingTips, setIsGeneratingTips] = useState(false);
  const [isGeneratingAdvice, setIsGeneratingAdvice] = useState(false);

  // Error states
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [tipsError, setTipsError] = useState<string | null>(null);
  const [adviceError, setAdviceError] = useState<string | null>(null);

  // Analyze user behavior patterns
  const analyzePatterns = useCallback(
    async (daysBack: number = 30) => {
      setIsAnalyzing(true);
      setAnalysisError(null);

      try {
        const analysis = await service.analyzeUserBehaviorPatterns(
          userId,
          daysBack
        );
        setPatternAnalysis(analysis);
      } catch (error) {
        setAnalysisError(
          error instanceof Error ? error.message : 'Failed to analyze patterns'
        );
      } finally {
        setIsAnalyzing(false);
      }
    },
    [service, userId]
  );

  // Refresh working style detection
  const refreshWorkingStyle = useCallback(async () => {
    try {
      const style = await service.detectWorkingStyle(userId);
      setWorkingStyle(style);
    } catch (error) {
      console.error('Failed to detect working style:', error);
    }
  }, [service, userId]);

  // Generate personalized tips
  const generateTips = useCallback(
    async (context?: {
      currentTime?: Date;
      currentTask?: Task;
      recentActivity?: 'high' | 'medium' | 'low';
    }) => {
      setIsGeneratingTips(true);
      setTipsError(null);

      try {
        const tips = await service.generatePersonalizedTips(userId, context);
        setPersonalizedTips(tips);
      } catch (error) {
        setTipsError(
          error instanceof Error ? error.message : 'Failed to generate tips'
        );
      } finally {
        setIsGeneratingTips(false);
      }
    },
    [service, userId]
  );

  // Get contextual advice
  const getContextualAdvice = useCallback(
    async (context: {
      currentTask?: Task;
      timeOfDay: Date;
      recentPerformance: 'high' | 'medium' | 'low';
      upcomingDeadlines: Task[];
    }) => {
      setIsGeneratingAdvice(true);
      setAdviceError(null);

      try {
        const advice = await service.provideContextualAdvice(userId, context);
        setContextualAdvice(advice);
      } catch (error) {
        setAdviceError(
          error instanceof Error ? error.message : 'Failed to generate advice'
        );
      } finally {
        setIsGeneratingAdvice(false);
      }
    },
    [service, userId]
  );

  // Clear all errors
  const clearErrors = useCallback(() => {
    setAnalysisError(null);
    setTipsError(null);
    setAdviceError(null);
  }, []);

  // Reset all state
  const reset = useCallback(() => {
    setWorkingStyle(null);
    setPatternAnalysis(null);
    setPersonalizedTips([]);
    setContextualAdvice([]);
    clearErrors();
  }, [clearErrors]);

  // Auto-analyze on mount if enabled
  useEffect(() => {
    if (autoAnalyze && userId) {
      analyzePatterns();
      refreshWorkingStyle();
    }
  }, [autoAnalyze, userId, analyzePatterns, refreshWorkingStyle]);

  // Auto-generate tips when pattern analysis completes
  useEffect(() => {
    if (
      patternAnalysis &&
      workingStyle &&
      personalizedTips &&
      personalizedTips.length === 0
    ) {
      generateTips();
    }
  }, [patternAnalysis, workingStyle, personalizedTips, generateTips]);

  return {
    // Data
    workingStyle,
    patternAnalysis,
    personalizedTips,
    contextualAdvice,

    // Loading states
    isAnalyzing,
    isGeneratingTips,
    isGeneratingAdvice,

    // Error states
    analysisError,
    tipsError,
    adviceError,

    // Actions
    analyzePatterns,
    generateTips,
    getContextualAdvice,
    refreshWorkingStyle,

    // Utilities
    clearErrors,
    reset,
  };
}

// Helper hook for getting quick insights about current context
export function useCurrentContextInsights(
  currentTask?: Task,
  recentPerformance: 'high' | 'medium' | 'low' = 'medium'
) {
  const [upcomingDeadlines, setUpcomingDeadlines] = useState<Task[]>([]);

  const {
    contextualAdvice,
    isGeneratingAdvice,
    getContextualAdvice,
    adviceError,
  } = useProductivityInsights('current-user', false);

  // Get contextual advice for current situation
  const getAdviceForNow = useCallback(async () => {
    await getContextualAdvice({
      currentTask,
      timeOfDay: new Date(),
      recentPerformance,
      upcomingDeadlines,
    });
  }, [currentTask, recentPerformance, upcomingDeadlines, getContextualAdvice]);

  // Auto-refresh advice when context changes
  useEffect(() => {
    getAdviceForNow();
  }, [getAdviceForNow]);

  return {
    advice: contextualAdvice,
    isLoading: isGeneratingAdvice,
    error: adviceError,
    refresh: getAdviceForNow,
    setUpcomingDeadlines,
  };
}

// Helper hook for working style insights
export function useWorkingStyleInsights() {
  const { workingStyle, refreshWorkingStyle, isAnalyzing, analysisError } =
    useProductivityInsights('current-user', true);

  const getBestWorkingHours = useCallback(() => {
    if (!workingStyle?.preferredWorkingHours) {
      return null;
    }

    return workingStyle.preferredWorkingHours.sort((a, b) => {
      // Sort by start time
      const aStart = parseInt(a.start.split(':')[0]);
      const bStart = parseInt(b.start.split(':')[0]);
      return aStart - bStart;
    });
  }, [workingStyle]);

  const getEnergyRecommendation = useCallback(
    (currentHour: number) => {
      if (!workingStyle?.energyLevels) {
        return null;
      }

      const currentEnergyPattern = workingStyle.energyLevels.find(pattern => {
        const startHour = parseInt(pattern.timeSlot.start.split(':')[0]);
        return startHour === currentHour;
      });

      if (!currentEnergyPattern) {
        return null;
      }

      if (currentEnergyPattern.averageEnergy > 80) {
        return {
          type: 'high-energy',
          message: 'Perfect time for challenging tasks!',
          energy: currentEnergyPattern.averageEnergy,
        };
      } else if (currentEnergyPattern.averageEnergy < 50) {
        return {
          type: 'low-energy',
          message: 'Consider lighter tasks or taking a break.',
          energy: currentEnergyPattern.averageEnergy,
        };
      } else {
        return {
          type: 'medium-energy',
          message: 'Good time for routine tasks.',
          energy: currentEnergyPattern.averageEnergy,
        };
      }
    },
    [workingStyle]
  );

  return {
    workingStyle,
    isLoading: isAnalyzing,
    error: analysisError,
    refresh: refreshWorkingStyle,
    getBestWorkingHours,
    getEnergyRecommendation,
  };
}

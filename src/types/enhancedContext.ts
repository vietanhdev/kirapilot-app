// Enhanced context types for AI interaction optimization

import { AppContext, Priority } from './index';

// Enhanced context interfaces
export interface EnhancedAppContext extends AppContext {
  workflowState: WorkflowState;
  productivityMetrics: ProductivityMetrics;
  recentPatterns: UserPattern[];
  contextualInsights: ContextualInsight[];
  environmentalFactors: EnvironmentalFactors;
}

export interface WorkflowState {
  currentPhase: 'planning' | 'executing' | 'reviewing' | 'break';
  focusLevel: number; // 1-10
  workloadIntensity: 'light' | 'moderate' | 'heavy' | 'overwhelming';
  timeInCurrentPhase: number; // minutes
  upcomingDeadlines: TaskDeadline[];
  recentTaskSwitches: number; // count in last hour
  currentStreak: WorkflowStreak;
}

export interface ProductivityMetrics {
  todayCompletionRate: number; // 0-1
  averageTaskDuration: number; // minutes
  focusSessionEfficiency: number; // 0-1
  breakPatternAdherence: number; // 0-1
  energyLevel: number; // 1-10
  tasksCompletedToday: number;
  timeSpentToday: number; // minutes
  distractionCount: number;
  productivityTrend: 'increasing' | 'stable' | 'decreasing';
}

export interface UserPattern {
  type:
    | 'productivity'
    | 'break'
    | 'task_switching'
    | 'focus'
    | 'energy'
    | 'scheduling';
  pattern: string;
  frequency: number; // times per day/week
  confidence: number; // 0-1
  lastObserved: Date;
  trend: 'increasing' | 'stable' | 'decreasing';
  contextualTriggers: string[]; // conditions that trigger this pattern
  impact: 'positive' | 'neutral' | 'negative';
}

export interface ContextualInsight {
  type:
    | 'optimization'
    | 'warning'
    | 'opportunity'
    | 'celebration'
    | 'suggestion';
  message: string;
  actionable: boolean;
  priority: Priority;
  confidence: number; // 0-1
  relatedData: Record<string, unknown>;
  expiresAt?: Date;
  category: 'productivity' | 'wellbeing' | 'efficiency' | 'planning';
}

export interface EnvironmentalFactors {
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  dayOfWeek: number; // 0-6, Sunday = 0
  isWorkingHours: boolean;
  upcomingMeetings: number;
  currentWeather?: WeatherInfo;
  systemLoad: 'low' | 'medium' | 'high';
  batteryLevel?: number; // 0-100 for mobile devices
  networkStatus: 'online' | 'offline' | 'limited';
}

export interface TaskDeadline {
  taskId: string;
  taskTitle: string;
  dueDate: Date;
  priority: Priority;
  hoursRemaining: number;
  estimatedTimeToComplete: number; // minutes
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface WorkflowStreak {
  type: 'focus' | 'productivity' | 'completion';
  count: number;
  startTime: Date;
  bestStreak: number;
  streakGoal?: number;
}

export interface WeatherInfo {
  condition: 'sunny' | 'cloudy' | 'rainy' | 'stormy' | 'snowy';
  temperature: number; // Celsius
  humidity: number; // 0-100
}

// Context relevance scoring
export interface ContextRelevanceScore {
  overall: number; // 0-1
  breakdown: {
    workflowState: number;
    productivityMetrics: number;
    recentPatterns: number;
    environmentalFactors: number;
    contextualInsights: number;
  };
  reasoning: string[];
  criticalFactors: string[];
}

export interface AIUserIntent {
  primary: string;
  secondary: string[];
  confidence: number; // 0-1
  category:
    | 'task_management'
    | 'time_tracking'
    | 'productivity'
    | 'planning'
    | 'analysis'
    | 'general';
  urgency: 'low' | 'medium' | 'high';
  complexity: 'simple' | 'moderate' | 'complex';
  requiresContext: boolean;
}

// Context aggregation configuration
export interface ContextAggregationConfig {
  includeHistoricalData: boolean;
  historicalDataDays: number;
  patternAnalysisDepth: 'shallow' | 'medium' | 'deep';
  environmentalDataSources: string[];
  privacyLevel: 'minimal' | 'standard' | 'comprehensive';
  cacheEnabled: boolean;
  cacheTTL: number; // seconds
}

// Context aggregation result
export interface ContextAggregationResult {
  enhancedContext: EnhancedAppContext;
  relevanceScore: ContextRelevanceScore;
  processingTime: number; // milliseconds
  dataSourcesUsed: string[];
  cacheHit: boolean;
  warnings: string[];
}

// Natural Language Understanding types for AI interaction optimization

import { EnhancedAppContext } from './enhancedContext';

// Enhanced NLU interfaces
export interface EnhancedNLU {
  extractUserIntent(
    message: string,
    context: EnhancedAppContext,
    conversationHistory: unknown[]
  ): Promise<IntentAnalysis>;

  identifyImplicitRequests(
    message: string,
    context: EnhancedAppContext
  ): Promise<ImplicitRequest[]>;

  detectEmotionalContext(
    message: string,
    recentInteractions: unknown[]
  ): EmotionalContext;

  analyzeMessageComplexity(
    message: string,
    context: EnhancedAppContext
  ): MessageComplexity;

  extractContextualCues(
    message: string,
    context: EnhancedAppContext
  ): ContextualCue[];
}

// Intent analysis result
export interface IntentAnalysis {
  primaryIntent: UserIntent;
  secondaryIntents: UserIntent[];
  confidence: number; // 0-1
  contextualFactors: string[];
  suggestedActions: string[];
  ambiguityLevel: 'low' | 'medium' | 'high';
  requiresClarification: boolean;
  clarificationQuestions: string[];
  intentCategory: IntentCategory;
  urgencyIndicators: UrgencyIndicator[];
}

// User intent with enhanced details
export interface UserIntent {
  type: IntentType;
  description: string;
  confidence: number; // 0-1
  parameters: Record<string, unknown>;
  contextDependency: 'none' | 'low' | 'medium' | 'high';
  timeframe: TimeframeIntent;
  scope: IntentScope;
  actionRequired: boolean;
}

// Intent types
export type IntentType =
  | 'create_task'
  | 'update_task'
  | 'delete_task'
  | 'query_tasks'
  | 'start_timer'
  | 'stop_timer'
  | 'analyze_productivity'
  | 'plan_schedule'
  | 'request_help'
  | 'express_frustration'
  | 'celebrate_achievement'
  | 'request_break'
  | 'optimize_workflow'
  | 'general_conversation'
  | 'clarification_request'
  | 'feedback_provision';

// Intent categories
export type IntentCategory =
  | 'task_management'
  | 'time_tracking'
  | 'productivity_analysis'
  | 'planning'
  | 'emotional_support'
  | 'system_interaction'
  | 'information_seeking'
  | 'workflow_optimization';

// Timeframe for intent
export interface TimeframeIntent {
  type: 'immediate' | 'today' | 'this_week' | 'future' | 'unspecified';
  specificTime?: Date;
  duration?: number; // minutes
  recurring?: boolean;
}

// Intent scope
export type IntentScope =
  | 'single_task'
  | 'multiple_tasks'
  | 'project'
  | 'entire_workflow'
  | 'personal_state';

// Urgency indicators
export interface UrgencyIndicator {
  type:
    | 'deadline_pressure'
    | 'emotional_state'
    | 'workload'
    | 'external_factor';
  level: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  confidence: number; // 0-1
}

// Implicit requests
export interface ImplicitRequest {
  type: ImplicitRequestType;
  description: string;
  confidence: number; // 0-1
  reasoning: string;
  suggestedAction: string;
  priority: 'low' | 'medium' | 'high';
  contextualEvidence: string[];
}

export type ImplicitRequestType =
  | 'need_break'
  | 'task_overwhelm'
  | 'schedule_optimization'
  | 'productivity_improvement'
  | 'emotional_support'
  | 'workflow_guidance'
  | 'time_management_help'
  | 'focus_assistance'
  | 'motivation_boost'
  | 'stress_relief';

// Emotional context detection
export interface EmotionalContext {
  primaryEmotion: EmotionType;
  emotionIntensity: number; // 1-10
  emotionalTrend: 'improving' | 'stable' | 'declining';
  stressLevel: number; // 1-10
  frustrationLevel: number; // 1-10
  satisfactionLevel: number; // 1-10
  motivationLevel: number; // 1-10
  confidenceLevel: number; // 1-10
  emotionalTriggers: EmotionalTrigger[];
  supportNeeded: boolean;
  recommendedResponse: EmotionalResponseStrategy;
}

export type EmotionType =
  | 'neutral'
  | 'happy'
  | 'frustrated'
  | 'stressed'
  | 'excited'
  | 'overwhelmed'
  | 'satisfied'
  | 'confused'
  | 'motivated'
  | 'tired'
  | 'anxious'
  | 'accomplished';

// Emotional triggers
export interface EmotionalTrigger {
  type:
    | 'workload'
    | 'deadline'
    | 'complexity'
    | 'interruption'
    | 'achievement'
    | 'setback';
  description: string;
  impact: 'positive' | 'negative' | 'neutral';
  intensity: number; // 1-10
}

// Emotional response strategy
export interface EmotionalResponseStrategy {
  approach:
    | 'supportive'
    | 'encouraging'
    | 'practical'
    | 'celebratory'
    | 'calming';
  tone: 'warm' | 'professional' | 'casual' | 'empathetic' | 'energetic';
  includeEmoji: boolean;
  suggestBreak: boolean;
  offerHelp: boolean;
  providePerspective: boolean;
}

// Message complexity analysis
export interface MessageComplexity {
  overallComplexity: 'simple' | 'moderate' | 'complex' | 'very_complex';
  factors: ComplexityFactor[];
  processingDifficulty: number; // 1-10
  multipleIntents: boolean;
  ambiguousLanguage: boolean;
  contextDependency: number; // 1-10
  technicalTerms: string[];
  emotionalComplexity: number; // 1-10
}

export interface ComplexityFactor {
  type:
    | 'multiple_intents'
    | 'ambiguous_language'
    | 'context_dependent'
    | 'technical_terms'
    | 'emotional_content'
    | 'temporal_references';
  description: string;
  impact: number; // 1-10
}

// Contextual cues
export interface ContextualCue {
  type: ContextualCueType;
  value: string;
  confidence: number; // 0-1
  relevance: number; // 0-1
  source:
    | 'message_content'
    | 'context_data'
    | 'conversation_history'
    | 'user_patterns';
}

export type ContextualCueType =
  | 'time_reference'
  | 'task_reference'
  | 'emotional_state'
  | 'workflow_phase'
  | 'productivity_concern'
  | 'scheduling_constraint'
  | 'priority_indicator'
  | 'completion_status'
  | 'collaboration_need'
  | 'resource_requirement';

// NLU configuration
export interface NLUConfig {
  enableMultiIntentDetection: boolean;
  enableImplicitRequestDetection: boolean;
  enableEmotionalContextDetection: boolean;
  emotionalSensitivity: 'low' | 'medium' | 'high';
  contextualAwarenessLevel: 'basic' | 'enhanced' | 'comprehensive';
  ambiguityTolerance: number; // 0-1
  confidenceThreshold: number; // 0-1
  maxSecondaryIntents: number;
  enablePatternLearning: boolean;
}

// NLU processing result
export interface NLUProcessingResult {
  intentAnalysis: IntentAnalysis;
  implicitRequests: ImplicitRequest[];
  emotionalContext: EmotionalContext;
  messageComplexity: MessageComplexity;
  contextualCues: ContextualCue[];
  processingTime: number; // milliseconds
  confidence: number; // 0-1
  warnings: string[];
  suggestions: NLUSuggestion[];
}

// NLU suggestions for improving understanding
export interface NLUSuggestion {
  type:
    | 'clarification'
    | 'context_request'
    | 'alternative_interpretation'
    | 'follow_up_question';
  message: string;
  priority: 'low' | 'medium' | 'high';
  reasoning: string;
}

// Pattern learning for NLU improvement
export interface NLUPattern {
  id: string;
  pattern: string;
  intentType: IntentType;
  confidence: number;
  usageCount: number;
  successRate: number;
  lastUsed: Date;
  contextualFactors: string[];
  userSpecific: boolean;
}

// NLU metrics for monitoring and improvement
export interface NLUMetrics {
  totalProcessed: number;
  averageConfidence: number;
  intentAccuracy: number;
  emotionalDetectionAccuracy: number;
  implicitRequestDetectionRate: number;
  averageProcessingTime: number;
  ambiguityResolutionRate: number;
  userSatisfactionScore: number;
}

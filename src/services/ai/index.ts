// AI Service exports - ReAct architecture with Model Management
export {
  ReactAIService,
  getReactAIService,
  initializeReactAIService,
} from './ReactAIService';

export { getKiraPilotTools } from './tools';
export {
  ToolExecutionEngine,
  PermissionLevel,
  getToolExecutionEngine,
  initializeToolExecutionEngine,
} from './ToolExecutionEngine';
export {
  ToolResultFormatter,
  getToolResultFormatter,
  initializeToolResultFormatter,
} from './ToolResultFormatter';
export {
  ToolRegistry,
  getToolRegistry,
  initializeToolRegistry,
} from './ToolRegistry';
export {
  ToolExecutionBridge,
  getToolExecutionBridge,
  initializeToolExecutionBridge,
} from './ToolExecutionBridge';
export type {
  ToolSchema,
  ParameterSchema,
  ToolExecutionContext,
  ToolValidationResult,
} from './ToolRegistry';
export type {
  ToolCall,
  LangChainExecutionContext,
  ToolExecutionBridgeError,
} from './ToolExecutionBridge';
export type {
  AIServiceInterface,
  ModelInfo,
  ModelStatus,
} from './AIServiceInterface';
export {
  AIServiceError,
  ModelNotAvailableError,
  ModelInitializationError,
  ModelProcessingError,
} from './AIServiceInterface';
export type { ModelType, ModelConfig } from './ModelManager';
export {
  ModelManager,
  getModelManager,
  initializeModelManager,
} from './ModelManager';
export { AIProvider, useAI } from '../../contexts/AIContext';
export { ChatUI } from '../../components/ai/ChatUI';
export { AIFloatingButton } from '../../components/ai/AIFloatingButton';
export { ExportService } from './ExportService';
export type {
  ExportOptions,
  ExportResult,
  ExportProgress,
} from './ExportService';

// Enhanced interaction logging
export {
  DetailedInteractionLogger,
  getDetailedInteractionLogger,
  initializeDetailedInteractionLogger,
} from './DetailedInteractionLogger';
export type {
  EnhancedRequestContext,
  EnhancedResponseMetadata,
  ProcessingStep,
} from './DetailedInteractionLogger';

// Performance monitoring
export {
  PerformanceMonitor,
  getPerformanceMonitor,
  initializePerformanceMonitor,
} from './PerformanceMonitor';
export type {
  PerformanceMetric,
  PerformanceThreshold,
  PerformanceReport,
  PerformanceAlert,
} from './PerformanceMonitor';

// Intelligent task matching
export { IntelligentTaskMatcher } from './IntelligentTaskMatcher';

// Confirmation service
export { ConfirmationService } from './ConfirmationService';

// Emotional intelligence service
export { EmotionalIntelligenceService } from './EmotionalIntelligenceService';
export { PersonalityService } from './PersonalityService';
export { ResponseTemplates } from './ResponseTemplates';

// Productivity insights service
export { ProductivityInsightsService } from './ProductivityInsightsService';
export type {
  WorkingStyle,
  ProductivityInsight,
  PersonalizedRecommendation,
} from './ProductivityInsightsService';
// Enhanced AI interaction optimization
export { getEnhancedNLU, EnhancedNLUService } from './EnhancedNLU';
export { ContextualContextAggregator } from './ContextualContextAggregator';
export type {
  IntentAnalysis,
  ImplicitRequest,
  EmotionalContext,
  MessageComplexity,
  ContextualCue,
  NLUProcessingResult,
  NLUConfig,
} from '../../types/naturalLanguageUnderstanding';
export type {
  EnhancedAppContext,
  WorkflowState,
  ProductivityMetrics,
  UserPattern,
  ContextualInsight,
  ContextRelevanceScore,
} from '../../types/enhancedContext';

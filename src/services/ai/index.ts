// AI Service exports - Backend architecture
// Backend AI Service - New architecture
export {
  BackendAIService,
  getBackendAIService,
  initializeBackendAIService,
  createBackendAIService,
  resetBackendAIService,
} from './BackendAIService';
export { getKiraPilotTools } from './tools';
export type { TranslationFunction, ToolExecutionResult } from './types';
export { PermissionLevel } from './types';
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

export { AIProvider, useAI } from '../../contexts/AIContext';
export { ChatUI } from '../../components/ai/ChatUI';
export { AIFloatingButton } from '../../components/ai/AIFloatingButton';
export { ExportService } from './ExportService';
export {
  diagnoseLocalModel,
  getLocalModelErrorMessage,
} from './LocalModelDiagnostics';
export type { LocalModelDiagnostics } from './LocalModelDiagnostics';
export type {
  ExportOptions,
  ExportResult,
  ExportProgress,
} from './ExportService';

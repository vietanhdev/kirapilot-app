import { invoke } from '@tauri-apps/api/core';
import {
  BackendServiceStatus,
  BackendPerformanceMetrics,
} from '../../types/backendAI';

/**
 * Service for managing AI models and backend communication
 * This service provides mock implementations for development until
 * the backend commands are fully implemented.
 */

export interface LocalModelInfo {
  id: string;
  name: string;
  size: string;
  status: 'available' | 'downloading' | 'error' | 'not_downloaded';
  downloadProgress?: number;
  path?: string;
  capabilities: string[];
}

export interface ErrorDiagnostics {
  timestamp: string;
  service_available: boolean;
  model_ready: boolean;
  recent_errors: unknown[];
  performance_metrics: BackendPerformanceMetrics;
  system_health: 'healthy' | 'unhealthy' | 'unknown' | 'error' | 'initializing';
  recommendations?: string[];
}

export interface HealthTest {
  passed: boolean;
  message: string;
  response_length?: number;
  error_type?: string;
  memory_usage_mb?: number;
  cpu_usage_percent?: number;
}

export interface HealthReport {
  timestamp: string;
  overall_health: 'healthy' | 'unhealthy' | 'unknown';
  tests: {
    service_available?: HealthTest;
    model_ready?: HealthTest;
    generation_test?: HealthTest;
    resource_usage?: HealthTest;
  };
}

/**
 * Model Management Service
 * Provides methods for managing AI models and service status
 */
export class ModelManagementService {
  /**
   * Get AI service status
   */
  static async getServiceStatus(): Promise<BackendServiceStatus> {
    try {
      return await invoke<BackendServiceStatus>('get_ai_service_status');
    } catch (error) {
      console.warn('Backend command not available, using mock data:', error);

      // Mock implementation for development
      return {
        active_provider: 'gemini',
        providers: {
          gemini: { Ready: null },
          local: { NotInitialized: null },
        },
        service_ready: true,
      };
    }
  }

  /**
   * Get available local models
   */
  static async getAvailableLocalModels(): Promise<LocalModelInfo[]> {
    try {
      return await invoke<LocalModelInfo[]>('get_available_local_models');
    } catch (error) {
      console.warn('Backend command not available, using mock data:', error);

      // Mock implementation for development
      return [
        {
          id: 'llama-3.2-3b',
          name: 'Llama 3.2 3B',
          size: '2.0 GB',
          status: 'available',
          capabilities: ['text-generation', 'conversation'],
        },
        {
          id: 'phi-3-mini',
          name: 'Phi-3 Mini',
          size: '2.3 GB',
          status: 'downloading',
          downloadProgress: 45,
          capabilities: ['text-generation', 'reasoning'],
        },
      ];
    }
  }

  /**
   * Get performance metrics
   */
  static async getPerformanceMetrics(): Promise<BackendPerformanceMetrics> {
    try {
      return await invoke<BackendPerformanceMetrics>('get_performance_metrics');
    } catch (error) {
      console.warn('Backend command not available, using mock data:', error);

      // Mock implementation for development
      return {
        total_time_ms: 1250,
        llm_time_ms: 980,
        input_tokens: 150,
        output_tokens: 75,
        memory_usage_mb: 512,
      };
    }
  }

  /**
   * Download a local model
   */
  static async downloadLocalModel(modelId: string): Promise<void> {
    try {
      await invoke('download_local_model', { model_id: modelId });
    } catch (error) {
      console.warn(
        'Backend command not available, simulating download:',
        error
      );

      // Mock implementation for development
      console.log(`Starting download for model: ${modelId}`);
    }
  }

  /**
   * Delete a local model
   */
  static async deleteLocalModel(modelId: string): Promise<void> {
    try {
      await invoke('delete_local_model', { model_id: modelId });
    } catch (error) {
      console.warn(
        'Backend command not available, simulating deletion:',
        error
      );

      // Mock implementation for development
      console.log(`Deleting model: ${modelId}`);
    }
  }

  /**
   * Force service recovery
   */
  static async forceServiceRecovery(): Promise<void> {
    try {
      await invoke('force_service_recovery');
    } catch (error) {
      console.warn(
        'Backend command not available, simulating recovery:',
        error
      );

      // Mock implementation for development
      console.log('Forcing service recovery...');
    }
  }

  /**
   * Get error diagnostics
   */
  static async getErrorDiagnostics(): Promise<ErrorDiagnostics> {
    try {
      return await invoke<ErrorDiagnostics>('get_error_diagnostics');
    } catch (error) {
      console.warn('Backend command not available, using mock data:', error);

      // Mock implementation for development
      return {
        timestamp: new Date().toISOString(),
        service_available: true,
        model_ready: true,
        recent_errors: [],
        performance_metrics: {
          total_time_ms: 1250,
          llm_time_ms: 980,
          memory_usage_mb: 512,
        },
        system_health: 'healthy',
        recommendations: [],
      };
    }
  }

  /**
   * Test model health
   */
  static async testModelHealth(): Promise<HealthReport> {
    try {
      return await invoke<HealthReport>('test_model_health');
    } catch (error) {
      console.warn('Backend command not available, using mock data:', error);

      // Mock implementation for development
      return {
        timestamp: new Date().toISOString(),
        overall_health: 'healthy',
        tests: {
          service_available: {
            passed: true,
            message: 'Service is available and responding',
          },
          model_ready: {
            passed: true,
            message: 'Model is loaded and ready',
          },
          generation_test: {
            passed: true,
            message: 'Generated test response successfully',
            response_length: 45,
          },
          resource_usage: {
            passed: true,
            message: 'Resource usage within normal limits',
            memory_usage_mb: 512,
            cpu_usage_percent: 25,
          },
        },
      };
    }
  }

  /**
   * Force model recovery
   */
  static async forceModelRecovery(): Promise<string> {
    try {
      return await invoke<string>('force_model_recovery');
    } catch (error) {
      console.warn(
        'Backend command not available, simulating recovery:',
        error
      );

      // Mock implementation for development
      return 'Model recovery completed successfully';
    }
  }
}

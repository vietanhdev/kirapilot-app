/**
 * TypeScript interfaces for backend AI communication
 *
 * These interfaces define the structure of requests and responses
 * between the frontend and the Rust backend AI service.
 */

/**
 * Request structure for backend AI message processing
 */
export interface BackendAIRequest {
  /** The user's message to process */
  message: string;

  /** Optional session identifier for conversation tracking */
  session_id?: string;

  /** Optional preferred model/provider */
  model_preference?: string;

  /** Additional context for the request */
  context: Record<string, unknown>;
}

/**
 * Response structure from backend AI service
 */
export interface BackendAIResponse {
  /** The AI's response message */
  message: string;

  /** Session identifier */
  session_id: string;

  /** Information about the model used */
  model_info: BackendModelInfo;

  /** Additional metadata about the response */
  metadata: Record<string, unknown>;
}

/**
 * Backend model information structure
 */
export interface BackendModelInfo {
  /** Unique model identifier */
  id: string;

  /** Human-readable model name */
  name: string;

  /** Provider name (e.g., "gemini", "local") */
  provider: string;

  /** Optional model version */
  version?: string;

  /** Optional maximum context length */
  max_context_length?: number;

  /** Additional model metadata */
  metadata: Record<string, unknown>;
}

/**
 * Backend service status structure
 */
export interface BackendServiceStatus {
  /** Currently active provider name */
  active_provider: string;

  /** Status of all available providers */
  providers: Record<string, BackendProviderStatus>;

  /** Whether the service is ready to process requests */
  service_ready: boolean;
}

/**
 * Backend provider status enum
 */
export type BackendProviderStatus =
  | { Ready: null }
  | { Loading: null }
  | { Error: string }
  | { NotInitialized: null };

/**
 * Backend interaction log structure
 */
export interface BackendInteractionLog {
  /** Unique log entry identifier */
  id: string;

  /** Session identifier */
  session_id: string;

  /** Timestamp in ISO format */
  timestamp: string;

  /** Original user message */
  user_message: string;

  /** AI response */
  ai_response: string;

  /** Model information used for the response */
  model_info: BackendModelInfo;

  /** Performance metrics for the interaction */
  performance_metrics: BackendPerformanceMetrics;
}

/**
 * Performance metrics from backend processing
 */
export interface BackendPerformanceMetrics {
  /** Total processing time in milliseconds */
  total_time_ms: number;

  /** LLM processing time in milliseconds */
  llm_time_ms: number;

  /** Optional input token count */
  input_tokens?: number;

  /** Optional output token count */
  output_tokens?: number;

  /** Optional memory usage in megabytes */
  memory_usage_mb?: number;
}

/**
 * Configuration for connection retry logic
 */
export interface BackendRetryConfig {
  /** Maximum number of retry attempts */
  maxRetries: number;

  /** Base delay between retries in milliseconds */
  baseDelayMs: number;

  /** Maximum delay between retries in milliseconds */
  maxDelayMs: number;

  /** Multiplier for exponential backoff */
  backoffMultiplier: number;
}

/**
 * Error response from backend
 */
export interface BackendErrorResponse {
  /** Error code */
  code: string;

  /** Human-readable error message */
  message: string;

  /** Whether the error is recoverable */
  recoverable: boolean;

  /** Additional error details */
  details?: Record<string, unknown>;
}

/**
 * Request to switch AI model/provider
 */
export interface BackendSwitchModelRequest {
  /** Target model type */
  model_type: 'local' | 'gemini';

  /** Optional configuration for the model */
  config?: Record<string, unknown>;
}

/**
 * Request to get interaction logs
 */
export interface BackendGetLogsRequest {
  /** Maximum number of logs to retrieve */
  limit?: number;

  /** Optional session ID filter */
  session_id?: string;

  /** Optional start timestamp filter */
  start_time?: string;

  /** Optional end timestamp filter */
  end_time?: string;
}

/**
 * Response for model information request
 */
export interface BackendModelInfoResponse {
  /** Current model information */
  model_info: BackendModelInfo;

  /** Model capabilities */
  capabilities: string[];

  /** Model status */
  status: BackendProviderStatus;
}

/**
 * Health check response from backend
 */
export interface BackendHealthResponse {
  /** Whether the service is healthy */
  healthy: boolean;

  /** Service version */
  version: string;

  /** Uptime in seconds */
  uptime_seconds: number;

  /** Additional health information */
  details: Record<string, unknown>;
}

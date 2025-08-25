import { Tool, DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import {
  ToolExecutionResult,
  PermissionLevel,
  TranslationFunction,
} from './ToolExecutionEngine';
import {
  ToolSchema,
  ParameterSchema,
  ToolValidationResult,
} from './ToolRegistry';

/**
 * Tool call format for parsing
 */
export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
  originalText: string;
}

/**
 * LangChain tool execution context
 */
export interface LangChainExecutionContext {
  toolName: string;
  arguments: Record<string, unknown>;
  permissions: PermissionLevel[];
  userId?: string;
  sessionId?: string;
}

/**
 * Bridge error types
 */
export class ToolExecutionBridgeError extends Error {
  constructor(
    message: string,
    public code: string,
    public toolName?: string
  ) {
    super(message);
    this.name = 'ToolExecutionBridgeError';
  }
}

/**
 * Tool execution bridge that converts between LangChain and internal formats
 * Handles result conversion, argument validation, and format conversion
 */
export class ToolExecutionBridge {
  // Translation function for future use
  // private _translationFunction?: TranslationFunction;

  constructor(_translationFunction?: TranslationFunction) {
    // Store translation function for future use
    // this._translationFunction = translationFunction;
  }

  /**
   * Convert LangChain tool result to ToolExecutionResult
   */
  convertLangChainResult(
    toolName: string,
    langChainResult: string | unknown,
    executionTime: number,
    context?: LangChainExecutionContext
  ): ToolExecutionResult {
    try {
      // Handle string results (most common from LangChain tools)
      let parsedResult: Record<string, unknown>;

      if (typeof langChainResult === 'string') {
        try {
          parsedResult = JSON.parse(langChainResult);
        } catch {
          // If parsing fails, treat as a simple success message
          parsedResult = {
            success: true,
            message: langChainResult,
            data: langChainResult,
          };
        }
      } else if (
        typeof langChainResult === 'object' &&
        langChainResult !== null
      ) {
        parsedResult = langChainResult as Record<string, unknown>;
      } else {
        // Handle primitive types
        parsedResult = {
          success: true,
          data: langChainResult,
          message: String(langChainResult),
        };
      }

      // Determine success status
      const success = parsedResult.success !== false && !parsedResult.error;

      // Generate user message
      const userMessage = this.generateUserMessage(
        toolName,
        parsedResult,
        success
      );

      return {
        success,
        data: parsedResult,
        error: success
          ? undefined
          : (parsedResult.error as string) || 'Tool execution failed',
        userMessage,
        requiresConfirmation: false, // LangChain tools don't typically require confirmation after execution
        metadata: {
          executionTime,
          toolName,
          permissions: context?.permissions || [],
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to convert LangChain result',
        userMessage: `❌ ${toolName} failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: {
          executionTime,
          toolName,
          permissions: context?.permissions || [],
        },
      };
    }
  }

  /**
   * Validate tool arguments against LangChain tool schema
   */
  validateToolArgs(
    tool:
      | Tool
      | DynamicStructuredTool<z.ZodSchema, string, string, z.ZodSchema>,
    args: Record<string, unknown>
  ): ToolValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // If the tool has a schema, validate against it
      if (tool.schema) {
        try {
          // Use Zod validation if available
          if (typeof tool.schema.parse === 'function') {
            tool.schema.parse(args);
          } else if (typeof tool.schema.safeParse === 'function') {
            const result = tool.schema.safeParse(args);
            if (!result.success) {
              errors.push(
                ...result.error.issues.map(
                  err => `${err.path.join('.')}: ${err.message}`
                )
              );
            }
          }
        } catch (validationError) {
          if (validationError instanceof z.ZodError) {
            errors.push(
              ...validationError.issues.map(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (err: any) => `${err.path.join('.')}: ${err.message}`
              )
            );
          } else {
            errors.push(
              `Validation failed: ${validationError instanceof Error ? validationError.message : 'Unknown error'}`
            );
          }
        }
      }

      // Basic type checking for common parameters
      this.performBasicValidation(tool.name, args, errors, warnings);
    } catch (error) {
      errors.push(
        `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Perform basic validation for common tool parameters
   */
  private performBasicValidation(
    toolName: string,
    args: Record<string, unknown>,
    errors: string[],
    warnings: string[]
  ): void {
    // Tool-specific validation
    switch (toolName) {
      case 'create_task':
        if (
          !args.title ||
          typeof args.title !== 'string' ||
          args.title.trim().length === 0
        ) {
          errors.push('title is required and must be a non-empty string');
        }
        if (
          args.priority !== undefined &&
          (typeof args.priority !== 'number' ||
            args.priority < 0 ||
            args.priority > 3)
        ) {
          errors.push('priority must be a number between 0 and 3');
        }
        if (
          args.timeEstimate !== undefined &&
          (typeof args.timeEstimate !== 'number' || args.timeEstimate <= 0)
        ) {
          warnings.push('timeEstimate should be a positive number');
        }
        break;

      case 'update_task':
        if (!args.taskId || typeof args.taskId !== 'string') {
          errors.push('taskId is required and must be a string');
        }
        if (!args.updates || typeof args.updates !== 'object') {
          errors.push('updates is required and must be an object');
        }
        break;

      case 'start_timer':
        if (!args.taskId || typeof args.taskId !== 'string') {
          errors.push('taskId is required and must be a string');
        }
        break;

      case 'stop_timer':
        if (!args.sessionId || typeof args.sessionId !== 'string') {
          errors.push('sessionId is required and must be a string');
        }
        break;

      case 'get_time_data':
        if (!args.startDate || typeof args.startDate !== 'string') {
          errors.push('startDate is required and must be a string');
        }
        if (!args.endDate || typeof args.endDate !== 'string') {
          errors.push('endDate is required and must be a string');
        }
        // Validate date format
        if (args.startDate && typeof args.startDate === 'string') {
          const startDate = new Date(args.startDate);
          if (isNaN(startDate.getTime())) {
            errors.push('startDate must be a valid ISO date string');
          }
        }
        if (args.endDate && typeof args.endDate === 'string') {
          const endDate = new Date(args.endDate);
          if (isNaN(endDate.getTime())) {
            errors.push('endDate must be a valid ISO date string');
          }
        }
        break;

      case 'get_tasks':
        if (args.filters && typeof args.filters !== 'object') {
          errors.push('filters must be an object');
        }
        break;
    }
  }

  /**
   * Format tool call for LangChain execution
   */
  formatToolCall(toolName: string, args: Record<string, unknown>): string {
    try {
      // Create a clean, formatted representation
      const formattedArgs = this.sanitizeArguments(args);
      return `${toolName}(${JSON.stringify(formattedArgs)})`;
    } catch (error) {
      throw new ToolExecutionBridgeError(
        `Failed to format tool call: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'FORMAT_ERROR',
        toolName
      );
    }
  }

  /**
   * Parse tool call from various string formats
   */
  parseToolCall(input: string): ToolCall[] {
    const toolCalls: ToolCall[] = [];

    // Pattern 1: TOOL_CALL: tool_name(args)
    const toolCallRegex = /TOOL_CALL:\s*(\w+)\((.*?)\)/g;
    let match;

    while ((match = toolCallRegex.exec(input)) !== null) {
      const toolName = match[1];
      const argsString = match[2];
      const originalText = match[0];

      try {
        const args = this.parseArguments(argsString);
        toolCalls.push({ name: toolName, args, originalText });
      } catch (error) {
        console.warn(`Failed to parse tool call ${toolName}:`, error);
      }
    }

    // Pattern 2: JSON-like tool calls
    const jsonToolRegex =
      /\{\s*"tool"\s*:\s*"(\w+)"\s*,\s*"args"\s*:\s*(\{[^}]*\})\s*\}/g;

    while ((match = jsonToolRegex.exec(input)) !== null) {
      const toolName = match[1];
      const argsJson = match[2];
      const originalText = match[0];

      try {
        const args = JSON.parse(argsJson);
        toolCalls.push({ name: toolName, args, originalText });
      } catch (error) {
        console.warn(`Failed to parse JSON tool call ${toolName}:`, error);
      }
    }

    // Pattern 3: Function call style
    const functionCallRegex = /(?:^|\n)\s*(\w+)\((.*?)\)(?:\s*$|\s*\n)/g;

    while ((match = functionCallRegex.exec(input)) !== null) {
      const toolName = match[1];
      const argsString = match[2];
      const originalText = match[0];

      // Only process known tool names to avoid false positives
      if (this.isKnownTool(toolName)) {
        try {
          const args = this.parseArguments(argsString);
          toolCalls.push({ name: toolName, args, originalText });
        } catch (error) {
          console.warn(`Failed to parse function call ${toolName}:`, error);
        }
      }
    }

    return toolCalls;
  }

  /**
   * Parse arguments from string format
   */
  private parseArguments(argsString: string): Record<string, unknown> {
    const args: Record<string, unknown> = {};

    // Try JSON parsing first
    try {
      return JSON.parse(argsString);
    } catch {
      // Fall back to key-value parsing
    }

    // Handle empty arguments
    if (!argsString.trim()) {
      return {};
    }

    // Pattern: key="value" or key='value'
    const quotedArgRegex = /(\w+)\s*=\s*["']([^"']*?)["']/g;
    let match;

    while ((match = quotedArgRegex.exec(argsString)) !== null) {
      const key = match[1];
      let value: unknown = match[2];

      // Try to parse as JSON for complex values
      try {
        value = JSON.parse(match[2]);
      } catch {
        // Keep as string if not valid JSON
      }

      args[key] = value;
    }

    // Pattern: key=value (unquoted)
    const unquotedArgRegex = /(\w+)\s*=\s*([^,\s)]+)/g;

    while ((match = unquotedArgRegex.exec(argsString)) !== null) {
      const key = match[1];
      let value: unknown = match[2];

      // Convert to appropriate type
      if (value === 'true') {
        value = true;
      } else if (value === 'false') {
        value = false;
      } else if (!isNaN(Number(value))) {
        value = Number(value);
      }

      // Only add if not already present from quoted parsing
      if (!(key in args)) {
        args[key] = value;
      }
    }

    return args;
  }

  /**
   * Sanitize arguments for safe serialization
   */
  private sanitizeArguments(
    args: Record<string, unknown>
  ): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(args)) {
      if (value === undefined) {
        continue; // Skip undefined values
      }

      if (
        value === null ||
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
      ) {
        sanitized[key] = value;
      } else if (Array.isArray(value)) {
        sanitized[key] = value.map(item =>
          typeof item === 'object'
            ? this.sanitizeArguments(item as Record<string, unknown>)
            : item
        );
      } else if (typeof value === 'object') {
        sanitized[key] = this.sanitizeArguments(
          value as Record<string, unknown>
        );
      } else {
        // Convert other types to string
        sanitized[key] = String(value);
      }
    }

    return sanitized;
  }

  /**
   * Generate user-friendly message from tool result
   */
  private generateUserMessage(
    toolName: string,
    result: Record<string, unknown>,
    success: boolean
  ): string {
    if (!success) {
      const error = (result.error as string) || 'Unknown error';
      return `❌ ${this.getToolDisplayName(toolName)} failed: ${error}`;
    }

    // Generate success messages based on tool type
    switch (toolName) {
      case 'create_task':
        const task = result.task as Record<string, unknown>;
        return `✅ Created task: **${task?.title || 'New task'}**`;

      case 'update_task':
        const updatedTask = result.task as Record<string, unknown>;
        return `✅ Updated task: **${updatedTask?.title || 'Task'}**`;

      case 'get_tasks':
        const tasks = (result.tasks as unknown[]) || [];
        const count = (result.count as number) || tasks.length;
        return `📝 Found ${count} task${count === 1 ? '' : 's'}`;

      case 'start_timer':
        return `⏱️ Timer started successfully`;

      case 'stop_timer':
        const session = result.session as Record<string, unknown>;
        const duration = session?.duration as number;
        if (duration) {
          const minutes = Math.round(duration / (1000 * 60));
          return `⏹️ Timer stopped (${minutes} minute${minutes === 1 ? '' : 's'})`;
        }
        return `⏹️ Timer stopped`;

      case 'get_time_data':
        const timeData = result.timeData as Record<string, unknown>;
        const totalSessions = (timeData?.totalSessions as number) || 0;
        return `📊 Retrieved time data (${totalSessions} session${totalSessions === 1 ? '' : 's'})`;

      case 'analyze_productivity':
        return `📈 Productivity analysis completed`;

      default:
        return `✅ ${this.getToolDisplayName(toolName)} completed successfully`;
    }
  }

  /**
   * Get display name for tool
   */
  private getToolDisplayName(toolName: string): string {
    const displayNames: Record<string, string> = {
      create_task: 'Create Task',
      update_task: 'Update Task',
      get_tasks: 'Get Tasks',
      start_timer: 'Start Timer',
      stop_timer: 'Stop Timer',
      get_time_data: 'Get Time Data',
      analyze_productivity: 'Analyze Productivity',
    };

    return displayNames[toolName] || toolName.replace(/_/g, ' ');
  }

  // Utility methods for future use
  // private _isDataModifyingTool(toolName: string): boolean {
  //   const modifyingTools = ['create_task', 'update_task', 'start_timer', 'stop_timer'];
  //   return modifyingTools.includes(toolName);
  // }

  // private _getToolVersion(_toolName: string): string {
  //   return '1.0.0'; // Default version
  // }

  /**
   * Check if tool name is known
   */
  private isKnownTool(toolName: string): boolean {
    const knownTools = [
      'create_task',
      'update_task',
      'get_tasks',
      'start_timer',
      'stop_timer',
      'get_time_data',
      'analyze_productivity',
    ];
    return knownTools.includes(toolName);
  }

  /**
   * Set translation function
   */
  setTranslationFunction(_translationFunction: TranslationFunction): void {
    // Store translation function for future use
    // this._translationFunction = translationFunction;
  }

  /**
   * Convert internal ToolExecutionResult to LangChain format
   */
  convertToLangChainFormat(result: ToolExecutionResult): string {
    const langChainResult = {
      success: result.success,
      data: result.data,
      error: result.error,
      message: result.userMessage,
      metadata: result.metadata,
    };

    return JSON.stringify(langChainResult);
  }

  /**
   * Extract tool schema from LangChain tool
   */
  extractToolSchema(
    tool: Tool | DynamicStructuredTool<z.ZodSchema, string, string, z.ZodSchema>
  ): ToolSchema {
    const schema: ToolSchema = {
      name: tool.name,
      description: tool.description,
      parameters: {},
      requiredPermissions: this.inferPermissions(tool.name),
    };

    // Extract parameters from Zod schema if available
    if (tool.schema) {
      try {
        schema.parameters = this.extractParametersFromZodSchema(
          tool.schema as z.ZodType
        );
      } catch (error) {
        console.warn(`Failed to extract schema for tool ${tool.name}:`, error);
      }
    }

    return schema;
  }

  /**
   * Extract parameters from Zod schema
   */
  private extractParametersFromZodSchema(
    zodSchema: z.ZodType
  ): Record<string, ParameterSchema> {
    const parameters: Record<string, ParameterSchema> = {};

    if (zodSchema instanceof z.ZodObject) {
      const shape = zodSchema.shape;

      for (const [key, value] of Object.entries(shape)) {
        parameters[key] = this.zodTypeToParameterSchema(value as z.ZodType);
      }
    }

    return parameters;
  }

  /**
   * Convert Zod type to parameter schema
   */
  private zodTypeToParameterSchema(zodType: z.ZodType): ParameterSchema {
    // Handle optional types
    if (zodType instanceof z.ZodOptional) {
      const innerSchema = this.zodTypeToParameterSchema(
        zodType._def.innerType as z.ZodType
      );
      return { ...innerSchema, required: false };
    }

    // Handle string types
    if (zodType instanceof z.ZodString) {
      return {
        type: 'string',
        description: zodType.description || '',
        required: true,
      };
    }

    // Handle number types
    if (zodType instanceof z.ZodNumber) {
      return {
        type: 'number',
        description: zodType.description || '',
        required: true,
      };
    }

    // Handle boolean types
    if (zodType instanceof z.ZodBoolean) {
      return {
        type: 'boolean',
        description: zodType.description || '',
        required: true,
      };
    }

    // Handle array types
    if (zodType instanceof z.ZodArray) {
      return {
        type: 'array',
        description: zodType.description || '',
        required: true,
        items: this.zodTypeToParameterSchema(
          zodType._def.type as unknown as z.ZodType
        ),
      };
    }

    // Handle object types
    if (zodType instanceof z.ZodObject) {
      return {
        type: 'object',
        description: zodType.description || '',
        required: true,
        properties: this.extractParametersFromZodSchema(zodType),
      };
    }

    // Handle enum types
    if (zodType instanceof z.ZodEnum) {
      return {
        type: 'string',
        description: zodType.description || '',
        required: true,
        enum: zodType.options as string[],
      };
    }

    // Default fallback
    return {
      type: 'string',
      description: zodType.description || '',
      required: true,
    };
  }

  /**
   * Infer required permissions based on tool name
   */
  private inferPermissions(toolName: string): PermissionLevel[] {
    const readOnlyTools = [
      'get_tasks',
      'get_time_data',
      'analyze_productivity',
    ];
    const modifyTasksTools = ['create_task', 'update_task'];
    const timerControlTools = ['start_timer', 'stop_timer'];

    if (readOnlyTools.includes(toolName)) {
      return [PermissionLevel.READ_ONLY];
    }

    if (modifyTasksTools.includes(toolName)) {
      return [PermissionLevel.MODIFY_TASKS];
    }

    if (timerControlTools.includes(toolName)) {
      return [PermissionLevel.TIMER_CONTROL];
    }

    return [PermissionLevel.FULL_ACCESS];
  }
}

/**
 * Default tool execution bridge instance
 */
let defaultBridge: ToolExecutionBridge | null = null;

/**
 * Get default tool execution bridge
 */
export function getToolExecutionBridge(): ToolExecutionBridge {
  if (!defaultBridge) {
    defaultBridge = new ToolExecutionBridge();
  }
  return defaultBridge;
}

/**
 * Initialize tool execution bridge with translation function
 */
export function initializeToolExecutionBridge(
  translationFunction?: TranslationFunction
): ToolExecutionBridge {
  defaultBridge = new ToolExecutionBridge(translationFunction);
  return defaultBridge;
}

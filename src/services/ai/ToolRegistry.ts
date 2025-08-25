import { Tool, DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { getKiraPilotTools } from './tools';
import {
  ToolExecutionResult,
  TranslationFunction,
} from './ToolExecutionEngine';

// Define PermissionLevel locally to avoid circular dependency
enum PermissionLevel {
  READ_ONLY = 'read_only',
  MODIFY_TASKS = 'modify_tasks',
  TIMER_CONTROL = 'timer_control',
  FULL_ACCESS = 'full_access',
}

/**
 * Tool schema definition for validation
 */
export interface ToolSchema {
  name: string;
  description: string;
  parameters: Record<string, ParameterSchema>;
  requiredPermissions: PermissionLevel[];
}

/**
 * Parameter schema for tool validation
 */
export interface ParameterSchema {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required: boolean;
  enum?: string[];
  format?: string;
  items?: ParameterSchema; // For array types
  properties?: Record<string, ParameterSchema>; // For object types
}

/**
 * Tool execution context
 */
export interface ToolExecutionContext {
  permissions: PermissionLevel[];
  userId?: string;
  sessionId?: string;
  timestamp: Date;
}

/**
 * Tool validation result
 */
export interface ToolValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Tool registry error types
 */
export class ToolRegistryError extends Error {
  constructor(
    message: string,
    public code: string,
    public toolName?: string
  ) {
    super(message);
    this.name = 'ToolRegistryError';
  }
}

/**
 * Tool registry that bridges LangChain tools with Local LLM
 * Provides tool registration, validation, and execution capabilities
 */
export class ToolRegistry {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private tools: Map<string, Tool | DynamicStructuredTool<any, any, any, any>> =
    new Map();
  private schemas: Map<string, ToolSchema> = new Map();

  private initialized = false;

  constructor(translationFunction?: TranslationFunction) {
    // Translation function is available for future use
    if (translationFunction) {
      // Store for future use if needed
    }
    // Delay initialization to avoid circular dependency issues
  }

  /**
   * Initialize with KiraPilot tools from tools.ts
   */
  private initializeKiraPilotTools(): void {
    if (this.initialized) {
      return;
    }

    const kiraPilotTools = getKiraPilotTools();

    kiraPilotTools.forEach(tool => {
      this.registerTool(tool.name, tool);
    });

    this.initialized = true;
  }

  /**
   * Ensure tools are initialized before use
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      this.initializeKiraPilotTools();
    }
  }

  /**
   * Register a tool with the registry
   */
  registerTool(
    name: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tool: Tool | DynamicStructuredTool<any, any, any, any>
  ): void {
    if (this.tools.has(name)) {
      throw new ToolRegistryError(
        `Tool '${name}' is already registered`,
        'TOOL_ALREADY_EXISTS',
        name
      );
    }

    this.tools.set(name, tool);

    // Generate schema from tool definition
    const schema = this.generateSchemaFromTool(tool);
    this.schemas.set(name, schema);
  }

  /**
   * Generate tool schema from LangChain tool definition
   */
  private generateSchemaFromTool(
    tool: Tool | DynamicStructuredTool<z.ZodSchema, string, string, z.ZodSchema>
  ): ToolSchema {
    const schema: ToolSchema = {
      name: tool.name,
      description: tool.description,
      parameters: {},
      requiredPermissions: this.inferPermissions(tool.name),
    };

    // Extract parameters from Zod schema if available
    if (tool.schema && typeof tool.schema === 'object') {
      try {
        schema.parameters = this.extractParametersFromZodSchema(
          tool.schema as z.ZodType
        );
      } catch (error) {
        console.warn(`Failed to extract schema for tool ${tool.name}:`, error);
        schema.parameters = {};
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

    // Handle enum types first (before string types)
    if (zodType._def && 'values' in zodType._def) {
      return {
        type: 'string',
        description: zodType.description || '',
        required: true,
        enum: zodType._def.values as string[],
      };
    }

    // Handle string types
    if (zodType instanceof z.ZodString) {
      const schema: ParameterSchema = {
        type: 'string',
        description: zodType.description || '',
        required: true,
      };

      // Check for enum values in checks
      if (zodType._def.checks) {
        const enumCheck = zodType._def.checks.find(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (check: any) => check.kind === 'includes'
        );
        if (enumCheck && 'options' in enumCheck) {
          schema.enum = enumCheck.options as string[];
        }
      }

      return schema;
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

    // Default to full access for unknown tools
    return [PermissionLevel.FULL_ACCESS];
  }

  /**
   * Execute a tool with the given arguments
   */
  async executeTool(
    name: string,
    args: Record<string, unknown>,
    context?: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    this.ensureInitialized();
    const startTime = Date.now();

    try {
      // Check if tool exists
      const tool = this.tools.get(name);

      if (!tool) {
        throw new ToolRegistryError(
          `Tool '${name}' not found`,
          'TOOL_NOT_FOUND',
          name
        );
      }

      // Validate arguments
      const validation = this.validateToolArguments(name, args);
      if (!validation.isValid) {
        throw new ToolRegistryError(
          `Invalid arguments for tool '${name}': ${validation.errors.join(', ')}`,
          'INVALID_ARGUMENTS',
          name
        );
      }

      // Validate permissions if context provided
      if (context) {
        const schema = this.schemas.get(name);
        if (
          schema &&
          !this.hasRequiredPermissions(
            context.permissions,
            schema.requiredPermissions
          )
        ) {
          throw new ToolRegistryError(
            `Insufficient permissions for tool '${name}'`,
            'INSUFFICIENT_PERMISSIONS',
            name
          );
        }
      }

      // Execute the tool
      const result = await tool.invoke(args);
      const executionTime = Date.now() - startTime;

      // Parse the result
      let parsedResult: Record<string, unknown>;
      try {
        parsedResult = typeof result === 'string' ? JSON.parse(result) : result;
      } catch {
        // If parsing fails, wrap the result
        parsedResult = { success: true, data: result };
      }

      return {
        success: parsedResult.success !== false,
        data: parsedResult,
        userMessage: this.generateUserMessage(name, parsedResult),
        metadata: {
          executionTime,
          toolName: name,
          permissions: context?.permissions || [],
        },
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      if (error instanceof ToolRegistryError) {
        return {
          success: false,
          error: error.message,
          userMessage: this.generateErrorMessage(name, error.message),
          metadata: {
            executionTime,
            toolName: name,
            permissions: context?.permissions || [],
          },
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        userMessage: this.generateErrorMessage(
          name,
          error instanceof Error ? error.message : 'Unknown error'
        ),
        metadata: {
          executionTime,
          toolName: name,
          permissions: context?.permissions || [],
        },
      };
    }
  }

  /**
   * Validate tool arguments against schema
   */
  validateToolArguments(
    toolName: string,
    args: Record<string, unknown>
  ): ToolValidationResult {
    const schema = this.schemas.get(toolName);
    if (!schema) {
      return {
        isValid: false,
        errors: [`No schema found for tool '${toolName}'`],
        warnings: [],
      };
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required parameters
    for (const [paramName, paramSchema] of Object.entries(schema.parameters)) {
      if (paramSchema.required && !(paramName in args)) {
        errors.push(`Missing required parameter: ${paramName}`);
        continue;
      }

      if (paramName in args) {
        const value = args[paramName];
        const typeValidation = this.validateParameterType(
          paramName,
          value,
          paramSchema
        );

        if (!typeValidation.isValid) {
          errors.push(...typeValidation.errors);
        }
        warnings.push(...typeValidation.warnings);
      }
    }

    // Check for unknown parameters
    for (const argName of Object.keys(args)) {
      if (!(argName in schema.parameters)) {
        warnings.push(`Unknown parameter: ${argName}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate parameter type
   */
  private validateParameterType(
    paramName: string,
    value: unknown,
    schema: ParameterSchema
  ): ToolValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Type validation
    switch (schema.type) {
      case 'string':
        if (typeof value !== 'string') {
          errors.push(`Parameter '${paramName}' must be a string`);
        } else if (schema.enum && !schema.enum.includes(value)) {
          errors.push(
            `Parameter '${paramName}' must be one of: ${schema.enum.join(', ')}`
          );
        }
        break;

      case 'number':
        if (typeof value !== 'number' || isNaN(value)) {
          errors.push(`Parameter '${paramName}' must be a valid number`);
        }
        break;

      case 'boolean':
        if (typeof value !== 'boolean') {
          errors.push(`Parameter '${paramName}' must be a boolean`);
        }
        break;

      case 'array':
        if (!Array.isArray(value)) {
          errors.push(`Parameter '${paramName}' must be an array`);
        } else if (schema.items) {
          // Validate array items
          value.forEach((item, index) => {
            const itemValidation = this.validateParameterType(
              `${paramName}[${index}]`,
              item,
              schema.items!
            );
            errors.push(...itemValidation.errors);
            warnings.push(...itemValidation.warnings);
          });
        }
        break;

      case 'object':
        if (
          typeof value !== 'object' ||
          value === null ||
          Array.isArray(value)
        ) {
          errors.push(`Parameter '${paramName}' must be an object`);
        } else if (schema.properties) {
          // Validate object properties
          const objValue = value as Record<string, unknown>;
          for (const [propName, propSchema] of Object.entries(
            schema.properties
          )) {
            if (propSchema.required && !(propName in objValue)) {
              errors.push(
                `Missing required property '${propName}' in parameter '${paramName}'`
              );
            } else if (propName in objValue) {
              const propValidation = this.validateParameterType(
                `${paramName}.${propName}`,
                objValue[propName],
                propSchema
              );
              errors.push(...propValidation.errors);
              warnings.push(...propValidation.warnings);
            }
          }
        }
        break;
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Check if user has required permissions
   */
  private hasRequiredPermissions(
    userPermissions: PermissionLevel[],
    requiredPermissions: PermissionLevel[]
  ): boolean {
    // Full access grants all permissions
    if (userPermissions.includes(PermissionLevel.FULL_ACCESS)) {
      return true;
    }

    // Check if user has all required permissions
    return requiredPermissions.every(required =>
      userPermissions.includes(required)
    );
  }

  /**
   * Generate user-friendly message from tool result
   */
  private generateUserMessage(
    toolName: string,
    result: Record<string, unknown>
  ): string {
    if (result.success === false) {
      return `❌ ${toolName} failed: ${result.error || 'Unknown error'}`;
    }

    // Use existing success messages or generate generic ones
    switch (toolName) {
      case 'create_task':
        const task = result.task as Record<string, unknown>;
        return `✅ Created task: ${task?.title || 'New task'}`;

      case 'update_task':
        return `✅ Task updated successfully`;

      case 'get_tasks':
        const tasks = result.tasks as unknown[];
        return `📝 Retrieved ${tasks?.length || 0} tasks`;

      case 'start_timer':
        return `⏱️ Timer started`;

      case 'stop_timer':
        return `⏹️ Timer stopped`;

      case 'get_time_data':
        return `📊 Time data retrieved`;

      case 'analyze_productivity':
        return `📈 Productivity analysis complete`;

      default:
        return `✅ ${toolName} executed successfully`;
    }
  }

  /**
   * Generate error message
   */
  private generateErrorMessage(toolName: string, error: string): string {
    return `❌ ${toolName} failed: ${error}`;
  }

  /**
   * Get list of available tools
   */
  getAvailableTools(): string[] {
    this.ensureInitialized();
    return Array.from(this.tools.keys());
  }

  /**
   * Get tool schema
   */
  getToolSchema(name: string): ToolSchema | undefined {
    this.ensureInitialized();
    return this.schemas.get(name);
  }

  /**
   * Get all tool schemas
   */
  getAllSchemas(): Map<string, ToolSchema> {
    return new Map(this.schemas);
  }

  /**
   * Check if tool exists
   */
  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Remove a tool from the registry
   */
  unregisterTool(name: string): boolean {
    const removed = this.tools.delete(name);
    this.schemas.delete(name);
    return removed;
  }

  /**
   * Clear all tools
   */
  clear(): void {
    this.tools.clear();
    this.schemas.clear();
    this.initialized = false;
  }

  /**
   * Set translation function
   */
  setTranslationFunction(_translationFunction: TranslationFunction): void {
    // Translation function is stored for future use but not currently used in this implementation
  }

  /**
   * Get tool information for display
   */
  getToolInfo(name: string):
    | {
        name: string;
        description: string;
        parameters: Record<string, ParameterSchema>;
        requiredPermissions: PermissionLevel[];
      }
    | undefined {
    this.ensureInitialized();
    const schema = this.schemas.get(name);
    if (!schema) {
      return undefined;
    }

    return {
      name: schema.name,
      description: schema.description,
      parameters: schema.parameters,
      requiredPermissions: schema.requiredPermissions,
    };
  }
}

/**
 * Default tool registry instance
 */
let defaultRegistry: ToolRegistry | null = null;

/**
 * Get default tool registry
 */
export function getToolRegistry(): ToolRegistry {
  if (!defaultRegistry) {
    defaultRegistry = new ToolRegistry();
  }
  return defaultRegistry;
}

/**
 * Initialize tool registry with translation function
 */
export function initializeToolRegistry(
  translationFunction?: TranslationFunction
): ToolRegistry {
  defaultRegistry = new ToolRegistry(translationFunction);
  return defaultRegistry;
}

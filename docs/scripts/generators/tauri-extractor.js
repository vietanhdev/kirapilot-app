/**
 * Tauri Command Documentation Generator
 *
 * Extracts Tauri commands from Rust source code and generates comprehensive
 * API documentation with parameter types, return types, and usage examples.
 */

const fs = require('fs');
const path = require('path');

/**
 * Generate Tauri command documentation
 */
async function generateTauriDocs(config) {
  const libFile = path.join(config.tauriDir, 'src/lib.rs');

  if (!fs.existsSync(libFile)) {
    throw new Error(`Tauri lib.rs not found: ${libFile}`);
  }

  const sourceCode = fs.readFileSync(libFile, 'utf8');
  const commands = extractTauriCommands(sourceCode);

  // Also extract repository types for better documentation
  const repositoryTypes = await extractRepositoryTypes(config.tauriDir);

  // Generate markdown documentation
  const markdownContent = generateTauriMarkdown(commands, repositoryTypes);

  // Write to output file
  const outputFile = path.join(config.outputDir, 'tauri-commands.md');
  fs.writeFileSync(outputFile, markdownContent);

  console.log(`✅ Generated Tauri command documentation: ${outputFile}`);

  return { commands, repositoryTypes };
}

/**
 * Extract Tauri commands from Rust source code
 */
function extractTauriCommands(sourceCode) {
  const commands = [];

  // Regex to match Tauri command functions
  const commandRegex =
    /#\[tauri::command\]\s*(?:async\s+)?fn\s+(\w+)\s*\((.*?)\)\s*->\s*([^{]+)\s*\{/gs;

  let match;
  while ((match = commandRegex.exec(sourceCode)) !== null) {
    const [, name, params, returnType] = match;

    // Extract function body to understand what it does
    const functionStart = match.index + match[0].length - 1;
    const functionBody = extractFunctionBody(sourceCode, functionStart);

    // Parse parameters
    const parameters = parseParameters(params);

    // Determine category based on function name and body
    const category = categorizeCommand(name, functionBody);

    // Extract documentation comment
    const docComment = extractDocComment(sourceCode, match.index);

    commands.push({
      name,
      parameters,
      returnType: returnType.trim(),
      category,
      description: docComment || generateDescription(name, category),
      example: generateExample(name, parameters, returnType.trim()),
      body: functionBody.substring(0, 200) + '...', // First 200 chars for context
    });
  }

  return commands;
}

/**
 * Extract function body (simplified - just get a reasonable chunk)
 */
function extractFunctionBody(sourceCode, startIndex) {
  let braceCount = 1;
  let index = startIndex + 1;

  while (index < sourceCode.length && braceCount > 0) {
    if (sourceCode[index] === '{') {
      braceCount++;
    } else if (sourceCode[index] === '}') {
      braceCount--;
    }
    index++;
  }

  return sourceCode.substring(startIndex + 1, index - 1);
}

/**
 * Parse function parameters
 */
function parseParameters(paramString) {
  if (!paramString.trim()) return [];

  const params = [];
  const paramParts = paramString.split(',').map(p => p.trim());

  paramParts.forEach(param => {
    // Handle different parameter patterns
    const patterns = [
      // request: CreateTaskRequest
      /^(\w+):\s*(.+)$/,
      // id: String
      /^(\w+):\s*(\w+)$/,
      // name: &str
      /^(\w+):\s*&(\w+)$/,
    ];

    for (const pattern of patterns) {
      const match = param.match(pattern);
      if (match) {
        const [, name, type] = match;
        params.push({
          name,
          type: type.trim(),
          required: !type.includes('Option'),
          description: generateParamDescription(name, type),
        });
        break;
      }
    }
  });

  return params;
}

/**
 * Categorize commands based on name and functionality
 */
function categorizeCommand(name, body) {
  if (name.includes('task') || body.includes('TaskRepository')) {
    return 'Task Management';
  }
  if (
    name.includes('time') ||
    name.includes('session') ||
    body.includes('TimeTrackingRepository')
  ) {
    return 'Time Tracking';
  }
  if (name.includes('ai') || body.includes('AiRepository')) {
    return 'AI Interactions';
  }
  if (name.includes('task_list') || body.includes('TaskListRepository')) {
    return 'Task Lists';
  }
  if (
    name.includes('database') ||
    name.includes('migration') ||
    name.includes('health')
  ) {
    return 'Database Management';
  }
  if (name.includes('backup') || name.includes('clear')) {
    return 'Data Management';
  }
  return 'Utilities';
}

/**
 * Extract documentation comment before function
 */
function extractDocComment(sourceCode, functionIndex) {
  // Look backwards for documentation comments
  const beforeFunction = sourceCode.substring(
    Math.max(0, functionIndex - 500),
    functionIndex
  );

  // Look for /// comments or /** */ comments
  const docCommentMatch =
    beforeFunction.match(/\/\/\/\s*(.*?)(?=\n\s*#\[tauri::command\])/s) ||
    beforeFunction.match(/\/\*\*(.*?)\*\//s);

  if (docCommentMatch) {
    return docCommentMatch[1]
      .split('\n')
      .map(line => line.replace(/^\s*\/\/\/\s?|\s*\*\s?/g, ''))
      .join('\n')
      .trim();
  }

  return null;
}

/**
 * Generate description based on function name and category
 */
function generateDescription(name, category) {
  const descriptions = {
    create_task: 'Creates a new task with the specified properties',
    get_task: 'Retrieves a task by its unique identifier',
    update_task: 'Updates an existing task with new properties',
    delete_task: 'Permanently deletes a task',
    get_all_tasks: 'Retrieves all tasks with optional filtering',
    create_time_session: 'Starts a new time tracking session',
    stop_time_session: 'Stops an active time tracking session',
    get_task_stats: 'Retrieves statistical information about tasks',
    init_database: 'Initializes the database with required tables',
    clear_all_data:
      'Removes all data from the database (destructive operation)',
  };

  return (
    descriptions[name] || `${category} operation: ${name.replace(/_/g, ' ')}`
  );
}

/**
 * Generate parameter description
 */
function generateParamDescription(name, type) {
  const descriptions = {
    id: 'Unique identifier',
    request: 'Request object containing the data',
    query: 'Search query string',
    limit: 'Maximum number of results to return',
    start_date: 'Start date in ISO 8601 format',
    end_date: 'End date in ISO 8601 format',
  };

  return descriptions[name] || `${name.replace(/_/g, ' ')} parameter`;
}

/**
 * Generate usage example
 */
function generateExample(name, parameters, returnType) {
  const paramExamples = parameters.map(param => {
    switch (param.type) {
      case 'String':
      case '&str':
        return `"example_${param.name}"`;
      case 'i32':
      case 'u64':
        return '42';
      case 'bool':
        return 'true';
      default:
        if (param.type.includes('Request')) {
          return `{\n    // ${param.type} properties\n  }`;
        }
        return `"${param.name}_value"`;
    }
  });

  const paramString =
    paramExamples.length > 0
      ? `{\n  ${parameters.map((p, i) => `${p.name}: ${paramExamples[i]}`).join(',\n  ')}\n}`
      : '{}';

  return `\`\`\`typescript
import { invoke } from '@tauri-apps/api/core';

const result = await invoke('${name}', ${paramString});
console.log(result);
\`\`\``;
}

/**
 * Extract repository types for better documentation
 */
async function extractRepositoryTypes(tauriDir) {
  const repositoryTypes = {};
  const repoDir = path.join(tauriDir, 'src/database/repositories');

  if (!fs.existsSync(repoDir)) {
    return repositoryTypes;
  }

  const repoFiles = fs.readdirSync(repoDir).filter(f => f.endsWith('.rs'));

  repoFiles.forEach(file => {
    const filePath = path.join(repoDir, file);
    const content = fs.readFileSync(filePath, 'utf8');

    // Extract struct definitions for request/response types
    const structRegex = /#\[derive.*?\]\s*pub struct (\w+)\s*\{([^}]+)\}/gs;
    let match;

    while ((match = structRegex.exec(content)) !== null) {
      const [, name, fields] = match;
      const fieldList = fields
        .split(',')
        .map(f => f.trim())
        .filter(f => f);

      repositoryTypes[name] = {
        fields: fieldList,
        file: file.replace('.rs', ''),
      };
    }
  });

  return repositoryTypes;
}

/**
 * Generate markdown documentation
 */
function generateTauriMarkdown(commands, repositoryTypes) {
  let markdown = `# Tauri Commands API Reference

This document provides comprehensive documentation for all Tauri commands available in KiraPilot.

*Generated on: ${new Date().toISOString()}*

## Table of Contents

`;

  // Generate table of contents
  const categories = [...new Set(commands.map(c => c.category))].sort();
  categories.forEach(category => {
    markdown += `- [${category}](#${category.toLowerCase().replace(/\s+/g, '-')})\n`;
  });

  markdown += `\n## Overview

KiraPilot uses Tauri commands to communicate between the frontend (TypeScript/React) and backend (Rust). All commands are asynchronous and return promises.

### Basic Usage

\`\`\`typescript
import { invoke } from '@tauri-apps/api/core';

// Example command invocation
const result = await invoke('command_name', {
  parameter1: 'value1',
  parameter2: 'value2'
});
\`\`\`

`;

  // Generate documentation by category
  categories.forEach(category => {
    const categoryCommands = commands.filter(c => c.category === category);

    markdown += `## ${category}\n\n`;

    categoryCommands.forEach(command => {
      markdown += `### \`${command.name}\`\n\n`;
      markdown += `${command.description}\n\n`;

      // Parameters
      if (command.parameters.length > 0) {
        markdown += `**Parameters:**\n\n`;
        command.parameters.forEach(param => {
          const required = param.required ? '**required**' : '*optional*';
          markdown += `- \`${param.name}\` (${param.type}) - ${required} - ${param.description}\n`;
        });
        markdown += `\n`;
      } else {
        markdown += `**Parameters:** None\n\n`;
      }

      // Return type
      markdown += `**Returns:** \`${command.returnType}\`\n\n`;

      // Example
      markdown += `**Example:**\n\n${command.example}\n\n`;

      markdown += `---\n\n`;
    });
  });

  // Add repository types documentation if available
  if (Object.keys(repositoryTypes).length > 0) {
    markdown += `## Data Types\n\n`;
    markdown += `The following data types are used in request and response objects:\n\n`;

    Object.entries(repositoryTypes).forEach(([name, info]) => {
      markdown += `### ${name}\n\n`;
      markdown += `*Defined in: ${info.file}.rs*\n\n`;

      if (info.fields.length > 0) {
        markdown += `**Fields:**\n\n`;
        info.fields.forEach(field => {
          markdown += `- ${field}\n`;
        });
        markdown += `\n`;
      }
    });
  }

  // Add error handling section
  markdown += `## Error Handling

All Tauri commands can throw errors. It's recommended to wrap command invocations in try-catch blocks:

\`\`\`typescript
try {
  const result = await invoke('command_name', parameters);
  // Handle success
} catch (error) {
  console.error('Command failed:', error);
  // Handle error
}
\`\`\`

Common error types:
- **Database errors**: Connection issues, constraint violations
- **Validation errors**: Invalid input parameters
- **Not found errors**: Requested resource doesn't exist
- **Permission errors**: Insufficient permissions for operation

`;

  return markdown;
}

module.exports = {
  generateTauriDocs,
};

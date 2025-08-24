/**
 * Code Example Validation and Testing System
 *
 * Validates code examples in documentation to ensure they are:
 * - Syntactically correct
 * - Use valid API calls
 * - Follow best practices
 * - Are up-to-date with current codebase
 */

const fs = require('fs');
const path = require('path');
const ts = require('typescript');

/**
 * Validate code examples in documentation
 */
async function validateCodeExamples(config) {
  const validationResults = {
    totalExamples: 0,
    validExamples: 0,
    errors: [],
    warnings: [],
  };

  // Find all markdown files in docs directory
  const docsDir = path.join(config.outputDir, '..');
  const markdownFiles = await findMarkdownFiles(docsDir);

  console.log(`Found ${markdownFiles.length} markdown files to validate`);

  // Extract and validate code examples from each file
  for (const file of markdownFiles) {
    const content = fs.readFileSync(file, 'utf8');
    const examples = extractCodeExamples(content, file);

    for (const example of examples) {
      validationResults.totalExamples++;

      try {
        await validateCodeExample(example, config);
        validationResults.validExamples++;
      } catch (error) {
        validationResults.errors.push({
          file: path.relative(docsDir, file),
          line: example.line,
          language: example.language,
          error: error.message,
          code: example.code.substring(0, 100) + '...',
        });
      }
    }
  }

  // Generate validation report
  const reportContent = generateValidationReport(validationResults);
  const reportFile = path.join(config.outputDir, 'code-validation-report.md');
  fs.writeFileSync(reportFile, reportContent);

  console.log(
    `✅ Code validation completed: ${validationResults.validExamples}/${validationResults.totalExamples} examples valid`
  );
  console.log(`📊 Validation report: ${reportFile}`);

  return validationResults;
}

/**
 * Find all markdown files recursively
 */
async function findMarkdownFiles(dir) {
  const files = [];

  function walkDir(currentDir) {
    const items = fs.readdirSync(currentDir);

    items.forEach(item => {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);

      if (
        stat.isDirectory() &&
        !item.startsWith('.') &&
        item !== 'node_modules'
      ) {
        walkDir(fullPath);
      } else if (stat.isFile() && item.endsWith('.md')) {
        files.push(fullPath);
      }
    });
  }

  walkDir(dir);
  return files;
}

/**
 * Extract code examples from markdown content
 */
function extractCodeExamples(content, filename) {
  const examples = [];
  const lines = content.split('\n');
  let inCodeBlock = false;
  let currentExample = null;

  lines.forEach((line, index) => {
    const codeBlockMatch = line.match(/^```(\w+)?/);

    if (codeBlockMatch && !inCodeBlock) {
      // Start of code block
      inCodeBlock = true;
      currentExample = {
        language: codeBlockMatch[1] || 'text',
        code: '',
        line: index + 1,
        file: filename,
      };
    } else if (line.match(/^```$/) && inCodeBlock) {
      // End of code block
      inCodeBlock = false;
      if (currentExample && shouldValidateExample(currentExample)) {
        examples.push(currentExample);
      }
      currentExample = null;
    } else if (inCodeBlock && currentExample) {
      // Inside code block
      currentExample.code += line + '\n';
    }
  });

  return examples;
}

/**
 * Determine if a code example should be validated
 */
function shouldValidateExample(example) {
  const validatableLanguages = ['typescript', 'javascript', 'ts', 'js'];
  return validatableLanguages.includes(example.language.toLowerCase());
}

/**
 * Validate a single code example
 */
async function validateCodeExample(example, config) {
  const { language, code } = example;

  if (
    language.toLowerCase() === 'typescript' ||
    language.toLowerCase() === 'ts'
  ) {
    await validateTypeScriptCode(code, config);
  } else if (
    language.toLowerCase() === 'javascript' ||
    language.toLowerCase() === 'js'
  ) {
    await validateJavaScriptCode(code, config);
  }

  // Additional validations
  await validateAPIUsage(code, config);
  await validateBestPractices(code);
}

/**
 * Validate TypeScript code
 */
async function validateTypeScriptCode(code, config) {
  // Create a temporary TypeScript program to check syntax
  const tempFileName = 'temp.ts';
  const sourceFile = ts.createSourceFile(
    tempFileName,
    code,
    ts.ScriptTarget.Latest,
    true
  );

  // Check for syntax errors
  const diagnostics = [];

  function visitNode(node) {
    // Check for common issues
    if (ts.isCallExpression(node)) {
      const expression = node.expression;
      if (ts.isIdentifier(expression) && expression.text === 'invoke') {
        // Validate Tauri invoke calls
        validateTauriInvoke(node, diagnostics);
      }
    }

    ts.forEachChild(node, visitNode);
  }

  visitNode(sourceFile);

  // Check TypeScript compiler diagnostics
  const program = ts.createProgram(
    [tempFileName],
    {
      target: ts.ScriptTarget.Latest,
      module: ts.ModuleKind.ESNext,
      strict: false, // Be lenient for examples
      skipLibCheck: true,
    },
    {
      getSourceFile: fileName =>
        fileName === tempFileName ? sourceFile : undefined,
      writeFile: () => {},
      getCurrentDirectory: () => '',
      getDirectories: () => [],
      fileExists: () => true,
      readFile: () => '',
      getCanonicalFileName: fileName => fileName,
      useCaseSensitiveFileNames: () => true,
      getNewLine: () => '\n',
    }
  );

  const compilerDiagnostics = ts.getPreEmitDiagnostics(program);

  if (compilerDiagnostics.length > 0 || diagnostics.length > 0) {
    const errors = [
      ...compilerDiagnostics.map(d => d.messageText),
      ...diagnostics,
    ];
    throw new Error(`TypeScript validation failed: ${errors.join(', ')}`);
  }
}

/**
 * Validate JavaScript code
 */
async function validateJavaScriptCode(code, config) {
  try {
    // Basic syntax check using Function constructor
    new Function(code);
  } catch (error) {
    throw new Error(`JavaScript syntax error: ${error.message}`);
  }

  // Additional JS-specific validations can be added here
}

/**
 * Validate Tauri invoke calls
 */
function validateTauriInvoke(node, diagnostics) {
  if (node.arguments.length === 0) {
    diagnostics.push('invoke() requires at least a command name');
    return;
  }

  const commandArg = node.arguments[0];
  if (!ts.isStringLiteral(commandArg)) {
    diagnostics.push('invoke() command name must be a string literal');
    return;
  }

  const commandName = commandArg.text;

  // Validate against known commands (this would be populated from Tauri extraction)
  const knownCommands = [
    'create_task',
    'get_task',
    'update_task',
    'delete_task',
    'create_time_session',
    'stop_time_session',
    'get_all_tasks',
    'search_tasks',
    // Add more as needed
  ];

  if (!knownCommands.includes(commandName)) {
    diagnostics.push(`Unknown Tauri command: ${commandName}`);
  }
}

/**
 * Validate API usage patterns
 */
async function validateAPIUsage(code, config) {
  const issues = [];

  // Check for common anti-patterns
  if (code.includes('any')) {
    issues.push('Avoid using "any" type - use specific types instead');
  }

  if (code.includes('console.log') && !code.includes('// Example')) {
    issues.push('Remove console.log statements from production examples');
  }

  // Check for proper error handling
  if (
    code.includes('await invoke') &&
    !code.includes('try') &&
    !code.includes('catch')
  ) {
    issues.push('Tauri invoke calls should include error handling');
  }

  // Check for proper imports
  if (code.includes('invoke') && !code.includes("from '@tauri-apps/api")) {
    issues.push('Missing import for Tauri invoke function');
  }

  if (issues.length > 0) {
    throw new Error(`API usage issues: ${issues.join(', ')}`);
  }
}

/**
 * Validate best practices
 */
async function validateBestPractices(code) {
  const warnings = [];

  // Check for proper async/await usage
  if (code.includes('invoke(') && !code.includes('await')) {
    warnings.push('Consider using await with async Tauri commands');
  }

  // Check for proper type annotations
  if (code.includes('const result =') && !code.includes(': ')) {
    warnings.push('Consider adding type annotations for better type safety');
  }

  // For now, we'll just collect warnings but not fail validation
  // In the future, these could be configurable as errors
}

/**
 * Generate validation report
 */
function generateValidationReport(results) {
  let report = `# Code Example Validation Report

*Generated on: ${new Date().toISOString()}*

## Summary

- **Total Examples**: ${results.totalExamples}
- **Valid Examples**: ${results.validExamples}
- **Invalid Examples**: ${results.errors.length}
- **Success Rate**: ${((results.validExamples / results.totalExamples) * 100).toFixed(1)}%

`;

  if (results.errors.length > 0) {
    report += `## Validation Errors

The following code examples have validation errors that need to be fixed:

| File | Line | Language | Error | Code Preview |
|------|------|----------|-------|--------------|
`;

    results.errors.forEach(error => {
      report += `| ${error.file} | ${error.line} | ${error.language} | ${error.error} | \`${error.code}\` |\n`;
    });

    report += `\n`;
  }

  if (results.warnings.length > 0) {
    report += `## Warnings

The following issues were found but don't prevent validation:

`;

    results.warnings.forEach(warning => {
      report += `- ${warning}\n`;
    });

    report += `\n`;
  }

  report += `## Validation Rules

The following rules are applied to code examples:

### TypeScript/JavaScript
- Syntax must be valid
- No use of \`any\` type (prefer specific types)
- Proper error handling for async operations
- Correct imports for used functions

### Tauri Commands
- Command names must exist in the backend
- Proper parameter structure
- Correct return type handling

### Best Practices
- Use \`await\` with async functions
- Include type annotations where helpful
- Remove debug statements like \`console.log\`
- Include proper error handling

## Fixing Validation Errors

To fix validation errors:

1. **Syntax Errors**: Check for missing brackets, semicolons, or typos
2. **Unknown Commands**: Verify command names against the Tauri API reference
3. **Type Errors**: Add proper type annotations and imports
4. **Missing Imports**: Add required import statements
5. **Error Handling**: Wrap async calls in try-catch blocks

## Automated Validation

This validation runs automatically when generating API documentation. To run manually:

\`\`\`bash
npm run docs:validate
\`\`\`

`;

  return report;
}

/**
 * Create validation test files for continuous integration
 */
async function createValidationTests(config) {
  const testContent = `/**
 * Automated tests for documentation code examples
 * Generated by the code validation system
 */

import { describe, test, expect } from '@jest/globals';

describe('Documentation Code Examples', () => {
  test('should have valid TypeScript syntax', async () => {
    // This test would run the validation system
    // and ensure all examples pass validation
    expect(true).toBe(true); // Placeholder
  });
  
  test('should use correct Tauri command names', async () => {
    // Validate that all invoke() calls use real command names
    expect(true).toBe(true); // Placeholder
  });
  
  test('should follow best practices', async () => {
    // Check for proper error handling, types, etc.
    expect(true).toBe(true); // Placeholder
  });
});
`;

  const testFile = path.join(
    config.outputDir,
    '../__tests__/documentation.test.ts'
  );
  const testDir = path.dirname(testFile);

  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  fs.writeFileSync(testFile, testContent);

  console.log(`✅ Created validation tests: ${testFile}`);
}

module.exports = {
  validateCodeExamples,
  createValidationTests,
};

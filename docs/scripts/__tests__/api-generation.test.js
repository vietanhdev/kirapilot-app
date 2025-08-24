/**
 * Integration tests for API documentation generation system
 */

const fs = require('fs');
const path = require('path');
const { main, CONFIG } = require('../generate-api-docs');

describe('API Documentation Generation', () => {
  const testOutputDir = path.join(__dirname, '../temp-test');

  beforeAll(() => {
    // Create test output directory
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }
  });

  afterAll(() => {
    // Clean up test files
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true, force: true });
    }
  });

  test('should generate TypeScript interface documentation', async () => {
    const {
      generateTypeScriptDocs,
    } = require('../generators/typescript-extractor');

    const testConfig = {
      ...CONFIG,
      outputDir: testOutputDir,
    };

    const result = await generateTypeScriptDocs(testConfig);

    expect(result).toBeDefined();
    expect(result.interfaces).toBeInstanceOf(Array);
    expect(result.enums).toBeInstanceOf(Array);
    expect(result.interfaces.length).toBeGreaterThan(0);
    expect(result.enums.length).toBeGreaterThan(0);

    // Check that output file was created
    const outputFile = path.join(testOutputDir, 'typescript-interfaces.md');
    expect(fs.existsSync(outputFile)).toBe(true);

    const content = fs.readFileSync(outputFile, 'utf8');
    expect(content).toContain('# TypeScript Interfaces');
    expect(content).toContain('## Enums');
    expect(content).toContain('Priority');
    expect(content).toContain('TaskStatus');
  });

  test('should generate Tauri command documentation', async () => {
    const { generateTauriDocs } = require('../generators/tauri-extractor');

    const testConfig = {
      ...CONFIG,
      outputDir: testOutputDir,
    };

    const result = await generateTauriDocs(testConfig);

    expect(result).toBeDefined();
    expect(result.commands).toBeInstanceOf(Array);
    expect(result.commands.length).toBeGreaterThan(0);

    // Check that output file was created
    const outputFile = path.join(testOutputDir, 'tauri-commands.md');
    expect(fs.existsSync(outputFile)).toBe(true);

    const content = fs.readFileSync(outputFile, 'utf8');
    expect(content).toContain('# Tauri Commands API Reference');
    expect(content).toContain('create_task');
    expect(content).toContain('get_task');
  });

  test('should generate database schema documentation', async () => {
    const { generateSchemaDocs } = require('../generators/schema-generator');

    const testConfig = {
      ...CONFIG,
      outputDir: testOutputDir,
    };

    const result = await generateSchemaDocs(testConfig);

    expect(result).toBeDefined();
    expect(result.entities).toBeDefined();
    expect(Object.keys(result.entities).length).toBeGreaterThan(0);

    // Check that output files were created
    const schemaFile = path.join(testOutputDir, 'database-schema.md');
    const erdFile = path.join(testOutputDir, 'database-erd.md');

    expect(fs.existsSync(schemaFile)).toBe(true);
    expect(fs.existsSync(erdFile)).toBe(true);

    const schemaContent = fs.readFileSync(schemaFile, 'utf8');
    expect(schemaContent).toContain('# Database Schema Documentation');
    expect(schemaContent).toContain('tasks');

    const erdContent = fs.readFileSync(erdFile, 'utf8');
    expect(erdContent).toContain('erDiagram');
  });

  test('should validate code examples', async () => {
    const { validateCodeExamples } = require('../generators/code-validator');

    const testConfig = {
      ...CONFIG,
      outputDir: testOutputDir,
    };

    const result = await validateCodeExamples(testConfig);

    expect(result).toBeDefined();
    expect(result.totalExamples).toBeGreaterThanOrEqual(0);
    expect(result.validExamples).toBeGreaterThanOrEqual(0);
    expect(result.errors).toBeInstanceOf(Array);

    // Check that validation report was created
    const reportFile = path.join(testOutputDir, 'code-validation-report.md');
    expect(fs.existsSync(reportFile)).toBe(true);

    const content = fs.readFileSync(reportFile, 'utf8');
    expect(content).toContain('# Code Example Validation Report');
  });

  test('should handle missing source files gracefully', async () => {
    const {
      generateTypeScriptDocs,
    } = require('../generators/typescript-extractor');

    const testConfig = {
      sourceDir: '/nonexistent/path',
      outputDir: testOutputDir,
    };

    await expect(generateTypeScriptDocs(testConfig)).rejects.toThrow();
  });

  test('should create valid markdown output', async () => {
    // Run the full generation process
    const testConfig = {
      ...CONFIG,
      outputDir: testOutputDir,
    };

    // Mock console.log to capture output
    const originalLog = console.log;
    const logs = [];
    console.log = (...args) => logs.push(args.join(' '));

    try {
      // Import and run generators individually to test each one
      const {
        generateTypeScriptDocs,
      } = require('../generators/typescript-extractor');
      const { generateTauriDocs } = require('../generators/tauri-extractor');
      const { generateSchemaDocs } = require('../generators/schema-generator');
      const { validateCodeExamples } = require('../generators/code-validator');

      await generateTypeScriptDocs(testConfig);
      await generateTauriDocs(testConfig);
      await generateSchemaDocs(testConfig);
      await validateCodeExamples(testConfig);

      // Check that all expected files exist
      const expectedFiles = [
        'typescript-interfaces.md',
        'tauri-commands.md',
        'database-schema.md',
        'database-erd.md',
        'code-validation-report.md',
      ];

      expectedFiles.forEach(filename => {
        const filepath = path.join(testOutputDir, filename);
        expect(fs.existsSync(filepath)).toBe(true);

        const content = fs.readFileSync(filepath, 'utf8');
        expect(content.length).toBeGreaterThan(0);
        expect(content).toMatch(/^# /); // Should start with a heading
      });
    } finally {
      console.log = originalLog;
    }
  });
});

// Helper function to run the tests
if (require.main === module) {
  // This allows running the test file directly with Node.js
  console.log('Running API generation tests...');

  // Simple test runner
  const runTests = async () => {
    try {
      const {
        generateTypeScriptDocs,
      } = require('../generators/typescript-extractor');
      const testConfig = {
        ...CONFIG,
        outputDir: path.join(__dirname, '../temp-test'),
      };

      console.log('Testing TypeScript extraction...');
      const result = await generateTypeScriptDocs(testConfig);
      console.log(
        `✅ Generated ${result.interfaces.length} interfaces and ${result.enums.length} enums`
      );

      console.log('All tests passed!');
    } catch (error) {
      console.error('Test failed:', error);
      process.exit(1);
    }
  };

  runTests();
}

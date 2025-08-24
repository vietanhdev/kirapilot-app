# API Documentation Generation System

This directory contains the automated API documentation generation system for KiraPilot. The system extracts information from the codebase and generates comprehensive, up-to-date documentation.

## Overview

The API documentation generation system consists of four main components:

1. **TypeScript Interface Extractor** - Extracts interfaces, types, and enums from the frontend
2. **Tauri Command Extractor** - Parses Rust source code to document backend commands
3. **Database Schema Generator** - Creates schema documentation and ERDs from entity definitions
4. **Code Example Validator** - Validates code examples in documentation for accuracy

## Quick Start

```bash
# Generate all API documentation
npm run docs:api

# Validate code examples
npm run docs:validate

# Generate docs and build site
npm run docs:full
```

## Components

### 1. TypeScript Interface Extractor (`generators/typescript-extractor.js`)

Extracts TypeScript interfaces, types, and enums from `src/types/index.ts` and generates comprehensive documentation.

**Features:**

- Parses TypeScript AST to extract type information
- Categorizes interfaces by functionality (tasks, time-tracking, AI, etc.)
- Extracts JSDoc comments and generates descriptions
- Creates organized markdown documentation

**Output:** `docs/api/typescript-interfaces.md`

### 2. Tauri Command Extractor (`generators/tauri-extractor.js`)

Parses Rust source code to extract Tauri command definitions and generate API reference documentation.

**Features:**

- Extracts command signatures from `#[tauri::command]` functions
- Parses parameter types and return types
- Categorizes commands by functionality
- Generates usage examples for each command
- Documents error handling patterns

**Output:** `docs/api/tauri-commands.md`

### 3. Database Schema Generator (`generators/schema-generator.js`)

Creates comprehensive database schema documentation from SeaORM entity definitions.

**Features:**

- Extracts table structures from Rust entity files
- Documents relationships between tables
- Generates Mermaid ERD diagrams
- Tracks migration history
- Documents constraints and indexes

**Output:**

- `docs/api/database-schema.md`
- `docs/api/database-erd.md`

### 4. Code Example Validator (`generators/code-validator.js`)

Validates code examples in documentation to ensure they are syntactically correct and use valid APIs.

**Features:**

- Extracts code blocks from markdown files
- Validates TypeScript/JavaScript syntax
- Checks Tauri command usage against known commands
- Enforces best practices and coding standards
- Generates validation reports

**Output:** `docs/api/code-validation-report.md`

## Configuration

The system is configured through the main script (`generate-api-docs.js`):

```javascript
const CONFIG = {
  sourceDir: path.resolve(__dirname, '../../src'),
  tauriDir: path.resolve(__dirname, '../../src-tauri'),
  outputDir: path.resolve(__dirname, '../docs/api'),
  tempDir: path.resolve(__dirname, '../temp'),
};
```

## Generated Documentation Structure

```
docs/api/
├── typescript-interfaces.md    # Frontend type definitions
├── tauri-commands.md          # Backend API commands
├── database-schema.md         # Database structure
├── database-erd.md           # Entity relationship diagram
└── code-validation-report.md # Validation results
```

## Integration with Docusaurus

The generated documentation is automatically integrated into the Docusaurus site structure. The API reference pages are included in the sidebar navigation under the "API Reference" section.

## Validation Rules

### TypeScript/JavaScript Code Examples

- Must have valid syntax
- No use of `any` type (prefer specific types)
- Proper error handling for async operations
- Correct imports for used functions

### Tauri Command Usage

- Command names must exist in the backend
- Proper parameter structure
- Correct return type handling

### Best Practices

- Use `await` with async functions
- Include type annotations where helpful
- Remove debug statements like `console.log`
- Include proper error handling

## Extending the System

### Adding New Extractors

To add a new documentation extractor:

1. Create a new file in `generators/`
2. Export a main function that takes the config object
3. Add the extractor to the main script
4. Update the README and package.json scripts

### Customizing Output

The markdown generation functions can be customized to change the output format:

- Modify the `generate*Markdown()` functions in each extractor
- Add new sections or reorganize existing content
- Change the categorization logic for better organization

### Adding Validation Rules

To add new validation rules:

1. Modify the validation functions in `code-validator.js`
2. Add new patterns to check for
3. Update the validation report generation
4. Document the new rules in this README

## Troubleshooting

### Common Issues

**TypeScript compilation errors:**

- Ensure TypeScript is installed: `npm install typescript`
- Check that the source files exist and are readable

**Rust parsing errors:**

- Verify that the Tauri source files are in the expected location
- Check that the regex patterns match the current code style

**Missing dependencies:**

- Run `npm install` in the docs directory
- Ensure all required Node.js modules are available

### Debug Mode

To enable debug output, set the `DEBUG` environment variable:

```bash
DEBUG=1 npm run docs:api
```

## Performance

The documentation generation is designed to be fast and efficient:

- **TypeScript extraction**: ~100ms for typical interface files
- **Tauri extraction**: ~200ms for the main lib.rs file
- **Schema generation**: ~150ms for all entity files
- **Code validation**: ~500ms for all documentation files

Total generation time is typically under 2 seconds.

## Contributing

When contributing to the documentation system:

1. Follow the existing code style and patterns
2. Add tests for new functionality
3. Update this README with any new features
4. Ensure generated documentation is accurate and helpful

## Future Enhancements

Planned improvements include:

- **Interactive examples**: Live code examples that can be executed
- **API versioning**: Support for multiple API versions
- **Performance metrics**: Track API usage and performance
- **Automated screenshots**: Generate UI screenshots automatically
- **Multi-language support**: Generate documentation in multiple languages

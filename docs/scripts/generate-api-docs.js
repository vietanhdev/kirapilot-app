#!/usr/bin/env node

/**
 * API Documentation Generation System for KiraPilot
 *
 * This script generates comprehensive API documentation by:
 * 1. Extracting TypeScript interfaces from the frontend
 * 2. Parsing Tauri commands from Rust source code
 * 3. Generating database schema documentation
 * 4. Validating code examples
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const CONFIG = {
  sourceDir: path.resolve(__dirname, '../../src'),
  tauriDir: path.resolve(__dirname, '../../src-tauri'),
  outputDir: path.resolve(__dirname, '../docs/api'),
  tempDir: path.resolve(__dirname, '../temp'),
};

// Ensure output directories exist
function ensureDirectories() {
  [CONFIG.outputDir, CONFIG.tempDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

// Main execution
async function main() {
  console.log('🚀 Starting API documentation generation...');

  try {
    ensureDirectories();

    // Import and run generators
    const {
      generateTypeScriptDocs,
    } = require('./generators/typescript-extractor');
    const { generateTauriDocs } = require('./generators/tauri-extractor');
    const { generateSchemaDocs } = require('./generators/schema-generator');
    const { validateCodeExamples } = require('./generators/code-validator');

    console.log('📝 Generating TypeScript interface documentation...');
    await generateTypeScriptDocs(CONFIG);

    console.log('🦀 Generating Tauri command documentation...');
    await generateTauriDocs(CONFIG);

    console.log('🗄️ Generating database schema documentation...');
    await generateSchemaDocs(CONFIG);

    console.log('✅ Validating code examples...');
    await validateCodeExamples(CONFIG);

    console.log('✨ API documentation generation completed successfully!');
  } catch (error) {
    console.error('❌ Error generating API documentation:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { main, CONFIG };

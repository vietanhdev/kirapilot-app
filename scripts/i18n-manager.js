#!/usr/bin/env node

/**
 * Translation Management Script for KiraPilot
 *
 * This script helps manage translations by:
 * - Finding missing translations across languages
 * - Detecting unused translation keys
 * - Validating translation key consistency
 * - Generating translation reports
 * - Auto-completing missing translations (placeholder)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const LOCALES_DIR = path.join(__dirname, '../src/i18n/locales');
const REFERENCE_LANGUAGE = 'en';
const SUPPORTED_LANGUAGES = ['en', 'es', 'fr', 'de', 'vi', 'ja', 'pt'];

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

function log(message, color = 'reset') {
  console.log(colorize(message, color));
}

function loadTranslations(language) {
  try {
    const filePath = path.join(LOCALES_DIR, `${language}.ts`);
    const content = fs.readFileSync(filePath, 'utf8');

    // Extract translation object using regex (simple approach)
    const match = content.match(/export const \w+ = \{([\s\S]*)\};/);
    if (!match) {
      throw new Error(`Could not parse translations from ${language}.ts`);
    }

    const translationsText = match[1];
    const translations = {};

    // Parse key-value pairs (simplified regex approach)
    const keyValueRegex = /'([^']+)':\s*'([^']*(?:\\'[^']*)*)'/g;
    let keyMatch;

    while ((keyMatch = keyValueRegex.exec(translationsText)) !== null) {
      const key = keyMatch[1];
      const value = keyMatch[2].replace(/\\'/g, "'"); // Unescape quotes
      translations[key] = value;
    }

    return translations;
  } catch (error) {
    log(`Error loading translations for ${language}: ${error.message}`, 'red');
    return {};
  }
}

function findMissingTranslations() {
  log('\n🔍 Finding missing translations...', 'blue');

  const referenceTranslations = loadTranslations(REFERENCE_LANGUAGE);
  const referenceKeys = Object.keys(referenceTranslations);

  const report = {};
  let totalMissing = 0;

  for (const language of SUPPORTED_LANGUAGES) {
    if (language === REFERENCE_LANGUAGE) continue;

    const translations = loadTranslations(language);
    const translationKeys = Object.keys(translations);

    const missingKeys = referenceKeys.filter(
      key => !translationKeys.includes(key)
    );
    const extraKeys = translationKeys.filter(
      key => !referenceKeys.includes(key)
    );

    report[language] = {
      missing: missingKeys,
      extra: extraKeys,
      coverage: Math.round(
        ((referenceKeys.length - missingKeys.length) / referenceKeys.length) *
          100
      ),
    };

    totalMissing += missingKeys.length;
  }

  // Display report
  log(`\n📊 Translation Coverage Report`, 'bright');
  log(
    `Reference language: ${REFERENCE_LANGUAGE} (${referenceKeys.length} keys)`,
    'cyan'
  );

  for (const [language, data] of Object.entries(report)) {
    const coverageColor =
      data.coverage >= 95 ? 'green' : data.coverage >= 80 ? 'yellow' : 'red';
    log(
      `\n${language.toUpperCase()}: ${data.coverage}% coverage`,
      coverageColor
    );

    if (data.missing.length > 0) {
      log(`  Missing (${data.missing.length}):`, 'red');
      data.missing.slice(0, 10).forEach(key => {
        log(`    - ${key}`, 'red');
      });
      if (data.missing.length > 10) {
        log(`    ... and ${data.missing.length - 10} more`, 'red');
      }
    }

    if (data.extra.length > 0) {
      log(`  Extra (${data.extra.length}):`, 'yellow');
      data.extra.slice(0, 5).forEach(key => {
        log(`    + ${key}`, 'yellow');
      });
      if (data.extra.length > 5) {
        log(`    ... and ${data.extra.length - 5} more`, 'yellow');
      }
    }
  }

  log(
    `\n📈 Summary: ${totalMissing} total missing translations across all languages`,
    'bright'
  );

  return report;
}

function validateTranslationKeys() {
  log('\n🔧 Validating translation key structure...', 'blue');

  const referenceTranslations = loadTranslations(REFERENCE_LANGUAGE);
  const issues = [];

  // Naming convention rules
  const validKeyPattern = /^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*)*$/;
  const maxDepth = 4;

  for (const key of Object.keys(referenceTranslations)) {
    // Check format
    if (!validKeyPattern.test(key)) {
      issues.push({
        key,
        type: 'invalid-format',
        message:
          'Key should follow hierarchical dot notation with camelCase segments',
      });
    }

    // Check depth
    const depth = key.split('.').length;
    if (depth > maxDepth) {
      issues.push({
        key,
        type: 'too-deep',
        message: `Key is too deeply nested (${depth} levels, max ${maxDepth})`,
      });
    }

    // Check for consistent prefixes
    const segments = key.split('.');
    if (segments.length > 1) {
      const prefix = segments[0];
      const knownPrefixes = [
        'common',
        'nav',
        'settings',
        'tasks',
        'timer',
        'reports',
        'planning',
        'ai',
        'notifications',
      ];

      if (!knownPrefixes.includes(prefix)) {
        issues.push({
          key,
          type: 'unknown-prefix',
          message: `Unknown prefix "${prefix}". Consider using: ${knownPrefixes.join(', ')}`,
        });
      }
    }
  }

  if (issues.length === 0) {
    log('✅ All translation keys follow naming conventions', 'green');
  } else {
    log(`⚠️  Found ${issues.length} key structure issues:`, 'yellow');

    const groupedIssues = issues.reduce((acc, issue) => {
      if (!acc[issue.type]) acc[issue.type] = [];
      acc[issue.type].push(issue);
      return acc;
    }, {});

    for (const [type, typeIssues] of Object.entries(groupedIssues)) {
      log(`\n  ${type.toUpperCase()} (${typeIssues.length}):`, 'yellow');
      typeIssues.slice(0, 5).forEach(issue => {
        log(`    - ${issue.key}: ${issue.message}`, 'yellow');
      });
      if (typeIssues.length > 5) {
        log(`    ... and ${typeIssues.length - 5} more`, 'yellow');
      }
    }
  }

  return issues;
}

function generateMissingTranslationStubs(language, missingKeys) {
  log(`\n🔨 Generating translation stubs for ${language}...`, 'blue');

  const referenceTranslations = loadTranslations(REFERENCE_LANGUAGE);
  const stubs = [];

  for (const key of missingKeys) {
    const englishValue = referenceTranslations[key];
    if (englishValue) {
      // Add a TODO comment to indicate this needs translation
      stubs.push(
        `  '${key}': '${englishValue}', // TODO: Translate to ${language}`
      );
    }
  }

  if (stubs.length > 0) {
    const stubsContent = stubs.join('\n');
    const outputFile = path.join(
      __dirname,
      `../translation-stubs-${language}.txt`
    );

    fs.writeFileSync(outputFile, stubsContent, 'utf8');
    log(
      `📝 Generated ${stubs.length} translation stubs in: ${outputFile}`,
      'green'
    );
    log('Copy these to your locale file and translate them.', 'cyan');
  }
}

function exportTranslationsToCSV() {
  log('\n📊 Exporting translations to CSV...', 'blue');

  const referenceTranslations = loadTranslations(REFERENCE_LANGUAGE);
  const allTranslations = {};

  // Load all translations
  for (const language of SUPPORTED_LANGUAGES) {
    allTranslations[language] = loadTranslations(language);
  }

  // Create CSV content
  const headers = ['Key', ...SUPPORTED_LANGUAGES];
  const rows = [headers.join(',')];

  for (const key of Object.keys(referenceTranslations)) {
    const row = [key];

    for (const language of SUPPORTED_LANGUAGES) {
      const translation = allTranslations[language][key] || '';
      // Escape quotes and commas for CSV
      const escapedTranslation = `"${translation.replace(/"/g, '""')}"`;
      row.push(escapedTranslation);
    }

    rows.push(row.join(','));
  }

  const csvContent = rows.join('\n');
  const outputFile = path.join(__dirname, '../translations-export.csv');

  fs.writeFileSync(outputFile, csvContent, 'utf8');
  log(`📄 Exported translations to: ${outputFile}`, 'green');
}

function showUsage() {
  log('\n🌐 KiraPilot Translation Manager', 'bright');
  log('\nUsage: node scripts/i18n-manager.js <command>', 'cyan');
  log('\nCommands:', 'bright');
  log('  check       - Find missing translations and validate keys', 'cyan');
  log('  validate    - Validate translation key structure only', 'cyan');
  log('  stubs <lang> - Generate translation stubs for a language', 'cyan');
  log('  export      - Export all translations to CSV', 'cyan');
  log('  help        - Show this help message', 'cyan');
  log('\nExamples:', 'bright');
  log('  node scripts/i18n-manager.js check', 'yellow');
  log('  node scripts/i18n-manager.js stubs es', 'yellow');
  log('  node scripts/i18n-manager.js export', 'yellow');
}

// Main execution
function main() {
  const command = process.argv[2];
  const arg = process.argv[3];

  switch (command) {
    case 'check':
      const report = findMissingTranslations();
      validateTranslationKeys();
      break;

    case 'validate':
      validateTranslationKeys();
      break;

    case 'stubs':
      if (!arg || !SUPPORTED_LANGUAGES.includes(arg)) {
        log(
          `❌ Please specify a valid language: ${SUPPORTED_LANGUAGES.join(', ')}`,
          'red'
        );
        return;
      }
      const referenceTranslations = loadTranslations(REFERENCE_LANGUAGE);
      const targetTranslations = loadTranslations(arg);
      const missingKeys = Object.keys(referenceTranslations).filter(
        key => !Object.keys(targetTranslations).includes(key)
      );
      generateMissingTranslationStubs(arg, missingKeys);
      break;

    case 'export':
      exportTranslationsToCSV();
      break;

    case 'help':
    default:
      showUsage();
      break;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export {
  findMissingTranslations,
  validateTranslationKeys,
  generateMissingTranslationStubs,
  exportTranslationsToCSV,
};

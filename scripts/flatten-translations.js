#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const LOCALES_DIR = path.join(__dirname, '../src/i18n/locales');
const TARGET_LANGUAGES = ['en', 'es', 'fr', 'de', 'ja', 'pt', 'vi'];

// Command line arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run') || args.includes('-d');
const VERBOSE = args.includes('--verbose') || args.includes('-v');

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

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Parse TypeScript export object from file content
function parseTranslationFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');

    // Extract the object content between the braces
    const match = content.match(/export\s+const\s+\w+\s*=\s*({[\s\S]*});?\s*$/);
    if (!match) {
      throw new Error('Could not parse translation object');
    }

    // Clean up the object content to handle trailing commas and other issues
    let objectContent = match[1];

    // Remove trailing commas before closing braces
    objectContent = objectContent.replace(/,(\s*[}\]])/g, '$1');

    // Use eval to parse the object (safe since we control the input)
    const translations = eval(`(${objectContent})`);

    return translations;
  } catch (error) {
    log(`Error parsing ${filePath}: ${error.message}`, 'red');
    if (VERBOSE) {
      log(`File content preview: ${content.substring(0, 200)}...`, 'yellow');
    }
    return {};
  }
}

// Flatten nested object to dot notation
function flattenObject(obj, prefix = '') {
  const flattened = {};

  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Check if the object has any properties
      const nestedKeys = Object.keys(value);
      if (nestedKeys.length === 0) {
        // Empty object, skip it
        continue;
      }

      // Recursively flatten nested objects
      const nestedFlattened = flattenObject(value, newKey);
      Object.assign(flattened, nestedFlattened);
    } else if (value !== undefined && value !== null) {
      flattened[newKey] = String(value);
    }
  }

  return flattened;
}

// Convert flattened object back to TypeScript export string
function flattenedToTypeScript(flattened, langCode) {
  let result = `export const ${langCode} = {\n`;

  const entries = Object.entries(flattened);
  const sortedEntries = entries.sort(([a], [b]) => a.localeCompare(b));

  let currentSection = '';

  for (let i = 0; i < sortedEntries.length; i++) {
    const [key, value] = sortedEntries[i];
    const isLast = i === sortedEntries.length - 1;

    // Add section comments based on key prefixes
    const section = key.split('.')[0];
    if (section !== currentSection) {
      if (currentSection !== '') {
        result += '\n';
      }
      result += `  // ${section.charAt(0).toUpperCase() + section.slice(1)}\n`;
      currentSection = section;
    }

    // Escape single quotes in the value
    const escapedValue = value.replace(/'/g, "\\'").replace(/\n/g, '\\n');

    result += `  '${key}': '${escapedValue}'${isLast ? '' : ','}\n`;
  }

  result += '};\n';

  return result;
}

// Main function to flatten translations
async function flattenTranslations() {
  log('🔧 Starting translation flattening process...', 'cyan');

  if (DRY_RUN) {
    log('🔍 Running in DRY RUN mode - no files will be modified', 'yellow');
  }

  const report = {
    processed: 0,
    flattened: 0,
    totalKeys: 0,
    errors: [],
  };

  for (const langCode of TARGET_LANGUAGES) {
    const langPath = path.join(LOCALES_DIR, `${langCode}.ts`);

    if (!fs.existsSync(langPath)) {
      log(`⚠️  Language file not found: ${langPath}`, 'yellow');
      continue;
    }

    try {
      log(`\n🌍 Processing ${langCode}...`, 'blue');

      const translations = parseTranslationFile(langPath);
      const flattened = flattenObject(translations);

      const keyCount = Object.keys(flattened).length;
      const originalKeyCount = Object.keys(translations).length;

      log(`  📊 Original keys: ${originalKeyCount}`, 'blue');
      log(`  📊 Flattened keys: ${keyCount}`, 'blue');

      if (VERBOSE) {
        log(`  🔍 Sample flattened keys:`, 'yellow');
        Object.keys(flattened)
          .slice(0, 5)
          .forEach(key => {
            log(`     ${key}`, 'yellow');
          });
        if (keyCount > 5) {
          log(`     ... and ${keyCount - 5} more`, 'yellow');
        }
      }

      // Write back to file
      if (!DRY_RUN) {
        const newContent = flattenedToTypeScript(flattened, langCode);
        fs.writeFileSync(langPath, newContent, 'utf8');
        log(`  💾 File flattened and saved`, 'green');
      } else {
        log(`  💾 Would flatten file (dry run)`, 'yellow');
      }

      // Update report
      report.processed++;
      report.flattened++;
      report.totalKeys += keyCount;
    } catch (error) {
      const errorMsg = `Error processing ${langCode}: ${error.message}`;
      log(`  ❌ ${errorMsg}`, 'red');
      report.errors.push(errorMsg);
    }
  }

  // Print final report
  log('\n📊 Final Report:', 'cyan');
  log(
    `   Files processed: ${report.processed}/${TARGET_LANGUAGES.length}`,
    'bright'
  );
  log(`   Files flattened: ${report.flattened}`, 'bright');
  log(`   Total keys: ${report.totalKeys}`, 'bright');

  if (report.errors.length > 0) {
    log('\n❌ Errors:', 'red');
    report.errors.forEach(error => log(`   ${error}`, 'red'));
  }

  if (report.flattened > 0) {
    log(
      `\n🎉 Flattening complete! Processed ${report.flattened} files with ${report.totalKeys} total keys.`,
      'green'
    );
    log(
      '\n💡 All translation files now use flat dot notation structure.',
      'yellow'
    );
    log('   This should resolve TypeScript compilation issues.', 'yellow');
  } else {
    log('\n✨ All files were already flat - no changes needed!', 'green');
  }
}

function showHelp() {
  log('🔧 Translation Flattening Script', 'cyan');
  log('');
  log('Usage: npm run i18n:flatten [options]', 'bright');
  log('');
  log('Options:', 'bright');
  log('  --dry-run, -d    Show what would be changed without modifying files');
  log('  --verbose, -v    Show detailed information');
  log('  --help, -h       Show this help message');
  log('');
  log('Examples:', 'bright');
  log('  npm run i18n:flatten                # Flatten translations');
  log('  npm run i18n:flatten -- --dry-run   # Preview changes');
  log('  npm run i18n:flatten -- --verbose   # Show detailed output');
  log('');
  log('Description:', 'bright');
  log(
    '  This script converts nested translation objects to flat dot notation.'
  );
  log(
    '  For example: { common: { save: "Save" } } becomes { "common.save": "Save" }'
  );
  log('');
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }

  flattenTranslations().catch(error => {
    log(`💥 Script failed: ${error.message}`, 'red');
    if (VERBOSE) {
      console.error(error);
    }
    process.exit(1);
  });
}

export { flattenTranslations };

#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const LOCALES_DIR = path.join(__dirname, '../src/i18n/locales');
const REFERENCE_LANG = 'en';
const TARGET_LANGUAGES = ['es', 'fr', 'de', 'ja', 'pt', 'vi'];

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

function showHelp() {
  log('🌍 Translation Fix Script', 'cyan');
  log('');
  log('Usage: npm run i18n:fix [options]', 'bright');
  log('');
  log('Options:', 'bright');
  log('  --dry-run, -d    Show what would be changed without modifying files');
  log('  --verbose, -v    Show detailed information');
  log('  --help, -h       Show this help message');
  log('');
  log('Examples:', 'bright');
  log('  npm run i18n:fix                # Fix translations');
  log('  npm run i18n:fix -- --dry-run   # Preview changes');
  log('  npm run i18n:fix -- --verbose   # Show detailed output');
  log('');
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

    // Use eval to parse the object (safe since we control the input)
    const objectContent = match[1];
    const translations = eval(`(${objectContent})`);

    return translations;
  } catch (error) {
    log(`Error parsing ${filePath}: ${error.message}`, 'red');
    return {};
  }
}

// Flatten nested object to dot notation
function flattenObject(obj, prefix = '') {
  const flattened = {};

  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      Object.assign(flattened, flattenObject(value, newKey));
    } else {
      flattened[newKey] = value;
    }
  }

  return flattened;
}

// Get all keys from a nested object
function getAllKeys(obj, prefix = '') {
  const keys = new Set();

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Nested object
      const nestedKeys = getAllKeys(value, fullKey);
      nestedKeys.forEach(k => keys.add(k));
    } else {
      // Leaf value
      keys.add(fullKey);
    }
  }

  return keys;
}

// Get value from nested object using dot notation
function getValue(obj, keyPath) {
  return keyPath.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : undefined;
  }, obj);
}

// Set value in nested object using dot notation
function setValue(obj, keyPath, value) {
  const keys = keyPath.split('.');
  const lastKey = keys.pop();

  let current = obj;
  for (const key of keys) {
    if (!current[key] || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key];
  }

  current[lastKey] = value;
}

// Remove duplicate keys (keep first occurrence)
function removeDuplicates(obj) {
  const seen = new Set();
  const duplicates = [];

  function traverse(current, path = '') {
    const entries = Object.entries(current);

    for (let i = entries.length - 1; i >= 0; i--) {
      const [key, value] = entries[i];
      const fullPath = path ? `${path}.${key}` : key;

      if (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value)
      ) {
        traverse(value, fullPath);
      } else {
        if (seen.has(fullPath)) {
          duplicates.push(fullPath);
          delete current[key];
        } else {
          seen.add(fullPath);
        }
      }
    }
  }

  traverse(obj);
  return duplicates;
}

// Convert nested object back to TypeScript export string
function objectToTypeScript(obj, langCode, indent = 0) {
  const spaces = '  '.repeat(indent);
  let result = '';

  if (indent === 0) {
    result += `export const ${langCode} = {\n`;
  }

  const entries = Object.entries(obj);

  for (let i = 0; i < entries.length; i++) {
    const [key, value] = entries[i];
    const isLast = i === entries.length - 1;

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Check if this object has any properties
      if (Object.keys(value).length > 0) {
        result += `${spaces}  // ${key.charAt(0).toUpperCase() + key.slice(1)}\n`;
        result += `${spaces}  '${key}': {\n`;
        result += objectToTypeScript(value, langCode, indent + 2);
        result += `${spaces}  }${isLast ? '' : ','}\n`;
        if (!isLast) result += '\n';
      }
    } else {
      // Escape single quotes in the value
      const escapedValue =
        typeof value === 'string'
          ? value.replace(/'/g, "\\'").replace(/\n/g, '\\n')
          : value;

      result += `${spaces}  '${key}': '${escapedValue}'${isLast ? '' : ','}\n`;
    }
  }

  if (indent === 0) {
    result += '};\n';
  }

  return result;
}

// Main function to fix translations
async function fixTranslations() {
  log('🔧 Starting translation fix process...', 'cyan');

  if (DRY_RUN) {
    log('🔍 Running in DRY RUN mode - no files will be modified', 'yellow');
  }

  // Load reference language
  const referencePath = path.join(LOCALES_DIR, `${REFERENCE_LANG}.ts`);
  if (!fs.existsSync(referencePath)) {
    log(`❌ Reference language file not found: ${referencePath}`, 'red');
    return;
  }

  const referenceTranslations = parseTranslationFile(referencePath);
  const referenceKeys = getAllKeys(referenceTranslations);

  log(
    `📖 Loaded ${referenceKeys.size} keys from reference language (${REFERENCE_LANG})`,
    'green'
  );

  const report = {
    processed: 0,
    missingKeys: {},
    duplicatesRemoved: {},
    errors: [],
  };

  // Process each target language
  for (const langCode of TARGET_LANGUAGES) {
    const langPath = path.join(LOCALES_DIR, `${langCode}.ts`);

    if (!fs.existsSync(langPath)) {
      log(`⚠️  Language file not found: ${langPath}`, 'yellow');
      continue;
    }

    try {
      log(`\n🌍 Processing ${langCode}...`, 'blue');

      const translations = parseTranslationFile(langPath);
      const flatTranslations = flattenObject(translations);
      const flatReference = flattenObject(referenceTranslations);

      const existingKeys = new Set(Object.keys(flatTranslations));
      const referenceKeysList = Object.keys(flatReference);

      // Find missing keys
      const missingKeys = referenceKeysList.filter(
        key => !existingKeys.has(key)
      );

      // Find extra keys (keys that exist in target but not in reference)
      const extraKeys = [...existingKeys].filter(
        key => !flatReference.hasOwnProperty(key)
      );

      // Remove duplicates
      const duplicatesRemoved = removeDuplicates(translations);

      // Add missing keys with English values as placeholders
      let addedCount = 0;
      for (const missingKey of missingKeys) {
        const referenceValue = flatReference[missingKey];
        if (referenceValue !== undefined) {
          setValue(translations, missingKey, `[EN] ${referenceValue}`);
          addedCount++;
        }
      }

      // Report extra keys but don't remove them (they might be intentional)
      if (extraKeys.length > 0) {
        log(
          `  ⚠️  Found ${extraKeys.length} extra keys not in reference:`,
          'yellow'
        );
        extraKeys.slice(0, 5).forEach(key => log(`     - ${key}`, 'yellow'));
        if (extraKeys.length > 5) {
          log(`     ... and ${extraKeys.length - 5} more`, 'yellow');
        }
      }

      // Write back to file only if changes were made
      if ((addedCount > 0 || duplicatesRemoved.length > 0) && !DRY_RUN) {
        const newContent = objectToTypeScript(translations, langCode);
        fs.writeFileSync(langPath, newContent, 'utf8');
        log(`  💾 File updated`, 'green');
      } else if ((addedCount > 0 || duplicatesRemoved.length > 0) && DRY_RUN) {
        log(`  💾 Would update file (dry run)`, 'yellow');
      }

      // Update report
      report.processed++;
      report.missingKeys[langCode] = addedCount;
      report.duplicatesRemoved[langCode] = duplicatesRemoved.length;

      log(
        `  ✅ Added ${addedCount} missing keys`,
        addedCount > 0 ? 'green' : 'reset'
      );
      log(
        `  🧹 Removed ${duplicatesRemoved.length} duplicate keys`,
        duplicatesRemoved.length > 0 ? 'green' : 'reset'
      );
      log(
        `  📊 Total keys: ${Object.keys(flattenObject(translations)).length}`,
        'blue'
      );

      if (duplicatesRemoved.length > 0) {
        log(
          `     Duplicates removed: ${duplicatesRemoved.slice(0, 3).join(', ')}${duplicatesRemoved.length > 3 ? '...' : ''}`,
          'yellow'
        );
      }
    } catch (error) {
      const errorMsg = `Error processing ${langCode}: ${error.message}`;
      log(`  ❌ ${errorMsg}`, 'red');
      report.errors.push(errorMsg);
    }
  }

  // Print final report
  log('\n📊 Final Report:', 'cyan');
  log(
    `   Languages processed: ${report.processed}/${TARGET_LANGUAGES.length}`,
    'bright'
  );

  let totalMissing = 0;
  let totalDuplicates = 0;

  for (const [lang, count] of Object.entries(report.missingKeys)) {
    if (count > 0) {
      log(`   ${lang}: +${count} missing keys`, 'green');
      totalMissing += count;
    }
  }

  for (const [lang, count] of Object.entries(report.duplicatesRemoved)) {
    if (count > 0) {
      log(`   ${lang}: -${count} duplicate keys`, 'yellow');
      totalDuplicates += count;
    }
  }

  if (report.errors.length > 0) {
    log('\n❌ Errors:', 'red');
    report.errors.forEach(error => log(`   ${error}`, 'red'));
  }

  log(
    `\n🎉 Complete! Added ${totalMissing} keys, removed ${totalDuplicates} duplicates`,
    'green'
  );

  if (totalMissing > 0) {
    log(
      '\n💡 Note: Missing keys have been filled with "[EN] " prefixed English text.',
      'yellow'
    );
    log(
      '   Please translate these manually or use a translation service.',
      'yellow'
    );
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }

  fixTranslations().catch(error => {
    log(`💥 Script failed: ${error.message}`, 'red');
    if (VERBOSE) {
      console.error(error);
    }
    process.exit(1);
  });
}

export { fixTranslations };

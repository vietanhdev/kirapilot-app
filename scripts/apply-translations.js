#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const LOCALES_DIR = path.join(__dirname, '../src/i18n/locales');

// Command line arguments
const args = process.argv.slice(2);
const LANGUAGE = args.find(arg => !arg.startsWith('-'));
const INPUT_FILE = args.find(arg => arg.startsWith('--input='))?.split('=')[1];
const DRY_RUN = args.includes('--dry-run') || args.includes('-d');

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

// Parse CSV file
function parseCSV(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const translations = {};

    // Skip header line
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Parse CSV line (simple parser for our format)
      const match = line.match(/^"([^"]+)","[^"]*","([^"]*)"$/);
      if (match) {
        const [, key, translation] = match;
        if (translation && translation.trim()) {
          translations[key] = translation;
        }
      }
    }

    return translations;
  } catch (error) {
    throw new Error(`Failed to parse CSV file: ${error.message}`);
  }
}

// Parse translation file
function parseTranslationFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const match = content.match(/export\s+const\s+\w+\s*=\s*({[\s\S]*});?\s*$/);
    if (!match) {
      throw new Error('Could not parse translation object');
    }

    const objectContent = match[1];
    const translations = eval(`(${objectContent})`);
    return translations;
  } catch (error) {
    throw new Error(`Failed to parse translation file: ${error.message}`);
  }
}

// Generate TypeScript export string
function generateTypeScriptExport(translations, langCode) {
  let result = `export const ${langCode} = {\n`;

  const entries = Object.entries(translations);
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

// Apply translations from CSV to translation file
function applyTranslations(langCode, csvTranslations) {
  const langPath = path.join(LOCALES_DIR, `${langCode}.ts`);

  if (!fs.existsSync(langPath)) {
    throw new Error(`Translation file not found: ${langPath}`);
  }

  // Load current translations
  const currentTranslations = parseTranslationFile(langPath);

  let updatedCount = 0;
  let newTranslations = { ...currentTranslations };

  // Apply new translations
  for (const [key, translation] of Object.entries(csvTranslations)) {
    if (newTranslations.hasOwnProperty(key)) {
      const currentValue = newTranslations[key];

      // Only update if current value is untranslated (starts with [EN])
      if (
        typeof currentValue === 'string' &&
        currentValue.startsWith('[EN] ')
      ) {
        newTranslations[key] = translation;
        updatedCount++;
      } else if (currentValue !== translation) {
        // Update if translation is different
        newTranslations[key] = translation;
        updatedCount++;
      }
    } else {
      // Add new key
      newTranslations[key] = translation;
      updatedCount++;
    }
  }

  return {
    updated: newTranslations,
    count: updatedCount,
    total: Object.keys(csvTranslations).length,
  };
}

// Main function
async function main() {
  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    return;
  }

  if (!LANGUAGE || !INPUT_FILE) {
    log('❌ Error: Language and input file are required', 'red');
    log('Usage: npm run i18n:apply <language> --input=<file.csv>', 'yellow');
    return;
  }

  log('🔄 Applying Translations', 'cyan');
  log('');

  try {
    // Parse CSV file
    log(`📖 Reading translations from ${INPUT_FILE}...`, 'blue');
    const csvTranslations = parseCSV(INPUT_FILE);
    const csvCount = Object.keys(csvTranslations).length;

    if (csvCount === 0) {
      log('⚠️  No translations found in CSV file', 'yellow');
      return;
    }

    log(`✅ Found ${csvCount} translations in CSV`, 'green');

    // Apply translations
    log(`🌍 Applying translations to ${LANGUAGE}...`, 'blue');
    const result = applyTranslations(LANGUAGE, csvTranslations);

    if (DRY_RUN) {
      log(`🔍 DRY RUN: Would update ${result.count} translations`, 'yellow');
    } else {
      // Write updated translations
      const langPath = path.join(LOCALES_DIR, `${LANGUAGE}.ts`);
      const newContent = generateTypeScriptExport(result.updated, LANGUAGE);
      fs.writeFileSync(langPath, newContent, 'utf8');

      log(`✅ Updated ${result.count} translations in ${LANGUAGE}.ts`, 'green');
    }

    log('');
    log('📊 Summary:', 'bright');
    log(`   Translations in CSV: ${result.total}`, 'blue');
    log(`   Applied to file: ${result.count}`, 'green');

    if (result.count > 0 && !DRY_RUN) {
      log('');
      log('💡 Next steps:', 'yellow');
      log('   • Run "npm run i18n:status" to see updated progress');
      log('   • Run "npm run build" to verify everything works');
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    process.exit(1);
  }
}

function showHelp() {
  log('🔄 Apply Translations', 'cyan');
  log('');
  log(
    'Usage: npm run i18n:apply <language> --input=<file.csv> [options]',
    'bright'
  );
  log('');
  log('Languages:', 'bright');
  log('  es         Spanish');
  log('  fr         French');
  log('  de         German');
  log('  ja         Japanese');
  log('  pt         Portuguese');
  log('  vi         Vietnamese');
  log('');
  log('Options:', 'bright');
  log('  --input=file   CSV file with translations (required)');
  log('  --dry-run, -d  Preview changes without modifying files');
  log('  --help, -h     Show this help');
  log('');
  log('Examples:', 'bright');
  log(
    '  npm run i18n:apply pt --input=portuguese.csv     # Apply Portuguese translations'
  );
  log(
    '  npm run i18n:apply es --input=spanish.csv --dry-run  # Preview Spanish changes'
  );
  log('');
  log('CSV Format:', 'bright');
  log('  Key,English Text,Translation');
  log('  "about.appName","KiraPilot","KiraPiloto"');
  log('  "common.save","Save","Guardar"');
  log('');
  log('💡 Workflow:', 'yellow');
  log(
    '  1. Export untranslated keys: npm run i18n:translate pt --csv --output=pt.csv'
  );
  log('  2. Fill in translations in the CSV file');
  log('  3. Apply translations: npm run i18n:apply pt --input=pt.csv');
  log('');
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    log(`💥 Script failed: ${error.message}`, 'red');
    process.exit(1);
  });
}

export { applyTranslations, parseCSV };

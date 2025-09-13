#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const LOCALES_DIR = path.join(__dirname, '../src/i18n/locales');
const TARGET_LANGUAGES = ['es', 'fr', 'de', 'ja', 'pt', 'vi'];

// Command line arguments
const args = process.argv.slice(2);
const LANGUAGE = args.find(arg => !arg.startsWith('-')) || 'all';
const EXPORT_FORMAT = args.includes('--json')
  ? 'json'
  : args.includes('--csv')
    ? 'csv'
    : 'text';
const OUTPUT_FILE = args
  .find(arg => arg.startsWith('--output='))
  ?.split('=')[1];

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
    log(`Error parsing ${filePath}: ${error.message}`, 'red');
    return {};
  }
}

// Get untranslated keys for a language
function getUntranslatedKeys(langCode) {
  const langPath = path.join(LOCALES_DIR, `${langCode}.ts`);

  if (!fs.existsSync(langPath)) {
    return { error: 'File not found' };
  }

  const translations = parseTranslationFile(langPath);
  const untranslated = {};

  for (const [key, value] of Object.entries(translations)) {
    if (typeof value === 'string' && value.startsWith('[EN] ')) {
      untranslated[key] = value.substring(5); // Remove '[EN] ' prefix
    }
  }

  return untranslated;
}

// Export untranslated keys in different formats
function exportUntranslated(langCode, untranslated, format) {
  const count = Object.keys(untranslated).length;

  if (count === 0) {
    return `No untranslated keys found for ${langCode}`;
  }

  let output = '';

  switch (format) {
    case 'json':
      output = JSON.stringify(
        {
          language: langCode,
          count: count,
          untranslated: untranslated,
        },
        null,
        2
      );
      break;

    case 'csv':
      output = 'Key,English Text,Translation\n';
      for (const [key, value] of Object.entries(untranslated)) {
        const escapedValue = value.replace(/"/g, '""');
        output += `"${key}","${escapedValue}",""\n`;
      }
      break;

    default: // text
      output = `Untranslated keys for ${langCode} (${count} total):\n\n`;
      for (const [key, value] of Object.entries(untranslated)) {
        output += `${key}:\n  EN: ${value}\n  ${langCode.toUpperCase()}: \n\n`;
      }
      break;
  }

  return output;
}

// Main function
async function main() {
  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    return;
  }

  log('🌍 Translation Helper', 'cyan');
  log('');

  if (LANGUAGE === 'all') {
    // Show summary for all languages
    log('📊 Untranslated Keys Summary:', 'bright');
    log('');

    const languages = {
      es: 'Español',
      fr: 'Français',
      de: 'Deutsch',
      ja: '日本語',
      pt: 'Português',
      vi: 'Tiếng Việt',
    };

    let totalUntranslated = 0;

    for (const [code, name] of Object.entries(languages)) {
      const untranslated = getUntranslatedKeys(code);

      if (untranslated.error) {
        log(`  ${name.padEnd(12)} ❌ ${untranslated.error}`, 'red');
      } else {
        const count = Object.keys(untranslated).length;
        totalUntranslated += count;
        const color = count === 0 ? 'green' : count < 50 ? 'yellow' : 'red';
        log(
          `  ${name.padEnd(12)} ${count.toString().padStart(4)} untranslated keys`,
          color
        );
      }
    }

    log('');
    log(
      `Total untranslated keys: ${totalUntranslated}`,
      totalUntranslated === 0 ? 'green' : 'yellow'
    );

    if (totalUntranslated > 0) {
      log('');
      log('💡 Usage examples:', 'blue');
      log(
        '  npm run i18n:translate pt              # Show Portuguese untranslated keys'
      );
      log('  npm run i18n:translate pt --csv        # Export as CSV');
      log('  npm run i18n:translate pt --json       # Export as JSON');
      log('  npm run i18n:translate pt --output=pt.csv  # Save to file');
    }
  } else if (TARGET_LANGUAGES.includes(LANGUAGE)) {
    // Show untranslated keys for specific language
    const untranslated = getUntranslatedKeys(LANGUAGE);

    if (untranslated.error) {
      log(`❌ Error: ${untranslated.error}`, 'red');
      return;
    }

    const output = exportUntranslated(LANGUAGE, untranslated, EXPORT_FORMAT);

    if (OUTPUT_FILE) {
      fs.writeFileSync(OUTPUT_FILE, output);
      log(`✅ Exported to ${OUTPUT_FILE}`, 'green');
      log(`📊 ${Object.keys(untranslated).length} untranslated keys`, 'blue');
    } else {
      console.log(output);
    }
  } else {
    log(`❌ Invalid language code: ${LANGUAGE}`, 'red');
    log(`Available languages: ${TARGET_LANGUAGES.join(', ')}`, 'yellow');
  }
}

function showHelp() {
  log('🌍 Translation Helper', 'cyan');
  log('');
  log('Usage: npm run i18n:translate [language] [options]', 'bright');
  log('');
  log('Languages:', 'bright');
  log('  all        Show summary for all languages (default)');
  log('  es         Spanish');
  log('  fr         French');
  log('  de         German');
  log('  ja         Japanese');
  log('  pt         Portuguese');
  log('  vi         Vietnamese');
  log('');
  log('Options:', 'bright');
  log('  --json     Export as JSON format');
  log('  --csv      Export as CSV format (good for translation tools)');
  log('  --output=file  Save to file instead of displaying');
  log('  --help, -h Show this help');
  log('');
  log('Examples:', 'bright');
  log('  npm run i18n:translate                    # Show summary');
  log('  npm run i18n:translate pt                 # Show Portuguese keys');
  log('  npm run i18n:translate pt --csv           # Export as CSV');
  log('  npm run i18n:translate pt --output=pt.csv # Save CSV to file');
  log('  npm run i18n:translate ja --json          # Export Japanese as JSON');
  log('');
  log('💡 Tips:', 'yellow');
  log('  • Use CSV format for translation tools like Google Sheets');
  log('  • Use JSON format for automated translation services');
  log('  • Keys marked with [EN] need translation');
  log('');
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    log(`💥 Script failed: ${error.message}`, 'red');
    process.exit(1);
  });
}

export { getUntranslatedKeys, exportUntranslated };

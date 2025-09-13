#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  log('🌍 Translation Management Suite', 'cyan');
  log('');
  log('Available Commands:', 'bright');
  log('');
  log('📝 Content Management:', 'blue');
  log('  npm run i18n:fix              Fill missing translations from English');
  log('  npm run i18n:clean-duplicates Remove duplicate translation keys');
  log(
    '  npm run i18n:flatten          Convert nested objects to flat dot notation'
  );
  log('');
  log('🔍 Analysis & Validation:', 'blue');
  log('  npm run i18n:check            Check translation consistency');
  log('  npm run i18n:validate         Validate translation files');
  log('');
  log('📊 Data Management:', 'blue');
  log('  npm run i18n:export           Export translations');
  log('  npm run i18n:stubs            Generate translation stubs');
  log('  npm run i18n:translate        Show/export untranslated keys');
  log('  npm run i18n:apply            Apply translations from CSV');
  log('  npm run i18n:gemini           Auto-translate with Google Gemini AI');
  log('');
  log('🛠️  All-in-One Commands:', 'green');
  log('  npm run i18n:fix-all          Run fix + clean-duplicates + flatten');
  log('  npm run i18n:status           Show translation status report');
  log('');
  log('Options (add after --):', 'bright');
  log('  --dry-run, -d    Preview changes without modifying files');
  log('  --verbose, -v    Show detailed information');
  log('  --help, -h       Show help for specific command');
  log('');
  log('Examples:', 'bright');
  log('  npm run i18n:fix -- --dry-run     # Preview missing translations');
  log('  npm run i18n:fix-all              # Fix all translation issues');
  log('  npm run i18n:status               # Show current status');
  log(
    '  npm run i18n:translate pt --csv   # Export Portuguese for translation'
  );
  log(
    '  npm run i18n:gemini es --api-key=key  # Auto-translate Spanish with Gemini'
  );
  log('');
  log('🎯 Quick Start:', 'yellow');
  log('  1. Run "npm run i18n:status" to see current state');
  log('  2. Run "npm run i18n:fix-all" to fix all issues');
  log(
    '  3a. Auto-translate with AI: "npm run i18n:gemini es --api-key=your-key"'
  );
  log(
    '  3b. OR export for manual translation: "npm run i18n:translate pt --csv --output=pt.csv"'
  );
  log(
    '  4. If manual: Apply translations: "npm run i18n:apply pt --input=pt.csv"'
  );
  log('  5. Run "npm run build" to verify everything works');
  log('');
}

// Get translation statistics
async function getTranslationStats() {
  const LOCALES_DIR = path.join(__dirname, '../src/i18n/locales');
  const TARGET_LANGUAGES = ['en', 'es', 'fr', 'de', 'ja', 'pt', 'vi'];

  const stats = {};

  for (const lang of TARGET_LANGUAGES) {
    const langPath = path.join(LOCALES_DIR, `${lang}.ts`);

    if (fs.existsSync(langPath)) {
      try {
        const content = fs.readFileSync(langPath, 'utf8');
        const keyMatches = content.match(/'[^']+'\s*:/g);
        const keyCount = keyMatches ? keyMatches.length : 0;

        // Count [EN] prefixed keys (missing translations)
        const enPrefixMatches = content.match(/'[^']*\[EN\][^']*'/g);
        const missingCount = enPrefixMatches ? enPrefixMatches.length : 0;

        stats[lang] = {
          total: keyCount,
          missing: missingCount,
          translated: keyCount - missingCount,
          percentage:
            keyCount > 0
              ? Math.round(((keyCount - missingCount) / keyCount) * 100)
              : 0,
        };
      } catch (error) {
        stats[lang] = { error: error.message };
      }
    } else {
      stats[lang] = { error: 'File not found' };
    }
  }

  return stats;
}

// Show translation status
async function showStatus() {
  log('📊 Translation Status Report', 'cyan');
  log('');

  const stats = await getTranslationStats();

  log('Language Coverage:', 'bright');
  log('');

  const languages = {
    en: 'English',
    es: 'Español',
    fr: 'Français',
    de: 'Deutsch',
    ja: '日本語',
    pt: 'Português',
    vi: 'Tiếng Việt',
  };

  let totalKeys = 0;
  let totalMissing = 0;

  for (const [code, name] of Object.entries(languages)) {
    const stat = stats[code];

    if (stat.error) {
      log(`  ${name.padEnd(12)} ❌ ${stat.error}`, 'red');
    } else {
      const bar = '█'.repeat(Math.floor(stat.percentage / 5));
      const emptyBar = '░'.repeat(20 - Math.floor(stat.percentage / 5));
      const color =
        stat.percentage >= 90
          ? 'green'
          : stat.percentage >= 70
            ? 'yellow'
            : 'red';

      log(
        `  ${name.padEnd(12)} ${bar}${emptyBar} ${stat.percentage}% (${stat.translated}/${stat.total})`,
        color
      );

      if (code === 'en') {
        totalKeys = stat.total;
      } else {
        totalMissing += stat.missing;
      }
    }
  }

  log('');
  log('Summary:', 'bright');
  log(`  📝 Total keys: ${totalKeys}`, 'blue');
  log(
    `  ❌ Missing translations: ${totalMissing}`,
    totalMissing > 0 ? 'red' : 'green'
  );
  log(
    `  ✅ Overall completion: ${totalKeys > 0 ? Math.round(((totalKeys * 6 - totalMissing) / (totalKeys * 6)) * 100) : 0}%`,
    'blue'
  );

  if (totalMissing > 0) {
    log('');
    log('💡 Recommendations:', 'yellow');
    log('  • Run "npm run i18n:fix" to add missing translations');
    log('  • Run "npm run i18n:clean-duplicates" to remove duplicates');
    log('  • Run "npm run i18n:fix-all" to fix all issues at once');
  } else {
    log('');
    log('🎉 All translations are complete!', 'green');
  }
}

// Main command handler
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'status':
      await showStatus();
      break;

    case 'help':
    case '--help':
    case '-h':
    default:
      showHelp();
      break;
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    log(`💥 Script failed: ${error.message}`, 'red');
    process.exit(1);
  });
}

export { showStatus, getTranslationStats };

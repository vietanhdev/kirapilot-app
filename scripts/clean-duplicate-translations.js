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

// Parse and clean duplicate keys from a translation file
function cleanDuplicateKeys(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    const seenKeys = new Set();
    const duplicateLines = [];
    const cleanedLines = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Match translation key lines (e.g., 'key': 'value',)
      const keyMatch = line.match(/^\s*'([^']+)':\s*'.*',?\s*$/);

      if (keyMatch) {
        const key = keyMatch[1];

        if (seenKeys.has(key)) {
          duplicateLines.push({
            line: i + 1,
            key: key,
            content: line.trim(),
          });
          // Skip this duplicate line
          continue;
        } else {
          seenKeys.add(key);
        }
      }

      cleanedLines.push(line);
    }

    return {
      originalContent: content,
      cleanedContent: cleanedLines.join('\n'),
      duplicates: duplicateLines,
      hasChanges: duplicateLines.length > 0,
    };
  } catch (error) {
    log(`Error processing ${filePath}: ${error.message}`, 'red');
    return {
      originalContent: '',
      cleanedContent: '',
      duplicates: [],
      hasChanges: false,
      error: error.message,
    };
  }
}

// Main function to clean duplicates
async function cleanDuplicates() {
  log('🧹 Starting duplicate key cleanup...', 'cyan');

  if (DRY_RUN) {
    log('🔍 Running in DRY RUN mode - no files will be modified', 'yellow');
  }

  const report = {
    processed: 0,
    totalDuplicates: 0,
    filesChanged: 0,
    errors: [],
  };

  for (const langCode of TARGET_LANGUAGES) {
    const langPath = path.join(LOCALES_DIR, `${langCode}.ts`);

    if (!fs.existsSync(langPath)) {
      log(`⚠️  Language file not found: ${langPath}`, 'yellow');
      continue;
    }

    log(`\n🌍 Processing ${langCode}...`, 'blue');

    const result = cleanDuplicateKeys(langPath);

    if (result.error) {
      report.errors.push(`${langCode}: ${result.error}`);
      continue;
    }

    report.processed++;

    if (result.hasChanges) {
      report.totalDuplicates += result.duplicates.length;
      report.filesChanged++;

      log(`  🔍 Found ${result.duplicates.length} duplicate keys:`, 'yellow');
      result.duplicates.forEach(dup => {
        log(`     Line ${dup.line}: '${dup.key}'`, 'yellow');
      });

      if (!DRY_RUN) {
        fs.writeFileSync(langPath, result.cleanedContent, 'utf8');
        log(`  💾 File cleaned and saved`, 'green');
      } else {
        log(`  💾 Would clean file (dry run)`, 'yellow');
      }
    } else {
      log(`  ✅ No duplicate keys found`, 'green');
    }
  }

  // Print final report
  log('\n📊 Final Report:', 'cyan');
  log(
    `   Files processed: ${report.processed}/${TARGET_LANGUAGES.length}`,
    'bright'
  );
  log(`   Files with duplicates: ${report.filesChanged}`, 'bright');
  log(`   Total duplicates removed: ${report.totalDuplicates}`, 'bright');

  if (report.errors.length > 0) {
    log('\n❌ Errors:', 'red');
    report.errors.forEach(error => log(`   ${error}`, 'red'));
  }

  if (report.totalDuplicates > 0) {
    log(
      `\n🎉 Cleanup complete! Removed ${report.totalDuplicates} duplicate keys from ${report.filesChanged} files.`,
      'green'
    );
  } else {
    log('\n✨ All files are clean - no duplicates found!', 'green');
  }
}

function showHelp() {
  log('🧹 Duplicate Key Cleanup Script', 'cyan');
  log('');
  log(
    'Usage: node scripts/clean-duplicate-translations.js [options]',
    'bright'
  );
  log('');
  log('Options:', 'bright');
  log('  --dry-run, -d    Show what would be changed without modifying files');
  log('  --help, -h       Show this help message');
  log('');
  log('Examples:', 'bright');
  log(
    '  node scripts/clean-duplicate-translations.js                # Clean duplicates'
  );
  log(
    '  node scripts/clean-duplicate-translations.js --dry-run      # Preview changes'
  );
  log('');
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }

  cleanDuplicates().catch(error => {
    log(`💥 Script failed: ${error.message}`, 'red');
    process.exit(1);
  });
}

export { cleanDuplicates };

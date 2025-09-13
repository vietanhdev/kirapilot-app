#!/usr/bin/env node

/**
 * Translation Utilities for KiraPilot
 *
 * Additional utilities for managing translations:
 * - Setup Gemini API key
 * - Test translation quality
 * - Generate translation reports
 * - Clean up unused keys
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOCALES_DIR = path.join(__dirname, '../src/i18n/locales');
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

/**
 * Parse translation file
 */
function parseTranslationFile(language) {
  try {
    const filePath = path.join(LOCALES_DIR, `${language}.ts`);
    const content = fs.readFileSync(filePath, 'utf8');

    const match = content.match(/export const \w+ = \{([\s\S]*)\};/);
    if (!match) {
      throw new Error(`Could not parse translations from ${language}.ts`);
    }

    const translationsText = match[1];
    const translations = {};

    const keyValueRegex = /'([^']+)':\s*'((?:[^'\\]|\\.)*)'/g;
    let keyMatch;

    while ((keyMatch = keyValueRegex.exec(translationsText)) !== null) {
      const key = keyMatch[1];
      const value = keyMatch[2].replace(/\\'/g, "'").replace(/\\n/g, '\n');
      translations[key] = value;
    }

    return translations;
  } catch (error) {
    log(`Error parsing ${language}.ts: ${error.message}`, 'red');
    return {};
  }
}

/**
 * Generate detailed translation report
 */
function generateDetailedReport() {
  log('\n📊 Detailed Translation Report', 'bright');
  log('==============================', 'bright');

  const allKeys = new Set();
  const languageData = {};

  // Collect all data
  for (const language of SUPPORTED_LANGUAGES) {
    const translations = parseTranslationFile(language);
    languageData[language] = translations;
    Object.keys(translations).forEach(key => allKeys.add(key));
  }

  const sortedKeys = Array.from(allKeys).sort();
  const englishKeys = Object.keys(languageData.en || {});

  log(`\n🔢 Statistics:`, 'blue');
  log(`  Total unique keys: ${sortedKeys.length}`);
  log(`  English keys: ${englishKeys.length}`);
  log(
    `  Keys only in other languages: ${sortedKeys.length - englishKeys.length}`
  );

  // Language coverage
  log(`\n🌍 Language Coverage:`, 'blue');
  for (const language of SUPPORTED_LANGUAGES) {
    const translations = languageData[language] || {};
    const keyCount = Object.keys(translations).length;
    const coverage =
      englishKeys.length > 0
        ? Math.round((keyCount / englishKeys.length) * 100)
        : 0;
    const missingCount = englishKeys.filter(key => !translations[key]).length;

    const coverageColor =
      coverage >= 95 ? 'green' : coverage >= 80 ? 'yellow' : 'red';
    log(
      `  ${language.toUpperCase()}: ${keyCount} keys (${coverage}% coverage, ${missingCount} missing)`,
      coverageColor
    );
  }

  // Key categories
  log(`\n📂 Key Categories:`, 'blue');
  const categories = {};
  sortedKeys.forEach(key => {
    const category = key.split('.')[0];
    if (!categories[category]) categories[category] = 0;
    categories[category]++;
  });

  Object.entries(categories)
    .sort(([, a], [, b]) => b - a)
    .forEach(([category, count]) => {
      log(`  ${category}: ${count} keys`);
    });

  // Find potential issues
  log(`\n⚠️  Potential Issues:`, 'yellow');

  // Keys with placeholder text
  const placeholderKeys = [];
  for (const [language, translations] of Object.entries(languageData)) {
    if (language === 'en') continue;

    Object.entries(translations).forEach(([key, value]) => {
      if (
        value.startsWith(`[${language.toUpperCase()}]`) ||
        value.startsWith('[EN]')
      ) {
        placeholderKeys.push(`${language}: ${key}`);
      }
    });
  }

  if (placeholderKeys.length > 0) {
    log(`  Placeholder translations found: ${placeholderKeys.length}`);
    placeholderKeys.slice(0, 5).forEach(item => log(`    - ${item}`));
    if (placeholderKeys.length > 5) {
      log(`    ... and ${placeholderKeys.length - 5} more`);
    }
  }

  // Very long translations
  const longTranslations = [];
  for (const [language, translations] of Object.entries(languageData)) {
    Object.entries(translations).forEach(([key, value]) => {
      if (value.length > 200) {
        longTranslations.push(`${language}: ${key} (${value.length} chars)`);
      }
    });
  }

  if (longTranslations.length > 0) {
    log(`  Very long translations: ${longTranslations.length}`);
    longTranslations.slice(0, 3).forEach(item => log(`    - ${item}`));
  }

  // Empty translations
  const emptyTranslations = [];
  for (const [language, translations] of Object.entries(languageData)) {
    Object.entries(translations).forEach(([key, value]) => {
      if (!value.trim()) {
        emptyTranslations.push(`${language}: ${key}`);
      }
    });
  }

  if (emptyTranslations.length > 0) {
    log(`  Empty translations: ${emptyTranslations.length}`);
    emptyTranslations.forEach(item => log(`    - ${item}`));
  }

  if (
    placeholderKeys.length === 0 &&
    longTranslations.length === 0 &&
    emptyTranslations.length === 0
  ) {
    log(`  ✅ No issues found!`, 'green');
  }
}

/**
 * Test Gemini API connection
 */
async function testGeminiConnection() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    log('❌ GEMINI_API_KEY environment variable not set', 'red');
    log('\nTo set up Gemini API:', 'cyan');
    log('1. Go to https://makersuite.google.com/app/apikey', 'cyan');
    log('2. Create a new API key', 'cyan');
    log('3. Set the environment variable:', 'cyan');
    log('   export GEMINI_API_KEY=your_api_key_here', 'yellow');
    log('4. Or add it to your .env file:', 'cyan');
    log('   GEMINI_API_KEY=your_api_key_here', 'yellow');
    return false;
  }

  log('🔄 Testing Gemini API connection...', 'blue');

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: 'Translate "Hello" to Spanish',
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 100,
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const result = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (result && result.toLowerCase().includes('hola')) {
      log('✅ Gemini API connection successful!', 'green');
      log(`   Test translation: ${result.trim()}`, 'cyan');
      return true;
    } else {
      log('⚠️  API responded but translation seems incorrect', 'yellow');
      log(`   Response: ${result}`, 'yellow');
      return false;
    }
  } catch (error) {
    log(`❌ Gemini API test failed: ${error.message}`, 'red');
    return false;
  }
}

/**
 * Clean up unused translation keys
 */
async function cleanupUnusedKeys() {
  log('\n🧹 Cleaning up unused translation keys...', 'blue');

  // This is a simplified version - in a real implementation,
  // you'd scan the entire codebase for key usage
  log('⚠️  This feature requires scanning the entire codebase', 'yellow');
  log('   For now, manually review keys that seem unused', 'yellow');

  // Find keys that might be unused (very basic heuristic)
  const englishTranslations = parseTranslationFile('en');
  const suspiciousKeys = [];

  Object.keys(englishTranslations).forEach(key => {
    // Keys that look like they might be test keys or old keys
    if (
      key.includes('test') ||
      key.includes('old') ||
      key.includes('deprecated')
    ) {
      suspiciousKeys.push(key);
    }
  });

  if (suspiciousKeys.length > 0) {
    log(`\n🔍 Potentially unused keys found:`, 'yellow');
    suspiciousKeys.forEach(key => {
      log(`  - ${key}: "${englishTranslations[key]}"`, 'yellow');
    });
    log('\n💡 Review these keys manually and remove if not used', 'cyan');
  } else {
    log('✅ No obviously unused keys found', 'green');
  }
}

/**
 * Export translations to different formats
 */
function exportTranslations(format = 'json') {
  log(`\n📤 Exporting translations to ${format.toUpperCase()}...`, 'blue');

  const allTranslations = {};
  for (const language of SUPPORTED_LANGUAGES) {
    allTranslations[language] = parseTranslationFile(language);
  }

  const outputDir = path.join(__dirname, '../exports');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  switch (format.toLowerCase()) {
    case 'json':
      const jsonFile = path.join(outputDir, 'translations.json');
      fs.writeFileSync(jsonFile, JSON.stringify(allTranslations, null, 2));
      log(`✅ Exported to ${jsonFile}`, 'green');
      break;

    case 'csv':
      const englishKeys = Object.keys(allTranslations.en || {});
      const csvRows = ['Key,' + SUPPORTED_LANGUAGES.join(',')];

      englishKeys.forEach(key => {
        const row = [key];
        SUPPORTED_LANGUAGES.forEach(lang => {
          const value = allTranslations[lang]?.[key] || '';
          row.push(`"${value.replace(/"/g, '""')}"`);
        });
        csvRows.push(row.join(','));
      });

      const csvFile = path.join(outputDir, 'translations.csv');
      fs.writeFileSync(csvFile, csvRows.join('\n'));
      log(`✅ Exported to ${csvFile}`, 'green');
      break;

    default:
      log(`❌ Unsupported format: ${format}`, 'red');
  }
}

/**
 * Show usage information
 */
function showUsage() {
  console.log(`
🌐 KiraPilot Translation Utilities

Usage: node scripts/translation-utils.js <command> [options]

Commands:
  report          Generate detailed translation report
  test-gemini     Test Gemini API connection
  cleanup         Find and suggest unused translation keys
  export <format> Export translations (json, csv)
  help            Show this help message

Examples:
  node scripts/translation-utils.js report
  node scripts/translation-utils.js test-gemini
  node scripts/translation-utils.js export json
  node scripts/translation-utils.js export csv
`);
}

/**
 * Main execution
 */
async function main() {
  const command = process.argv[2];
  const arg = process.argv[3];

  switch (command) {
    case 'report':
      generateDetailedReport();
      break;

    case 'test-gemini':
      await testGeminiConnection();
      break;

    case 'cleanup':
      await cleanupUnusedKeys();
      break;

    case 'export':
      exportTranslations(arg || 'json');
      break;

    case 'help':
    default:
      showUsage();
      break;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
}

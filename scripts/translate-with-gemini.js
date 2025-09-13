#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const LOCALES_DIR = path.join(__dirname, '../src/i18n/locales');
const TARGET_LANGUAGES = ['es', 'fr', 'de', 'ja', 'pt', 'vi', 'zh'];

// Command line arguments
const args = process.argv.slice(2);
const LANGUAGE = args.find(arg => !arg.startsWith('-'));
const API_KEY =
  args.find(arg => arg.startsWith('--api-key='))?.split('=')[1] ||
  process.env.GEMINI_API_KEY;
const DRY_RUN = args.includes('--dry-run') || args.includes('-d');
const BATCH_SIZE =
  parseInt(args.find(arg => arg.startsWith('--batch-size='))?.split('=')[1]) ||
  20;

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

// Language configurations
const languageConfigs = {
  es: { name: 'Spanish', nativeName: 'Español' },
  fr: { name: 'French', nativeName: 'Français' },
  de: { name: 'German', nativeName: 'Deutsch' },
  ja: { name: 'Japanese', nativeName: '日本語' },
  pt: { name: 'Portuguese', nativeName: 'Português' },
  vi: { name: 'Vietnamese', nativeName: 'Tiếng Việt' },
  zh: { name: 'Chinese', nativeName: '中文' },
};

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

// Get untranslated keys for a language
function getUntranslatedKeys(langCode) {
  const langPath = path.join(LOCALES_DIR, `${langCode}.ts`);

  if (!fs.existsSync(langPath)) {
    throw new Error(`Translation file not found: ${langPath}`);
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

// Call Gemini API to translate a batch of texts
async function translateWithGemini(texts, targetLanguage, apiKey) {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const langConfig = languageConfigs[targetLanguage];

  const prompt = `You are a professional translator for a productivity application called KiraPilot. 
Translate the following English texts to ${langConfig.name} (${langConfig.nativeName}).

Context: KiraPilot is an intelligent productivity assistant that helps users manage tasks, track time, and boost productivity with AI assistance.

Instructions:
1. Provide natural, user-friendly translations appropriate for a productivity app
2. Keep technical terms consistent (e.g., "API", "JSON", "SQLite" should remain as-is)
3. Maintain placeholder variables like {count}, {title}, {error} exactly as they are
4. For UI elements, use standard terminology that users would expect
5. Return ONLY the translations in the same order, one per line
6. Do not include explanations or additional text

English texts to translate:
${texts.map((text, index) => `${index + 1}. ${text}`).join('\n')}`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const translatedText = response.text();

    // Parse the response to extract individual translations
    const lines = translatedText.trim().split('\n');
    const translations = lines
      .map(line => line.replace(/^\d+\.\s*/, '').trim()) // Remove numbering
      .filter(line => line.length > 0);

    if (translations.length !== texts.length) {
      throw new Error(
        `Expected ${texts.length} translations, got ${translations.length}`
      );
    }

    return translations;
  } catch (error) {
    throw new Error(`Gemini API error: ${error.message}`);
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

// Apply translations to the translation file
function applyTranslations(langCode, newTranslations) {
  const langPath = path.join(LOCALES_DIR, `${langCode}.ts`);
  const currentTranslations = parseTranslationFile(langPath);

  // Update translations
  const updatedTranslations = { ...currentTranslations };
  let updatedCount = 0;

  for (const [key, translation] of Object.entries(newTranslations)) {
    if (updatedTranslations.hasOwnProperty(key)) {
      updatedTranslations[key] = translation;
      updatedCount++;
    }
  }

  return { updatedTranslations, updatedCount };
}

// Main translation function
async function translateLanguage(langCode, apiKey) {
  const langConfig = languageConfigs[langCode];

  log(
    `🌍 Translating to ${langConfig.name} (${langConfig.nativeName})...`,
    'blue'
  );

  // Get untranslated keys
  const untranslated = getUntranslatedKeys(langCode);
  const keys = Object.keys(untranslated);
  const texts = Object.values(untranslated);

  if (keys.length === 0) {
    log(`✅ No untranslated keys found for ${langConfig.name}`, 'green');
    return { translated: 0, total: 0 };
  }

  log(`📝 Found ${keys.length} untranslated keys`, 'yellow');

  if (DRY_RUN) {
    log(`🔍 DRY RUN: Would translate ${keys.length} keys`, 'yellow');
    return { translated: keys.length, total: keys.length };
  }

  const newTranslations = {};
  let processedCount = 0;

  // Process in batches to avoid API limits
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const batchKeys = keys.slice(i, i + BATCH_SIZE);

    log(
      `🔄 Translating batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(texts.length / BATCH_SIZE)} (${batch.length} items)...`,
      'blue'
    );

    try {
      const translations = await translateWithGemini(batch, langCode, apiKey);

      // Map translations back to keys
      for (let j = 0; j < batchKeys.length; j++) {
        newTranslations[batchKeys[j]] = translations[j];
      }

      processedCount += batch.length;
      log(`✅ Translated ${processedCount}/${texts.length} keys`, 'green');

      // Add a small delay to be respectful to the API
      if (i + BATCH_SIZE < texts.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      log(`❌ Error translating batch: ${error.message}`, 'red');
      throw error;
    }
  }

  // Apply translations to file
  const { updatedTranslations, updatedCount } = applyTranslations(
    langCode,
    newTranslations
  );

  // Write updated file
  const langPath = path.join(LOCALES_DIR, `${langCode}.ts`);
  const newContent = generateTypeScriptExport(updatedTranslations, langCode);
  fs.writeFileSync(langPath, newContent, 'utf8');

  log(`💾 Updated ${updatedCount} translations in ${langCode}.ts`, 'green');

  return { translated: updatedCount, total: keys.length };
}

// Main function
async function main() {
  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    return;
  }

  if (!API_KEY && !DRY_RUN) {
    log('❌ Error: Gemini API key is required', 'red');
    log(
      'Set GEMINI_API_KEY environment variable or use --api-key=<key>',
      'yellow'
    );
    log(
      'Get your free API key from: https://makersuite.google.com/app/apikey',
      'blue'
    );
    return;
  }

  if (!LANGUAGE || !TARGET_LANGUAGES.includes(LANGUAGE)) {
    log(`❌ Error: Invalid language code: ${LANGUAGE}`, 'red');
    log(`Available languages: ${TARGET_LANGUAGES.join(', ')}`, 'yellow');
    return;
  }

  log('🤖 Gemini Translation Service', 'cyan');
  log('');

  if (DRY_RUN) {
    log('🔍 Running in DRY RUN mode - no files will be modified', 'yellow');
    log('');
  }

  try {
    const result = await translateLanguage(LANGUAGE, API_KEY);

    log('');
    log('📊 Translation Summary:', 'bright');
    log(`   Language: ${languageConfigs[LANGUAGE].name}`, 'blue');
    log(`   Translated: ${result.translated} keys`, 'green');
    log(`   Total processed: ${result.total} keys`, 'blue');

    if (result.translated > 0 && !DRY_RUN) {
      log('');
      log('💡 Next steps:', 'yellow');
      log('   • Run "npm run i18n:status" to see updated progress');
      log('   • Run "npm run build" to verify everything works');
      log('   • Review translations for accuracy and context');
    }
  } catch (error) {
    log(`❌ Translation failed: ${error.message}`, 'red');
    process.exit(1);
  }
}

function showHelp() {
  log('🤖 Gemini Translation Service', 'cyan');
  log('');
  log('Usage: npm run i18n:gemini <language> [options]', 'bright');
  log('');
  log('Languages:', 'bright');
  log('  es         Spanish (Español)');
  log('  fr         French (Français)');
  log('  de         German (Deutsch)');
  log('  ja         Japanese (日本語)');
  log('  pt         Portuguese (Português)');
  log('  vi         Vietnamese (Tiếng Việt)');
  log('  zh         Chinese (中文)');
  log('');
  log('Options:', 'bright');
  log('  --api-key=<key>      Gemini API key (or set GEMINI_API_KEY env var)');
  log(
    '  --batch-size=<num>   Number of texts to translate per API call (default: 20)'
  );
  log('  --dry-run, -d        Preview what would be translated');
  log('  --help, -h           Show this help');
  log('');
  log('Examples:', 'bright');
  log('  npm run i18n:gemini es --api-key=your-key-here');
  log('  npm run i18n:gemini fr --dry-run');
  log('  GEMINI_API_KEY=your-key npm run i18n:gemini ja');
  log('');
  log('Setup:', 'yellow');
  log(
    '  1. Get a free Gemini API key: https://makersuite.google.com/app/apikey'
  );
  log('  2. Set environment variable: export GEMINI_API_KEY=your-key');
  log('  3. Run translation: npm run i18n:gemini <language>');
  log('');
  log('Features:', 'green');
  log('  • Batch processing for efficiency');
  log('  • Context-aware translations for productivity apps');
  log('  • Preserves technical terms and placeholders');
  log('  • Automatic file updates with proper formatting');
  log('');
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    log(`💥 Script failed: ${error.message}`, 'red');
    process.exit(1);
  });
}

export { translateLanguage };

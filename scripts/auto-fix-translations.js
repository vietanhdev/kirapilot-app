#!/usr/bin/env node

/**
 * Automatic Translation Fixer for KiraPilot
 *
 * This script:
 * 1. Collects all translation keys from all language files
 * 2. Creates a comprehensive English reference with all keys
 * 3. Fills missing translations in other languages from English
 * 4. Uses Gemini AI to translate missing entries
 * 5. Validates and formats the results
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const LOCALES_DIR = path.join(__dirname, '../src/i18n/locales');
const SUPPORTED_LANGUAGES = ['en', 'es', 'fr', 'de', 'vi', 'ja', 'pt'];
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Language mappings for Gemini
const LANGUAGE_NAMES = {
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  vi: 'Vietnamese',
  ja: 'Japanese',
  pt: 'Portuguese',
};

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
 * Parse translation file and extract key-value pairs
 */
function parseTranslationFile(language) {
  try {
    const filePath = path.join(LOCALES_DIR, `${language}.ts`);
    const content = fs.readFileSync(filePath, 'utf8');

    // Extract translation object using regex
    const match = content.match(/export const \w+ = \{([\s\S]*)\};/);
    if (!match) {
      throw new Error(`Could not parse translations from ${language}.ts`);
    }

    const translationsText = match[1];
    const translations = {};

    // Parse key-value pairs with better regex that handles nested quotes
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
 * Collect all unique translation keys from all language files
 */
function collectAllTranslationKeys() {
  log('\n🔍 Collecting all translation keys from all languages...', 'blue');

  const allKeys = new Set();
  const languageData = {};

  for (const language of SUPPORTED_LANGUAGES) {
    const translations = parseTranslationFile(language);
    languageData[language] = translations;

    Object.keys(translations).forEach(key => allKeys.add(key));
    log(`  ${language}: ${Object.keys(translations).length} keys`, 'cyan');
  }

  const sortedKeys = Array.from(allKeys).sort();
  log(`\n📊 Total unique keys found: ${sortedKeys.length}`, 'bright');

  return { allKeys: sortedKeys, languageData };
}

/**
 * Create comprehensive English reference with all keys
 */
function createComprehensiveEnglishReference(allKeys, languageData) {
  log('\n🇺🇸 Creating comprehensive English reference...', 'blue');

  const englishTranslations = languageData.en || {};
  const missingInEnglish = [];
  const comprehensiveEnglish = { ...englishTranslations };

  // Find keys missing in English and use fallbacks
  for (const key of allKeys) {
    if (!englishTranslations[key]) {
      missingInEnglish.push(key);

      // Try to find the key in other languages as fallback
      let fallbackValue = key; // Use key as last resort

      for (const lang of ['es', 'fr', 'de', 'vi', 'ja', 'pt']) {
        if (languageData[lang] && languageData[lang][key]) {
          // Use the value from another language as placeholder
          fallbackValue = `[EN] ${languageData[lang][key]}`;
          break;
        }
      }

      comprehensiveEnglish[key] = fallbackValue;
    }
  }

  if (missingInEnglish.length > 0) {
    log(`  Found ${missingInEnglish.length} keys missing in English`, 'yellow');
    log(`  Added fallback values for missing keys`, 'cyan');
  }

  return { comprehensiveEnglish, missingInEnglish };
}

/**
 * Call Gemini API to translate text
 */
async function translateWithGemini(
  texts,
  targetLanguage,
  sourceLanguage = 'en'
) {
  if (!GEMINI_API_KEY) {
    log('⚠️  GEMINI_API_KEY not found. Skipping AI translation.', 'yellow');
    return texts.map(text => `[${targetLanguage.toUpperCase()}] ${text}`);
  }

  try {
    const languageName = LANGUAGE_NAMES[targetLanguage];
    if (!languageName) {
      throw new Error(`Unsupported language: ${targetLanguage}`);
    }

    // Prepare the prompt
    const prompt = `You are a professional translator for a productivity application called KiraPilot. 
Translate the following UI text from English to ${languageName}.

Context: These are user interface strings for a task management and AI assistant application.
Keep the same tone and style. Preserve any variable placeholders like {title}, {{current}}, etc.
For technical terms, use commonly accepted translations in ${languageName}.

Translate each line separately and maintain the same order:

${texts.map((text, i) => `${i + 1}. ${text}`).join('\n')}

Respond with only the translations, one per line, in the same order:`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`,
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
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.3,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 8192,
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(
        `Gemini API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    const translatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!translatedText) {
      throw new Error('No translation received from Gemini');
    }

    // Parse the response
    const translations = translatedText
      .trim()
      .split('\n')
      .map(line => {
        // Remove numbering if present
        return line.replace(/^\d+\.\s*/, '').trim();
      });

    if (translations.length !== texts.length) {
      log(
        `⚠️  Translation count mismatch for ${targetLanguage}. Expected ${texts.length}, got ${translations.length}`,
        'yellow'
      );
      // Pad with fallbacks if needed
      while (translations.length < texts.length) {
        translations.push(
          `[${targetLanguage.toUpperCase()}] ${texts[translations.length]}`
        );
      }
    }

    return translations;
  } catch (error) {
    log(`❌ Translation failed for ${targetLanguage}: ${error.message}`, 'red');
    // Return fallback translations
    return texts.map(text => `[${targetLanguage.toUpperCase()}] ${text}`);
  }
}

/**
 * Fill missing translations for a language
 */
async function fillMissingTranslations(
  language,
  allKeys,
  languageData,
  comprehensiveEnglish
) {
  if (language === 'en') return comprehensiveEnglish;

  log(
    `\n🌐 Processing ${language.toUpperCase()} (${LANGUAGE_NAMES[language]})...`,
    'blue'
  );

  const currentTranslations = languageData[language] || {};
  const missingKeys = allKeys.filter(key => !currentTranslations[key]);

  if (missingKeys.length === 0) {
    log(`  ✅ No missing translations`, 'green');
    return currentTranslations;
  }

  log(`  📝 Found ${missingKeys.length} missing translations`, 'yellow');

  // Get English values for missing keys
  const englishValues = missingKeys.map(key => comprehensiveEnglish[key]);

  // Translate in batches to avoid API limits
  const batchSize = 20;
  const translatedValues = [];

  for (let i = 0; i < englishValues.length; i += batchSize) {
    const batch = englishValues.slice(i, i + batchSize);
    log(
      `  🔄 Translating batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(englishValues.length / batchSize)}...`,
      'cyan'
    );

    const batchTranslations = await translateWithGemini(batch, language);
    translatedValues.push(...batchTranslations);

    // Add delay to respect API rate limits
    if (i + batchSize < englishValues.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Merge translations
  const updatedTranslations = { ...currentTranslations };
  missingKeys.forEach((key, index) => {
    updatedTranslations[key] = translatedValues[index];
  });

  log(`  ✅ Added ${missingKeys.length} translations`, 'green');
  return updatedTranslations;
}

/**
 * Generate formatted translation file content
 */
function generateTranslationFileContent(language, translations) {
  const sortedKeys = Object.keys(translations).sort();

  // Group keys by prefix for better organization
  const groups = {};
  sortedKeys.forEach(key => {
    const prefix = key.split('.')[0];
    if (!groups[prefix]) groups[prefix] = [];
    groups[prefix].push(key);
  });

  let content = `export const ${language} = {\n`;

  const groupOrder = [
    'about',
    'buildInfo',
    'ai',
    'common',
    'day',
    'kira',
    'nav',
    'settings',
    'tasks',
    'timer',
    'reports',
    'planning',
    'notifications',
  ];
  const processedGroups = new Set();

  // Process groups in preferred order
  for (const groupName of groupOrder) {
    if (groups[groupName]) {
      content += `  // ${groupName.charAt(0).toUpperCase() + groupName.slice(1)}\n`;
      for (const key of groups[groupName]) {
        const value = translations[key]
          .replace(/'/g, "\\'")
          .replace(/\n/g, '\\n');
        content += `  '${key}': '${value}',\n`;
      }
      content += '\n';
      processedGroups.add(groupName);
    }
  }

  // Process remaining groups
  for (const [groupName, keys] of Object.entries(groups)) {
    if (!processedGroups.has(groupName)) {
      content += `  // ${groupName.charAt(0).toUpperCase() + groupName.slice(1)}\n`;
      for (const key of keys) {
        const value = translations[key]
          .replace(/'/g, "\\'")
          .replace(/\n/g, '\\n');
        content += `  '${key}': '${value}',\n`;
      }
      content += '\n';
    }
  }

  content += '};\n';
  return content;
}

/**
 * Write translation file
 */
function writeTranslationFile(language, translations) {
  const filePath = path.join(LOCALES_DIR, `${language}.ts`);
  const content = generateTranslationFileContent(language, translations);

  // Create backup
  if (fs.existsSync(filePath)) {
    const backupPath = `${filePath}.backup.${Date.now()}`;
    fs.copyFileSync(filePath, backupPath);
    log(`  💾 Backup created: ${path.basename(backupPath)}`, 'cyan');
  }

  fs.writeFileSync(filePath, content, 'utf8');
  log(`  ✅ Updated ${language}.ts`, 'green');
}

/**
 * Validate translations
 */
function validateTranslations(allKeys, languageData) {
  log('\n🔍 Validating translations...', 'blue');

  let totalIssues = 0;

  for (const language of SUPPORTED_LANGUAGES) {
    const translations = languageData[language];
    const missingKeys = allKeys.filter(key => !translations[key]);
    const extraKeys = Object.keys(translations).filter(
      key => !allKeys.includes(key)
    );

    if (missingKeys.length > 0 || extraKeys.length > 0) {
      log(
        `  ${language}: ${missingKeys.length} missing, ${extraKeys.length} extra`,
        'yellow'
      );
      totalIssues += missingKeys.length + extraKeys.length;
    } else {
      log(`  ${language}: ✅ Complete`, 'green');
    }
  }

  if (totalIssues === 0) {
    log('  🎉 All translations are complete!', 'green');
  } else {
    log(`  ⚠️  Found ${totalIssues} total issues`, 'yellow');
  }

  return totalIssues === 0;
}

/**
 * Main execution function
 */
async function main() {
  log('🌐 KiraPilot Automatic Translation Fixer', 'bright');
  log('=====================================', 'bright');

  if (!GEMINI_API_KEY) {
    log(
      '\n⚠️  Warning: GEMINI_API_KEY environment variable not set.',
      'yellow'
    );
    log(
      '   Translations will use placeholder text instead of AI translation.',
      'yellow'
    );
    log('   Set GEMINI_API_KEY to enable AI translation.\n', 'yellow');
  }

  try {
    // Step 1: Collect all translation keys
    const { allKeys, languageData } = collectAllTranslationKeys();

    // Step 2: Create comprehensive English reference
    const { comprehensiveEnglish, missingInEnglish } =
      createComprehensiveEnglishReference(allKeys, languageData);

    // Step 3: Update English file if needed
    if (missingInEnglish.length > 0) {
      log('\n📝 Updating English reference file...', 'blue');
      writeTranslationFile('en', comprehensiveEnglish);
      languageData.en = comprehensiveEnglish;
    }

    // Step 4: Fill missing translations for other languages
    for (const language of SUPPORTED_LANGUAGES) {
      if (language === 'en') continue;

      const updatedTranslations = await fillMissingTranslations(
        language,
        allKeys,
        languageData,
        comprehensiveEnglish
      );

      writeTranslationFile(language, updatedTranslations);
      languageData[language] = updatedTranslations;
    }

    // Step 5: Final validation
    const isValid = validateTranslations(allKeys, languageData);

    log('\n🎉 Translation fixing completed!', 'green');
    log(`📊 Total keys: ${allKeys.length}`, 'cyan');
    log(`🌍 Languages: ${SUPPORTED_LANGUAGES.length}`, 'cyan');

    if (isValid) {
      log('✅ All translations are now complete and consistent!', 'green');
    } else {
      log(
        '⚠️  Some issues remain. Run the script again or check manually.',
        'yellow'
      );
    }
  } catch (error) {
    log(`\n❌ Error: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  }
}

// Handle command line arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
🌐 KiraPilot Automatic Translation Fixer

Usage: node scripts/auto-fix-translations.js [options]

Options:
  --help, -h     Show this help message
  --dry-run      Show what would be done without making changes
  
Environment Variables:
  GEMINI_API_KEY    Google Gemini API key for AI translation
                    (optional - will use placeholders if not set)

Examples:
  # Fix translations with AI
  GEMINI_API_KEY=your_key node scripts/auto-fix-translations.js
  
  # Fix translations with placeholders (no AI)
  node scripts/auto-fix-translations.js
  
  # See what would be changed
  node scripts/auto-fix-translations.js --dry-run
`);
  process.exit(0);
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { main as autoFixTranslations };

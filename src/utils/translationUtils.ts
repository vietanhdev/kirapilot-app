import { translations, languages, Language } from '../i18n';

/**
 * Validates translation coverage across all supported languages
 */
export const validateTranslationCoverage = (): {
  missingKeys: Record<Language, string[]>;
  extraKeys: Record<Language, string[]>;
  isComplete: boolean;
} => {
  const englishKeys = Object.keys(translations.en);
  const missingKeys: Record<Language, string[]> = {} as Record<
    Language,
    string[]
  >;
  const extraKeys: Record<Language, string[]> = {} as Record<
    Language,
    string[]
  >;

  Object.keys(languages).forEach(lang => {
    const language = lang as Language;
    if (language === 'en') {
      return;
    }

    const langKeys = Object.keys(translations[language]);

    // Find missing keys
    const missing = englishKeys.filter(key => !langKeys.includes(key));
    if (missing.length > 0) {
      missingKeys[language] = missing;
    }

    // Find extra keys (keys that exist in this language but not in English)
    const extra = langKeys.filter(key => !englishKeys.includes(key));
    if (extra.length > 0) {
      extraKeys[language] = extra;
    }
  });

  const isComplete =
    Object.keys(missingKeys).length === 0 &&
    Object.keys(extraKeys).length === 0;

  return {
    missingKeys,
    extraKeys,
    isComplete,
  };
};

/**
 * Logs translation coverage report to console (development only)
 */
export const logTranslationCoverage = (): void => {
  if (process.env.NODE_ENV !== 'development') {
    return;
  }

  const coverage = validateTranslationCoverage();

  if (coverage.isComplete) {
    console.log('✅ Translation coverage is complete for all languages');
    return;
  }

  console.group('🌐 Translation Coverage Report');

  if (Object.keys(coverage.missingKeys).length > 0) {
    console.group('❌ Missing translations:');
    Object.entries(coverage.missingKeys).forEach(([lang, keys]) => {
      console.log(`${lang}: ${keys.length} missing keys`, keys);
    });
    console.groupEnd();
  }

  if (Object.keys(coverage.extraKeys).length > 0) {
    console.group('⚠️ Extra translations (not in English):');
    Object.entries(coverage.extraKeys).forEach(([lang, keys]) => {
      console.log(`${lang}: ${keys.length} extra keys`, keys);
    });
    console.groupEnd();
  }

  console.groupEnd();
};

/**
 * Gets translation statistics for all languages
 */
export const getTranslationStats = (): Record<
  Language,
  { total: number; coverage: number }
> => {
  const englishKeyCount = Object.keys(translations.en).length;
  const stats: Record<Language, { total: number; coverage: number }> =
    {} as Record<Language, { total: number; coverage: number }>;

  Object.keys(languages).forEach(lang => {
    const language = lang as Language;
    const langKeyCount = Object.keys(translations[language]).length;
    const coverage =
      language === 'en'
        ? 100
        : Math.round((langKeyCount / englishKeyCount) * 100);

    stats[language] = {
      total: langKeyCount,
      coverage,
    };
  });

  return stats;
};

/**
 * Finds potentially hardcoded strings in a text (simple heuristic)
 */
export const findPotentialHardcodedStrings = (text: string): string[] => {
  // Simple regex to find quoted strings that look like UI text
  const stringRegex = /['"`]([A-Z][a-zA-Z\s]{2,}[a-z])['"]/g;
  const matches: string[] = [];
  let match;

  while ((match = stringRegex.exec(text)) !== null) {
    const str = match[1];
    // Filter out common non-UI strings
    if (!str.includes('http') && !str.includes('www') && !str.includes('@')) {
      matches.push(str);
    }
  }

  return [...new Set(matches)]; // Remove duplicates
};

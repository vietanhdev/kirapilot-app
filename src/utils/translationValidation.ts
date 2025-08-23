/**
 * Translation validation utilities for detecting hardcoded strings and validating translation coverage
 */

import { translations, type Language } from '../i18n';

export interface HardcodedStringMatch {
  file: string;
  line: number;
  column: number;
  content: string;
  context: string;
  severity: 'error' | 'warning' | 'info';
  suggestion?: string;
}

export interface TranslationCoverageReport {
  language: Language;
  totalKeys: number;
  missingKeys: string[];
  extraKeys: string[];
  coveragePercentage: number;
}

export interface TranslationValidationReport {
  hardcodedStrings: HardcodedStringMatch[];
  coverageReports: TranslationCoverageReport[];
  unusedKeys: string[];
  inconsistentKeys: string[];
  summary: {
    totalHardcodedStrings: number;
    totalMissingTranslations: number;
    totalUnusedKeys: number;
    overallHealth: 'excellent' | 'good' | 'needs-improvement' | 'critical';
  };
}

/**
 * Patterns to detect hardcoded strings in React/TypeScript code
 */
const HARDCODED_STRING_PATTERNS = [
  // String literals in component props (excluding known non-translatable props)
  {
    pattern:
      /(?:placeholder|title|aria-label|alt)\s*=\s*['"]((?:[^'"]|\\['"])+)['"]/g,
    severity: 'error' as const,
    description: 'User-facing string in component prop should use translation',
    exclude: [],
  },
  // JSX text content between tags (simple case)
  {
    pattern: />([^<>{]*[a-zA-Z][^<>{}]*)</g,
    severity: 'warning' as const,
    description: 'Potential hardcoded string in JSX text content',
    exclude: [/^\s*$/, /^[0-9\s]*$/, /^[{}\s]*$/, /^\s*[a-zA-Z0-9._-]+\s*$/],
  },
  // Alert, confirm, and console messages
  {
    pattern:
      /(?:alert|confirm|console\.(?:log|warn|error))\s*\(\s*['"]((?:[^'"]|\\['"])+)['"]/g,
    severity: 'warning' as const,
    description: 'User-facing message should use translation',
    exclude: [],
  },
  // Error messages and notifications
  {
    pattern:
      /(?:throw new Error|new Error)\s*\(\s*['"]((?:[^'"]|\\['"])+)['"]/g,
    severity: 'info' as const,
    description: 'Consider translating error messages for user-facing errors',
    exclude: [],
  },
];

/**
 * File extensions to scan for hardcoded strings
 */
export const SCANNABLE_EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js'];

/**
 * Directories to exclude from scanning
 */
export const EXCLUDED_DIRECTORIES = [
  'node_modules',
  'dist',
  'build',
  '.git',
  'coverage',
  '__tests__',
  '__mocks__',
  '.next',
  '.vscode',
  '.kiro',
];

/**
 * Files to exclude from scanning
 */
export const EXCLUDED_FILES = [
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'vite.config.ts',
  'tailwind.config.js',
  'jest.config.js',
  'eslint.config.js',
];

/**
 * Scans a file content for hardcoded strings
 */
export function scanFileForHardcodedStrings(
  filePath: string,
  content: string
): HardcodedStringMatch[] {
  const matches: HardcodedStringMatch[] = [];
  const lines = content.split('\n');

  // Skip translation files themselves
  if (
    filePath.includes('/i18n/locales/') ||
    filePath.includes('translationValidation')
  ) {
    return matches;
  }

  for (const patternConfig of HARDCODED_STRING_PATTERNS) {
    const regex = new RegExp(
      patternConfig.pattern.source,
      patternConfig.pattern.flags
    );
    let match;

    while ((match = regex.exec(content)) !== null) {
      let matchText = match[1] || match[0];

      // For JSX text content, clean up the match
      if (patternConfig.description.includes('JSX text content')) {
        matchText = matchText.trim();
        // Skip if it contains JSX expressions
        if (matchText.includes('{') || matchText.includes('}')) {
          continue;
        }
      }

      // Skip if matches exclusion patterns
      if (
        patternConfig.exclude?.some(excludePattern =>
          excludePattern.test(matchText)
        )
      ) {
        continue;
      }

      // Skip very short strings (likely not user-facing)
      if (matchText.length < 3) {
        continue;
      }

      // Skip strings that look like code identifiers
      if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(matchText)) {
        continue;
      }

      // Skip common non-translatable patterns
      if (isNonTranslatableString(matchText)) {
        continue;
      }

      // Find line and column
      const beforeMatch = content.substring(0, match.index);
      const lineNumber = beforeMatch.split('\n').length;
      const columnNumber = beforeMatch.split('\n').pop()?.length || 0;

      // Get context (surrounding lines)
      const contextStart = Math.max(0, lineNumber - 2);
      const contextEnd = Math.min(lines.length, lineNumber + 1);
      const context = lines.slice(contextStart, contextEnd).join('\n');

      matches.push({
        file: filePath,
        line: lineNumber,
        column: columnNumber,
        content: matchText,
        context,
        severity: patternConfig.severity,
        suggestion: generateTranslationKeySuggestion(matchText, filePath),
      });
    }
  }

  return matches;
}

/**
 * Checks if a string is likely non-translatable
 */
function isNonTranslatableString(text: string): boolean {
  // URLs
  if (/^https?:\/\//.test(text)) {
    return true;
  }

  // Email addresses
  if (/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(text)) {
    return true;
  }

  // Colors
  if (/^#[0-9a-fA-F]{3,8}$/.test(text)) {
    return true;
  }
  if (/^rgb\(|rgba\(|hsl\(|hsla\(/.test(text)) {
    return true;
  }

  // CSS units
  if (/^[0-9]+px|em|rem|%$/.test(text)) {
    return true;
  }

  // File extensions
  if (/^[a-zA-Z0-9._-]+\.(ts|tsx|js|jsx|css|scss|json)$/.test(text)) {
    return true;
  }

  // Constants (all caps with underscores)
  if (/^[A-Z_][A-Z0-9_]*$/.test(text)) {
    return true;
  }

  // Single words that are likely identifiers
  if (/^[a-z][a-zA-Z0-9]*$/.test(text) && text.length < 8) {
    return true;
  }

  // Numbers only
  if (/^[0-9]+$/.test(text)) {
    return true;
  }

  return false;
}

/**
 * Generates a suggested translation key for a hardcoded string
 */
function generateTranslationKeySuggestion(
  text: string,
  filePath: string
): string {
  // Extract component/feature name from file path
  const pathParts = filePath.split('/');
  const fileName = pathParts[pathParts.length - 1].replace(
    /\.(tsx?|jsx?)$/,
    ''
  );
  const featureName = pathParts.includes('components')
    ? pathParts[pathParts.indexOf('components') + 1] || 'common'
    : 'common';

  // Create a key from the text
  const textKey = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 3) // Take first 3 words
    .join('');

  return `${featureName}.${fileName}.${textKey}`;
}

/**
 * Validates translation coverage across all supported languages
 */
export function validateTranslationCoverage(): TranslationCoverageReport[] {
  const englishKeys = Object.keys(translations.en);
  const reports: TranslationCoverageReport[] = [];

  for (const [language, languageTranslations] of Object.entries(translations)) {
    if (language === 'en') {
      continue;
    } // Skip English as it's the reference

    const languageKeys = Object.keys(languageTranslations);
    const missingKeys = englishKeys.filter(key => !languageKeys.includes(key));
    const extraKeys = languageKeys.filter(key => !englishKeys.includes(key));
    const coveragePercentage = Math.round(
      ((englishKeys.length - missingKeys.length) / englishKeys.length) * 100
    );

    reports.push({
      language: language as Language,
      totalKeys: englishKeys.length,
      missingKeys,
      extraKeys,
      coveragePercentage,
    });
  }

  return reports;
}

/**
 * Finds unused translation keys by scanning the codebase
 */
export function findUnusedTranslationKeys(
  codebaseContent: Map<string, string>
): string[] {
  const allKeys = Object.keys(translations.en);
  const usedKeys = new Set<string>();

  // Patterns to find translation key usage
  const keyUsagePatterns = [
    /t\(['"`]([^'"`]+)['"`]\)/g,
    /getTranslation\([^,]+,\s*['"`]([^'"`]+)['"`]/g,
    /safeTranslation\([^,]+,\s*['"`]([^'"`]+)['"`]/g,
  ];

  for (const [filePath, content] of codebaseContent) {
    // Skip translation files themselves
    if (filePath.includes('/i18n/locales/')) {
      continue;
    }

    for (const pattern of keyUsagePatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        usedKeys.add(match[1]);
      }
    }
  }

  return allKeys.filter(key => !usedKeys.has(key));
}

/**
 * Finds inconsistent translation keys (keys that exist in some languages but not others)
 */
export function findInconsistentTranslationKeys(): string[] {
  const allLanguages = Object.keys(translations) as Language[];
  const inconsistentKeys = new Set<string>();

  // Get all unique keys across all languages
  const allKeys = new Set<string>();
  for (const lang of allLanguages) {
    Object.keys(translations[lang]).forEach(key => allKeys.add(key));
  }

  // Check each key for consistency
  for (const key of allKeys) {
    const languagesWithKey = allLanguages.filter(
      lang => key in translations[lang]
    );

    // If not all languages have this key, it's inconsistent
    if (languagesWithKey.length !== allLanguages.length) {
      inconsistentKeys.add(key);
    }
  }

  return Array.from(inconsistentKeys);
}

/**
 * Generates a comprehensive translation validation report
 */
export function generateTranslationValidationReport(
  hardcodedStrings: HardcodedStringMatch[],
  codebaseContent?: Map<string, string>
): TranslationValidationReport {
  const coverageReports = validateTranslationCoverage();
  const unusedKeys = codebaseContent
    ? findUnusedTranslationKeys(codebaseContent)
    : [];
  const inconsistentKeys = findInconsistentTranslationKeys();

  const totalMissingTranslations = coverageReports.reduce(
    (sum, report) => sum + report.missingKeys.length,
    0
  );

  // Determine overall health
  let overallHealth: TranslationValidationReport['summary']['overallHealth'];
  const criticalIssues = hardcodedStrings.filter(
    s => s.severity === 'error'
  ).length;
  const averageCoverage =
    coverageReports.reduce((sum, r) => sum + r.coveragePercentage, 0) /
    coverageReports.length;

  if (criticalIssues > 10 || averageCoverage < 70) {
    overallHealth = 'critical';
  } else if (
    criticalIssues > 5 ||
    averageCoverage < 85 ||
    totalMissingTranslations > 20
  ) {
    overallHealth = 'needs-improvement';
  } else if (
    criticalIssues > 0 ||
    averageCoverage < 95 ||
    totalMissingTranslations > 5
  ) {
    overallHealth = 'good';
  } else {
    overallHealth = 'excellent';
  }

  return {
    hardcodedStrings,
    coverageReports,
    unusedKeys,
    inconsistentKeys,
    summary: {
      totalHardcodedStrings: hardcodedStrings.length,
      totalMissingTranslations,
      totalUnusedKeys: unusedKeys.length,
      overallHealth,
    },
  };
}

/**
 * Development-time warning for missing translations
 */
export function logMissingTranslationWarning(
  key: string,
  language: Language
): void {
  if (process.env.NODE_ENV === 'development') {
    console.warn(
      `🌐 Translation missing: "${key}" for language "${language}". ` +
        `Add this key to src/i18n/locales/${language}.ts`
    );
  }
}

/**
 * Development-time warning for unused translation keys
 */
export function logUnusedTranslationWarning(unusedKeys: string[]): void {
  if (process.env.NODE_ENV === 'development' && unusedKeys.length > 0) {
    console.warn(
      `🌐 Found ${unusedKeys.length} unused translation keys:`,
      unusedKeys.slice(0, 10), // Show first 10
      unusedKeys.length > 10 ? `... and ${unusedKeys.length - 10} more` : ''
    );
  }
}

/**
 * Development-time warning for hardcoded strings
 */
export function logHardcodedStringWarning(
  matches: HardcodedStringMatch[]
): void {
  if (process.env.NODE_ENV === 'development' && matches.length > 0) {
    const criticalMatches = matches.filter(m => m.severity === 'error');
    if (criticalMatches.length > 0) {
      console.error(
        `🌐 Found ${criticalMatches.length} critical hardcoded strings that need translation:`,
        criticalMatches
          .slice(0, 5)
          .map(m => `${m.file}:${m.line} - "${m.content}"`)
      );
    }
  }
}

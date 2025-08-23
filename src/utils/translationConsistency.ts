/**
 * Translation key consistency validation utilities
 */

import { translations, type Language } from '../i18n';

export interface KeyConsistencyIssue {
  key: string;
  type: 'missing' | 'extra' | 'type-mismatch' | 'empty-value';
  language: Language;
  expectedValue?: string;
  actualValue?: string;
  severity: 'error' | 'warning';
}

export interface KeyStructureIssue {
  key: string;
  issue: 'invalid-format' | 'inconsistent-nesting' | 'naming-convention';
  description: string;
  suggestion?: string;
}

export interface ConsistencyValidationResult {
  keyIssues: KeyConsistencyIssue[];
  structureIssues: KeyStructureIssue[];
  summary: {
    totalIssues: number;
    criticalIssues: number;
    languageHealth: Record<Language, number>; // percentage score
  };
}

/**
 * Translation key naming convention rules
 */
const NAMING_CONVENTIONS = {
  // Keys should follow hierarchical dot notation
  hierarchical: /^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*)*$/,

  // Keys should not be too deeply nested (max 4 levels)
  maxDepth: 4,

  // Keys should use camelCase for each segment
  camelCase: /^[a-z][a-zA-Z0-9]*$/,

  // Reserved prefixes for specific domains
  reservedPrefixes: [
    'common',
    'nav',
    'settings',
    'tasks',
    'timer',
    'reports',
    'planning',
    'ai',
    'notifications',
    'database',
    'security',
  ],
};

/**
 * Validates consistency of translation keys across all languages
 */
export function validateKeyConsistency(): KeyConsistencyIssue[] {
  const issues: KeyConsistencyIssue[] = [];
  const englishKeys = Object.keys(translations.en);
  const englishTranslations = translations.en as Record<string, string>;

  // Check each non-English language against English
  for (const [language, languageTranslations] of Object.entries(translations)) {
    if (language === 'en') {
      continue;
    }

    const lang = language as Language;
    const langTranslations = languageTranslations as Record<string, string>;
    const languageKeys = Object.keys(langTranslations);

    // Find missing keys (exist in English but not in this language)
    for (const englishKey of englishKeys) {
      if (!(englishKey in langTranslations)) {
        issues.push({
          key: englishKey,
          type: 'missing',
          language: lang,
          expectedValue: englishTranslations[englishKey],
          severity: 'error',
        });
      } else {
        // Check for empty values
        const value = langTranslations[englishKey];
        if (!value || value.trim() === '') {
          issues.push({
            key: englishKey,
            type: 'empty-value',
            language: lang,
            expectedValue: englishTranslations[englishKey],
            actualValue: value,
            severity: 'error',
          });
        }
      }
    }

    // Find extra keys (exist in this language but not in English)
    for (const languageKey of languageKeys) {
      if (!(languageKey in englishTranslations)) {
        issues.push({
          key: languageKey,
          type: 'extra',
          language: lang,
          actualValue: langTranslations[languageKey],
          severity: 'warning',
        });
      }
    }
  }

  return issues;
}

/**
 * Validates translation key structure and naming conventions
 */
export function validateKeyStructure(): KeyStructureIssue[] {
  const issues: KeyStructureIssue[] = [];
  const allKeys = Object.keys(translations.en);

  for (const key of allKeys) {
    // Check hierarchical format
    if (!NAMING_CONVENTIONS.hierarchical.test(key)) {
      issues.push({
        key,
        issue: 'invalid-format',
        description:
          'Key should follow hierarchical dot notation with camelCase segments',
        suggestion: generateValidKeyName(key),
      });
      continue;
    }

    // Check nesting depth
    const depth = key.split('.').length;
    if (depth > NAMING_CONVENTIONS.maxDepth) {
      issues.push({
        key,
        issue: 'inconsistent-nesting',
        description: `Key is too deeply nested (${depth} levels, max ${NAMING_CONVENTIONS.maxDepth})`,
        suggestion: shortenKeyName(key),
      });
    }

    // Check each segment follows camelCase
    const segments = key.split('.');
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      if (!NAMING_CONVENTIONS.camelCase.test(segment)) {
        issues.push({
          key,
          issue: 'naming-convention',
          description: `Segment "${segment}" should be camelCase`,
          suggestion: segments
            .map((s, idx) => (idx === i ? toCamelCase(s) : s))
            .join('.'),
        });
        break;
      }
    }

    // Check for consistent prefixes within feature domains
    const prefix = segments[0];
    if (
      segments.length > 1 &&
      !NAMING_CONVENTIONS.reservedPrefixes.includes(prefix)
    ) {
      // Suggest using a reserved prefix if the key seems to belong to a known domain
      const suggestedPrefix = suggestPrefix(key);
      if (suggestedPrefix && suggestedPrefix !== prefix) {
        issues.push({
          key,
          issue: 'naming-convention',
          description: `Consider using standard prefix "${suggestedPrefix}" instead of "${prefix}"`,
          suggestion: key.replace(prefix, suggestedPrefix),
        });
      }
    }
  }

  return issues;
}

/**
 * Generates a comprehensive consistency validation result
 */
export function validateTranslationConsistency(): ConsistencyValidationResult {
  const keyIssues = validateKeyConsistency();
  const structureIssues = validateKeyStructure();

  // Calculate language health scores
  const languageHealth: Record<Language, number> = {} as Record<
    Language,
    number
  >;
  const totalKeys = Object.keys(translations.en).length;

  for (const language of Object.keys(translations) as Language[]) {
    if (language === 'en') {
      languageHealth[language] = 100; // English is the reference
      continue;
    }

    const languageIssues = keyIssues.filter(
      issue => issue.language === language
    );
    const criticalIssues = languageIssues.filter(
      issue => issue.severity === 'error'
    ).length;
    const warningIssues = languageIssues.filter(
      issue => issue.severity === 'warning'
    ).length;

    // Calculate health score (100 - penalty for issues)
    const criticalPenalty = (criticalIssues / totalKeys) * 80; // Critical issues have high penalty
    const warningPenalty = (warningIssues / totalKeys) * 20; // Warnings have lower penalty
    const healthScore = Math.max(0, 100 - criticalPenalty - warningPenalty);

    languageHealth[language] = Math.round(healthScore);
  }

  const totalIssues = keyIssues.length + structureIssues.length;
  const criticalIssues = keyIssues.filter(
    issue => issue.severity === 'error'
  ).length;

  return {
    keyIssues,
    structureIssues,
    summary: {
      totalIssues,
      criticalIssues,
      languageHealth,
    },
  };
}

/**
 * Generates a valid key name from an invalid one
 */
function generateValidKeyName(invalidKey: string): string {
  return invalidKey
    .toLowerCase()
    .replace(/[^a-z0-9.]/g, '')
    .split('.')
    .map(segment => toCamelCase(segment))
    .join('.');
}

/**
 * Shortens a deeply nested key name
 */
function shortenKeyName(key: string): string {
  const segments = key.split('.');
  if (segments.length <= NAMING_CONVENTIONS.maxDepth) {
    return key;
  }

  // Keep first segment (domain) and last segments (specific keys)
  const domain = segments[0];
  const specificKeys = segments.slice(-2);

  return [domain, ...specificKeys].join('.');
}

/**
 * Converts a string to camelCase
 */
function toCamelCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .split(' ')
    .map((word, index) =>
      index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join('');
}

/**
 * Suggests an appropriate prefix for a translation key
 */
function suggestPrefix(key: string): string | null {
  const keyLower = key.toLowerCase();

  // Map key patterns to suggested prefixes
  const prefixMappings = [
    { patterns: ['task', 'todo', 'item'], prefix: 'tasks' },
    { patterns: ['timer', 'time', 'session', 'duration'], prefix: 'timer' },
    { patterns: ['report', 'analytics', 'chart', 'graph'], prefix: 'reports' },
    { patterns: ['setting', 'config', 'preference'], prefix: 'settings' },
    { patterns: ['plan', 'schedule', 'calendar'], prefix: 'planning' },
    { patterns: ['ai', 'chat', 'assistant', 'kira'], prefix: 'ai' },
    { patterns: ['notification', 'alert', 'message'], prefix: 'notifications' },
    { patterns: ['nav', 'menu', 'tab'], prefix: 'nav' },
    { patterns: ['button', 'input', 'dialog', 'modal'], prefix: 'common' },
  ];

  for (const mapping of prefixMappings) {
    if (mapping.patterns.some(pattern => keyLower.includes(pattern))) {
      return mapping.prefix;
    }
  }

  return null;
}

/**
 * Validates that a translation key follows naming conventions
 */
export function isValidTranslationKey(key: string): boolean {
  // Check basic format
  if (!NAMING_CONVENTIONS.hierarchical.test(key)) {
    return false;
  }

  // Check depth
  if (key.split('.').length > NAMING_CONVENTIONS.maxDepth) {
    return false;
  }

  // Check each segment
  const segments = key.split('.');
  return segments.every(segment => NAMING_CONVENTIONS.camelCase.test(segment));
}

/**
 * Suggests improvements for a translation key
 */
export function suggestKeyImprovements(key: string): string[] {
  const suggestions: string[] = [];

  if (!isValidTranslationKey(key)) {
    suggestions.push(`Use valid format: ${generateValidKeyName(key)}`);
  }

  const depth = key.split('.').length;
  if (depth > NAMING_CONVENTIONS.maxDepth) {
    suggestions.push(`Reduce nesting: ${shortenKeyName(key)}`);
  }

  const prefix = key.split('.')[0];
  const suggestedPrefix = suggestPrefix(key);
  if (suggestedPrefix && suggestedPrefix !== prefix) {
    suggestions.push(
      `Consider prefix: ${key.replace(prefix, suggestedPrefix)}`
    );
  }

  return suggestions;
}

/**
 * Development-time validation that runs on translation key access
 */
export function validateKeyOnAccess(key: string, language: Language): void {
  if (process.env.NODE_ENV !== 'development') {
    return;
  }

  // Check if key exists in English (reference language)
  if (!(key in translations.en)) {
    console.error(
      `🌐 Translation key "${key}" does not exist in reference language (English)`
    );
    return;
  }

  // Check if key exists in requested language
  const languageTranslations = translations[language] as Record<string, string>;
  if (!(key in languageTranslations)) {
    console.warn(
      `🌐 Translation key "${key}" missing in language "${language}"`
    );
    return;
  }

  // Check if key follows naming conventions
  if (!isValidTranslationKey(key)) {
    const suggestions = suggestKeyImprovements(key);
    console.warn(
      `🌐 Translation key "${key}" doesn't follow naming conventions:`,
      suggestions
    );
  }
}

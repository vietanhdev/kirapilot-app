/**
 * Development tools for translation management
 * These tools are designed to be used during development to maintain translation quality
 */

import React from 'react';
import { validateCurrentTranslations } from './translationScanner';
import { validateTranslationConsistency } from './translationConsistency';
import type { Language } from '../i18n';
import {
  logMissingTranslationWarning,
  logUnusedTranslationWarning,
  logHardcodedStringWarning,
  scanFileForHardcodedStrings,
} from './translationValidation';

/**
 * Development tool to validate translations on app startup
 */
export function initializeTranslationDevTools(): void {
  if (process.env.NODE_ENV !== 'development') {
    return;
  }

  // Run quick validation
  validateCurrentTranslations();

  // Set up periodic validation (every 30 seconds in development)
  setInterval(() => {
    const consistencyResult = validateTranslationConsistency();
    const criticalIssues = consistencyResult.keyIssues.filter(
      i => i.severity === 'error'
    ).length;

    if (criticalIssues > 0) {
      console.warn(
        `🌐 Translation health check: ${criticalIssues} critical issues detected`
      );
    }
  }, 30000);

  // Add global helper functions for development
  if (typeof window !== 'undefined') {
    (window as unknown as Record<string, unknown>).__translationDevTools = {
      validate: validateCurrentTranslations,
      scanFile: (content: string, filename: string = 'unknown') => {
        const matches = scanFileForHardcodedStrings(filename, content);
        return matches;
      },
      checkConsistency: () => {
        const result = validateTranslationConsistency();
        return result;
      },
    };
  }
}

/**
 * React hook for translation development warnings
 */
export function useTranslationDevWarnings() {
  if (process.env.NODE_ENV !== 'development') {
    return {
      warnMissingKey: () => {},
      warnHardcodedString: () => {},
      warnUnusedKeys: () => {},
    };
  }

  return {
    warnMissingKey: (key: string, language: string) => {
      logMissingTranslationWarning(key, language as Language);
    },
    warnHardcodedString: (text: string, component: string) => {
      console.warn(`🌐 Hardcoded string detected in ${component}: "${text}"`);
    },
    warnUnusedKeys: (keys: string[]) => {
      logUnusedTranslationWarning(keys);
    },
  };
}

/**
 * Component wrapper that validates translation usage
 */
export function withTranslationValidation<T extends Record<string, unknown>>(
  Component: React.ComponentType<T>,
  _componentName: string
): React.ComponentType<T> {
  if (process.env.NODE_ENV !== 'development') {
    return Component;
  }

  return function ValidatedComponent(props: T) {
    // In development, we could add runtime validation here
    // For now, just render the component normally
    return React.createElement(Component, props);
  };
}

/**
 * Utility to check if a string looks like it should be translated
 */
export function shouldBeTranslated(text: string): boolean {
  // Skip if it's already a translation key
  if (text.includes('.') && text.split('.').length > 1) {
    return false;
  }

  // Skip very short strings
  if (text.length < 3) {
    return false;
  }

  // Skip strings that look like code
  if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(text)) {
    return false;
  }

  // Skip URLs, emails, etc.
  if (/^https?:\/\/|@|#[0-9a-fA-F]|rgb\(|px$|em$|rem$|%$/.test(text)) {
    return false;
  }

  // Skip numbers
  if (/^[0-9]+$/.test(text)) {
    return false;
  }

  // If it contains spaces or punctuation, it's likely user-facing text
  if (/[\s.,!?;:]/.test(text)) {
    return true;
  }

  // If it's longer than 10 characters, it's likely user-facing
  if (text.length > 10) {
    return true;
  }

  return false;
}

/**
 * Development middleware to catch and warn about hardcoded strings
 */
export function createTranslationMiddleware() {
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  // This could be used with bundler plugins to scan files during build
  return {
    name: 'translation-validator',
    transform(code: string, id: string) {
      if (id.includes('node_modules') || id.includes('.d.ts')) {
        return null;
      }

      const matches = scanFileForHardcodedStrings(id, code);
      if (matches.length > 0) {
        logHardcodedStringWarning(matches);
      }

      return null; // Don't transform the code
    },
  };
}

/**
 * CLI-style validation that can be run from package.json scripts
 */
export function runTranslationValidationCLI(): void {
  // Run consistency validation
  const consistencyResult = validateTranslationConsistency();
  console.log('====================');
  console.log(`Total Issues: ${consistencyResult.summary.totalIssues}`);
  console.log(`Critical Issues: ${consistencyResult.summary.criticalIssues}`);

  // Language health
  console.log('\n🏥 Language Health:');
  for (const [language, score] of Object.entries(
    consistencyResult.summary.languageHealth
  )) {
    const status = score >= 95 ? '✅' : score >= 80 ? '⚠️' : '❌';
    console.log(`  ${status} ${language}: ${score}%`);
  }

  // Critical issues
  const criticalIssues = consistencyResult.keyIssues.filter(
    i => i.severity === 'error'
  );
  if (criticalIssues.length > 0) {
    console.log(`\n🚨 Critical Issues (${criticalIssues.length}):`);
    criticalIssues.slice(0, 10).forEach(issue => {
      console.log(`  ${issue.language}: ${issue.type} - ${issue.key}`);
    });
  }

  // Structure issues
  if (consistencyResult.structureIssues.length > 0) {
    console.log(
      `\n🏗️  Structure Issues (${consistencyResult.structureIssues.length}):`
    );
    consistencyResult.structureIssues.slice(0, 5).forEach(issue => {
      console.log(`  ${issue.key}: ${issue.description}`);
      if (issue.suggestion) {
        console.log(`    💡 ${issue.suggestion}`);
      }
    });
  }

  console.log('\n====================\n');

  // Exit with error if critical issues found
  if (consistencyResult.summary.criticalIssues > 0) {
    console.error(
      '❌ Critical translation issues found. Please fix before proceeding.'
    );
    process.exit(1);
  } else {
    console.log('✅ No critical translation issues found.');
  }
}

/**
 * Generate a translation coverage badge/status
 */
export function getTranslationCoverageBadge(): string {
  const consistencyResult = validateTranslationConsistency();
  const averageHealth =
    Object.values(consistencyResult.summary.languageHealth).reduce(
      (sum, score) => sum + score,
      0
    ) / Object.keys(consistencyResult.summary.languageHealth).length;

  if (averageHealth >= 95) {
    return '🟢 Excellent';
  }
  if (averageHealth >= 85) {
    return '🟡 Good';
  }
  if (averageHealth >= 70) {
    return '🟠 Needs Improvement';
  }
  return '🔴 Critical';
}

/**
 * Export all dev tools for easy access
 */
export const translationDevTools = {
  initialize: initializeTranslationDevTools,
  validate: validateCurrentTranslations,
  checkConsistency: validateTranslationConsistency,
  shouldBeTranslated,
  getCoverageBadge: getTranslationCoverageBadge,
  runCLI: runTranslationValidationCLI,
};

// Auto-initialize in development
if (process.env.NODE_ENV === 'development') {
  // Small delay to ensure other modules are loaded
  setTimeout(initializeTranslationDevTools, 1000);
}

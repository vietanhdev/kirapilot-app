import { useEffect, useState, useCallback } from 'react';
import { translations, type Language } from '../i18n';
import {
  validateTranslationCoverage,
  findInconsistentTranslationKeys,
  type TranslationCoverageReport,
} from '../utils/translationValidation';
import {
  validateTranslationConsistency,
  type ConsistencyValidationResult,
} from '../utils/translationConsistency';

export interface TranslationValidationState {
  isValidating: boolean;
  coverageReports: TranslationCoverageReport[];
  inconsistentKeys: string[];
  consistencyResult: ConsistencyValidationResult | null;
  lastValidated: Date | null;
  error: string | null;
}

export interface TranslationValidationActions {
  validateTranslations: () => Promise<void>;
  getLanguageHealth: (language: Language) => number;
  getMissingKeysForLanguage: (language: Language) => string[];
  getExtraKeysForLanguage: (language: Language) => string[];
  exportValidationReport: () => string;
}

export interface UseTranslationValidationReturn
  extends TranslationValidationState,
    TranslationValidationActions {}

/**
 * Hook for validating translation coverage and consistency
 * Useful for development tools and translation management
 */
export const useTranslationValidation = (): UseTranslationValidationReturn => {
  const [state, setState] = useState<TranslationValidationState>({
    isValidating: false,
    coverageReports: [],
    inconsistentKeys: [],
    consistencyResult: null,
    lastValidated: null,
    error: null,
  });

  const validateTranslations = useCallback(async () => {
    setState(prev => ({ ...prev, isValidating: true, error: null }));

    try {
      // Run validation checks
      const coverageReports = validateTranslationCoverage();
      const inconsistentKeys = findInconsistentTranslationKeys();
      const consistencyResult = validateTranslationConsistency();

      setState(prev => ({
        ...prev,
        isValidating: false,
        coverageReports,
        inconsistentKeys,
        consistencyResult,
        lastValidated: new Date(),
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isValidating: false,
        error:
          error instanceof Error ? error.message : 'Unknown validation error',
      }));
    }
  }, []);

  const getLanguageHealth = useCallback(
    (language: Language): number => {
      if (!state.consistencyResult) {
        return 0;
      }
      return state.consistencyResult.summary.languageHealth[language] || 0;
    },
    [state.consistencyResult]
  );

  const getMissingKeysForLanguage = useCallback(
    (language: Language): string[] => {
      const report = state.coverageReports.find(r => r.language === language);
      return report?.missingKeys || [];
    },
    [state.coverageReports]
  );

  const getExtraKeysForLanguage = useCallback(
    (language: Language): string[] => {
      const report = state.coverageReports.find(r => r.language === language);
      return report?.extraKeys || [];
    },
    [state.coverageReports]
  );

  const exportValidationReport = useCallback((): string => {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalLanguages: Object.keys(translations).length,
        totalInconsistentKeys: state.inconsistentKeys.length,
        overallHealth: state.consistencyResult?.summary || null,
      },
      coverageReports: state.coverageReports,
      inconsistentKeys: state.inconsistentKeys,
      consistencyResult: state.consistencyResult,
    };

    return JSON.stringify(report, null, 2);
  }, [state]);

  // Auto-validate on mount in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      validateTranslations();
    }
  }, [validateTranslations]);

  return {
    ...state,
    validateTranslations,
    getLanguageHealth,
    getMissingKeysForLanguage,
    getExtraKeysForLanguage,
    exportValidationReport,
  };
};

/**
 * Hook for monitoring translation key usage in development
 * Tracks which keys are actually used in the application
 */
export const useTranslationUsageTracking = () => {
  const [usedKeys, setUsedKeys] = useState<Set<string>>(new Set());
  const [unusedKeys, setUnusedKeys] = useState<string[]>([]);

  const trackKeyUsage = useCallback((key: string) => {
    if (process.env.NODE_ENV === 'development') {
      setUsedKeys(prev => new Set([...prev, key]));
    }
  }, []);

  const analyzeUnusedKeys = useCallback(() => {
    const allKeys = Object.keys(translations.en);
    const unused = allKeys.filter(key => !usedKeys.has(key));
    setUnusedKeys(unused);
    return unused;
  }, [usedKeys]);

  const getUsageStats = useCallback(() => {
    const totalKeys = Object.keys(translations.en).length;
    const usedCount = usedKeys.size;
    const unusedCount = totalKeys - usedCount;
    const usagePercentage =
      totalKeys > 0 ? Math.round((usedCount / totalKeys) * 100) : 0;

    return {
      totalKeys,
      usedCount,
      unusedCount,
      usagePercentage,
      usedKeys: Array.from(usedKeys),
      unusedKeys,
    };
  }, [usedKeys, unusedKeys]);

  const exportUsageReport = useCallback(() => {
    const stats = getUsageStats();
    const report = {
      timestamp: new Date().toISOString(),
      stats,
      usedKeys: Array.from(usedKeys).sort(),
      unusedKeys: unusedKeys.sort(),
    };

    return JSON.stringify(report, null, 2);
  }, [usedKeys, unusedKeys, getUsageStats]);

  return {
    usedKeys: Array.from(usedKeys),
    unusedKeys,
    trackKeyUsage,
    analyzeUnusedKeys,
    getUsageStats,
    exportUsageReport,
  };
};

/**
 * Development-only hook for real-time translation validation
 * Shows warnings and errors in the console for missing or problematic translations
 */
export const useDevTranslationMonitor = (
  enabled: boolean = process.env.NODE_ENV === 'development'
) => {
  const [issues, setIssues] = useState<
    Array<{
      type: 'missing' | 'inconsistent' | 'unused';
      key: string;
      language?: Language;
      message: string;
      timestamp: Date;
    }>
  >([]);

  const reportIssue = useCallback(
    (
      type: 'missing' | 'inconsistent' | 'unused',
      key: string,
      message: string,
      language?: Language
    ) => {
      if (!enabled) {
        return;
      }

      const issue = {
        type,
        key,
        language,
        message,
        timestamp: new Date(),
      };

      setIssues(prev => [...prev.slice(-99), issue]); // Keep last 100 issues

      // Log to console with appropriate level
      const logMessage = `🌐 Translation ${type}: ${key}${language ? ` (${language})` : ''} - ${message}`;

      switch (type) {
        case 'missing':
          console.warn(logMessage);
          break;
        case 'inconsistent':
          console.warn(logMessage);
          break;
        case 'unused':
          console.info(logMessage);
          break;
      }
    },
    [enabled]
  );

  const clearIssues = useCallback(() => {
    setIssues([]);
  }, []);

  const getIssuesSummary = useCallback(() => {
    const summary = issues.reduce(
      (acc, issue) => {
        acc[issue.type] = (acc[issue.type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return {
      total: issues.length,
      missing: summary.missing || 0,
      inconsistent: summary.inconsistent || 0,
      unused: summary.unused || 0,
      recent: issues.slice(-10), // Last 10 issues
    };
  }, [issues]);

  return {
    issues,
    reportIssue,
    clearIssues,
    getIssuesSummary,
    isEnabled: enabled,
  };
};

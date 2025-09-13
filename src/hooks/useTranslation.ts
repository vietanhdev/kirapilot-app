import { useEffect } from 'react';
import { useUserPreferences } from './useUserPreferences';
import {
  getTranslation,
  getTranslationPlural,
  safeTranslation,
  TranslationKey,
  Language,
  isValidLanguage,
  translations,
} from '../i18n';
import { initializeServiceLocalization } from '../services/ServiceLocalization';
import { useDevTranslationMonitor } from './useTranslationValidation';

export const useTranslation = () => {
  const { language } = useUserPreferences();
  const { reportIssue } = useDevTranslationMonitor();

  // Ensure the language is valid, fallback to English if not
  const validLanguage: Language = isValidLanguage(language) ? language : 'en';

  const t = (
    key: TranslationKey,
    variables?: Record<string, string | number>
  ): string => {
    // Track key usage and validate in development
    if (process.env.NODE_ENV === 'development') {
      try {
        const translation = getTranslation(validLanguage, key, variables);

        // Report if falling back to English
        if (validLanguage !== 'en') {
          const languageTranslations = translations[validLanguage] as Record<
            string,
            string
          >;

          if (!languageTranslations[key]) {
            reportIssue(
              'missing',
              key,
              `Missing translation for language "${validLanguage}", falling back to English`,
              validLanguage
            );
          }
        }

        return translation;
      } catch {
        reportIssue(
          'missing',
          key,
          `Translation key "${key}" not found in any language`,
          validLanguage
        );
        return key; // Return key as fallback
      }
    }

    return getTranslation(validLanguage, key, variables);
  };

  // Initialize service localization when language changes
  useEffect(() => {
    initializeServiceLocalization(
      (key: TranslationKey, variables?: Record<string, string | number>) => {
        return getTranslation(validLanguage, key, variables);
      }
    );
  }, [validLanguage]);

  const tPlural = (
    key: TranslationKey,
    count: number,
    variables?: Record<string, string | number>
  ): string => {
    return getTranslationPlural(validLanguage, key, count, variables);
  };

  const tSafe = (
    key: TranslationKey,
    fallback?: string,
    variables?: Record<string, string | number>
  ): string => {
    return safeTranslation(validLanguage, key, fallback, variables);
  };

  return {
    t,
    tPlural,
    tSafe,
    language: validLanguage,
  };
};

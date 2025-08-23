import { useEffect } from 'react';
import { useUserPreferences } from './useUserPreferences';
import {
  getTranslation,
  getTranslationPlural,
  safeTranslation,
  TranslationKey,
  Language,
  isValidLanguage,
} from '../i18n';
import { initializeServiceLocalization } from '../services/ServiceLocalization';

export const useTranslation = () => {
  const { language } = useUserPreferences();

  // Ensure the language is valid, fallback to English if not
  const validLanguage: Language = isValidLanguage(language) ? language : 'en';

  const t = (
    key: TranslationKey,
    variables?: Record<string, string | number>
  ): string => {
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

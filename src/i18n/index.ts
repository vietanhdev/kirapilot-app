import { en } from './locales/en';
import { es } from './locales/es';
import { fr } from './locales/fr';
import { de } from './locales/de';
import { vi } from './locales/vi';
import { ja } from './locales/ja';
import { pt } from './locales/pt';
import { logMissingTranslationWarning } from '../utils/translationValidation';
import { validateKeyOnAccess } from '../utils/translationConsistency';

export type Language = 'en' | 'es' | 'fr' | 'de' | 'vi' | 'ja' | 'pt';

export const languages: Record<Language, string> = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  vi: 'Tiếng Việt',
  ja: '日本語',
  pt: 'Português',
};

export const translations = {
  en,
  es,
  fr,
  de,
  vi,
  ja,
  pt,
};

export type TranslationKey = keyof typeof en;

export const getTranslation = (
  language: Language,
  key: TranslationKey,
  variables?: Record<string, string | number>
): string => {
  // Development-time validation
  if (process.env.NODE_ENV === 'development') {
    validateKeyOnAccess(key, language);
  }

  // Use type assertion to handle the new keys that might not be in all language files yet
  const languageTranslations = translations[language] as Record<string, string>;
  const translation = languageTranslations?.[key];

  // Log missing translations in development with enhanced warnings
  if (!translation) {
    logMissingTranslationWarning(key, language);

    // Fallback to English
    const englishTranslations = translations.en as Record<string, string>;
    const fallback = englishTranslations[key];
    if (!fallback) {
      if (process.env.NODE_ENV === 'development') {
        console.error(
          `🌐 CRITICAL: Translation key "${key}" missing in ALL languages including English!`
        );
      }
      return key; // Return key as last resort
    }

    let result = fallback;

    // Handle variable substitution
    if (variables) {
      Object.entries(variables).forEach(([varKey, value]) => {
        result = result.replace(new RegExp(`{${varKey}}`, 'g'), String(value));
      });
    }

    return result;
  }

  let result = translation;

  // Handle variable substitution
  if (variables) {
    Object.entries(variables).forEach(([varKey, value]) => {
      result = result.replace(new RegExp(`{${varKey}}`, 'g'), String(value));
    });
  }

  return result;
};

export const getTranslationPlural = (
  language: Language,
  key: TranslationKey,
  count: number,
  variables?: Record<string, string | number>
): string => {
  const pluralKey = count === 1 ? `${key}.singular` : `${key}.plural`;
  return getTranslation(language, pluralKey as TranslationKey, {
    ...variables,
    count,
  });
};

export const safeTranslation = (
  language: Language,
  key: TranslationKey,
  fallback?: string,
  variables?: Record<string, string | number>
): string => {
  try {
    return getTranslation(language, key, variables);
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error(`Translation error for key ${key}:`, error);
    }
    return fallback || key;
  }
};

export const isValidLanguage = (lang: string): lang is Language => {
  return Object.keys(languages).includes(lang);
};

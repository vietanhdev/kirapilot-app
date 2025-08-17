import { en } from './locales/en';
import { es } from './locales/es';
import { fr } from './locales/fr';
import { de } from './locales/de';

export type Language = 'en' | 'es' | 'fr' | 'de';

export const languages: Record<Language, string> = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
};

export const translations = {
  en,
  es,
  fr,
  de,
};

export type TranslationKey = keyof typeof en;

export const getTranslation = (
  language: Language,
  key: TranslationKey
): string => {
  return translations[language][key] || translations.en[key] || key;
};

export const isValidLanguage = (lang: string): lang is Language => {
  return Object.keys(languages).includes(lang);
};

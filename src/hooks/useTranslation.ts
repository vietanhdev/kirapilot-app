import { useUserPreferences } from './useUserPreferences';
import {
  getTranslation,
  TranslationKey,
  Language,
  isValidLanguage,
} from '../i18n';

export const useTranslation = () => {
  const { language } = useUserPreferences();

  // Ensure the language is valid, fallback to English if not
  const validLanguage: Language = isValidLanguage(language) ? language : 'en';

  const t = (key: TranslationKey): string => {
    return getTranslation(validLanguage, key);
  };

  return {
    t,
    language: validLanguage,
  };
};

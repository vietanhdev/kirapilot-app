// Service localization setup
import { TranslationKey } from '../i18n';
import { setDatabaseTranslationFunction } from './database';
import { setSecurityTranslationFunction } from './security/DataSecurity';
import { timerNotifications } from './notifications/TimerNotifications';

// Translation function type
export type ServiceTranslationFunction = (
  key: TranslationKey,
  variables?: Record<string, string | number>
) => string;

/**
 * Initialize all service translation functions
 */
export function initializeServiceLocalization(
  translationFunction: ServiceTranslationFunction
): void {
  // Set up database service translations
  setDatabaseTranslationFunction(translationFunction);

  // Set up security service translations
  setSecurityTranslationFunction(translationFunction);

  // Set up notification service translations
  timerNotifications.setTranslationFunction(translationFunction);
}

/**
 * Update all service translation functions (for language changes)
 */
export function updateServiceLocalization(
  translationFunction: ServiceTranslationFunction
): void {
  initializeServiceLocalization(translationFunction);
}

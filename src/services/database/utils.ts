import { TranslationKey } from '../../i18n';

// Translation function type for database services
export type DatabaseTranslationFunction = (
  key: TranslationKey,
  variables?: Record<string, string | number>
) => string;

// Global translation function for database services
let databaseTranslationFunction: DatabaseTranslationFunction = (
  key: TranslationKey
) => key;

/**
 * Set translation function for database services
 */
export function setDatabaseTranslationFunction(
  translationFunction: DatabaseTranslationFunction
): void {
  databaseTranslationFunction = translationFunction;
}

/**
 * Get localized database error message
 */
export function getDatabaseErrorMessage(
  key: TranslationKey,
  variables?: Record<string, string | number>
): string {
  return databaseTranslationFunction(key, variables);
}

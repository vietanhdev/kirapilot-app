/**
 * Version utility to access package version dynamically
 */

// Import package.json to get the version
import packageJson from '../../package.json';

/**
 * Get the current application version from package.json
 * @returns The version string (e.g., "0.0.10")
 */
export const getAppVersion = (): string => {
  return packageJson.version;
};

/**
 * Get the formatted version string for display
 * @returns Formatted version string (e.g., "Version 0.0.10")
 */
export const getFormattedVersion = (): string => {
  return `Version ${packageJson.version}`;
};

/**
 * Export the raw version for direct access
 */
export const APP_VERSION = packageJson.version;

/**
 * Get version string for translations
 * This function can be called from translation files to get dynamic version
 */
export const getVersionForTranslations = (): string => {
  return `Version ${packageJson.version}`;
};

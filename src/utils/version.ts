/**
 * Version utility to access build information dynamically
 */

// Import build info generated at build time
import buildInfo from '../build-info.json';

export interface BuildInfo {
  version: string;
  buildDate: string;
  buildTimestamp: number;
  git: {
    hash: string;
    shortHash: string;
    branch: string;
    tag: string | null;
    isDirty: boolean;
  };
  environment: string;
  nodeVersion: string;
  platform: string;
  arch: string;
}

/**
 * Get the complete build information
 * @returns Build information object
 */
export const getBuildInfo = (): BuildInfo => {
  return buildInfo as BuildInfo;
};

/**
 * Get the current application version
 * @returns The version string (e.g., "0.0.21")
 */
export const getAppVersion = (): string => {
  return buildInfo.version;
};

/**
 * Get the formatted version string for display
 * @returns Formatted version string (e.g., "Version 0.0.21")
 */
export const getFormattedVersion = (): string => {
  return `Version ${buildInfo.version}`;
};

/**
 * Get detailed version info with build metadata
 * @returns Detailed version string with git info
 */
export const getDetailedVersion = (): string => {
  const { version, git } = buildInfo;
  let versionStr = `Version ${version}`;

  if (git.tag && git.tag !== `v${version}`) {
    versionStr += ` (${git.tag})`;
  }

  versionStr += ` - ${git.shortHash}`;

  if (git.isDirty) {
    versionStr += ' (modified)';
  }

  return versionStr;
};

/**
 * Get build date as formatted string
 * @returns Formatted build date
 */
export const getBuildDate = (): string => {
  return new Date(buildInfo.buildDate).toLocaleString();
};

/**
 * Export the raw version for direct access
 */
export const APP_VERSION = buildInfo.version;

/**
 * Get version string for translations
 * This function can be called from translation files to get dynamic version
 */
export const getVersionForTranslations = (): string => {
  return `Version ${buildInfo.version}`;
};

/**
 * Translation scanner utility for development use
 * This can be run as a standalone script or integrated into the build process
 */

import {
  scanFileForHardcodedStrings,
  generateTranslationValidationReport,
  type HardcodedStringMatch,
  type TranslationValidationReport,
} from './translationValidation';
import { validateTranslationConsistency } from './translationConsistency';

/**
 * Mock file system interface for scanning
 * In a real implementation, this would read from the actual file system
 */
interface FileSystemInterface {
  readFile(path: string): Promise<string>;
  listFiles(directory: string, extensions: string[]): Promise<string[]>;
}

/**
 * Scans the entire codebase for translation issues
 */
export class TranslationScanner {
  private fs: FileSystemInterface;
  private excludedPaths: string[];
  private includedExtensions: string[];

  constructor(
    fs: FileSystemInterface,
    options: {
      excludedPaths?: string[];
      includedExtensions?: string[];
    } = {}
  ) {
    this.fs = fs;
    this.excludedPaths = options.excludedPaths || [
      'node_modules',
      'dist',
      'build',
      '.git',
      'coverage',
      '.next',
      '.vscode',
      '.kiro',
    ];
    this.includedExtensions = options.includedExtensions || [
      '.tsx',
      '.ts',
      '.jsx',
      '.js',
    ];
  }

  /**
   * Scans all files in the codebase for hardcoded strings
   */
  async scanForHardcodedStrings(): Promise<HardcodedStringMatch[]> {
    const allMatches: HardcodedStringMatch[] = [];

    try {
      const files = await this.fs.listFiles('src', this.includedExtensions);

      for (const filePath of files) {
        // Skip excluded paths
        if (this.excludedPaths.some(excluded => filePath.includes(excluded))) {
          continue;
        }

        try {
          const content = await this.fs.readFile(filePath);
          const matches = scanFileForHardcodedStrings(filePath, content);
          allMatches.push(...matches);
        } catch (error) {
          console.warn(`Failed to scan file ${filePath}:`, error);
        }
      }
    } catch (error) {
      console.error('Failed to scan codebase:', error);
    }

    return allMatches;
  }

  /**
   * Generates a comprehensive translation report
   */
  async generateReport(): Promise<TranslationValidationReport> {
    console.log('🌐 Scanning codebase for translation issues...');

    const hardcodedStrings = await this.scanForHardcodedStrings();

    // Build codebase content map for unused key detection
    const codebaseContent = new Map<string, string>();
    try {
      const files = await this.fs.listFiles('src', this.includedExtensions);
      for (const filePath of files) {
        if (!this.excludedPaths.some(excluded => filePath.includes(excluded))) {
          try {
            const content = await this.fs.readFile(filePath);
            codebaseContent.set(filePath, content);
          } catch (error) {
            console.warn(`Failed to read file ${filePath}:`, error);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to build codebase content map:', error);
    }

    const report = generateTranslationValidationReport(
      hardcodedStrings,
      codebaseContent
    );

    console.log('🌐 Translation scan complete!');
    return report;
  }

  /**
   * Prints a formatted report to the console
   */
  printReport(report: TranslationValidationReport): void {
    console.log('\n📊 TRANSLATION VALIDATION REPORT');
    console.log('================================');

    // Summary
    console.log(`\n📈 Summary:`);
    console.log(
      `  Overall Health: ${this.getHealthEmoji(report.summary.overallHealth)} ${report.summary.overallHealth.toUpperCase()}`
    );
    console.log(`  Hardcoded Strings: ${report.summary.totalHardcodedStrings}`);
    console.log(
      `  Missing Translations: ${report.summary.totalMissingTranslations}`
    );
    console.log(`  Unused Keys: ${report.summary.totalUnusedKeys}`);

    // Language Coverage
    console.log(`\n🌍 Language Coverage:`);
    for (const coverageReport of report.coverageReports) {
      const emoji =
        coverageReport.coveragePercentage >= 95
          ? '✅'
          : coverageReport.coveragePercentage >= 80
            ? '⚠️'
            : '❌';
      console.log(
        `  ${emoji} ${coverageReport.language}: ${coverageReport.coveragePercentage}% (${coverageReport.missingKeys.length} missing)`
      );
    }

    // Critical Issues
    const criticalHardcoded = report.hardcodedStrings.filter(
      s => s.severity === 'error'
    );
    if (criticalHardcoded.length > 0) {
      console.log(
        `\n🚨 Critical Hardcoded Strings (${criticalHardcoded.length}):`
      );
      criticalHardcoded.slice(0, 10).forEach(match => {
        console.log(`  ${match.file}:${match.line} - "${match.content}"`);
        if (match.suggestion) {
          console.log(`    💡 Suggestion: ${match.suggestion}`);
        }
      });
      if (criticalHardcoded.length > 10) {
        console.log(`  ... and ${criticalHardcoded.length - 10} more`);
      }
    }

    // Missing Translations (top issues)
    const topMissingKeys = report.coverageReports
      .flatMap(r => r.missingKeys.map(key => ({ key, language: r.language })))
      .slice(0, 10);

    if (topMissingKeys.length > 0) {
      console.log(`\n🔍 Top Missing Translation Keys:`);
      topMissingKeys.forEach(({ key, language }) => {
        console.log(`  ${language}: ${key}`);
      });
    }

    // Unused Keys
    if (report.unusedKeys.length > 0) {
      console.log(
        `\n🗑️  Unused Translation Keys (${report.unusedKeys.length}):`
      );
      report.unusedKeys.slice(0, 10).forEach(key => {
        console.log(`  ${key}`);
      });
      if (report.unusedKeys.length > 10) {
        console.log(`  ... and ${report.unusedKeys.length - 10} more`);
      }
    }

    // Inconsistent Keys
    if (report.inconsistentKeys.length > 0) {
      console.log(
        `\n⚠️  Inconsistent Keys (${report.inconsistentKeys.length}):`
      );
      report.inconsistentKeys.slice(0, 10).forEach(key => {
        console.log(`  ${key}`);
      });
    }

    console.log('\n================================\n');
  }

  /**
   * Prints a detailed consistency report
   */
  printConsistencyReport(): void {
    const consistencyResult = validateTranslationConsistency();

    console.log('\n🔍 TRANSLATION CONSISTENCY REPORT');
    console.log('=================================');

    // Language Health Scores
    console.log(`\n🏥 Language Health Scores:`);
    for (const [language, score] of Object.entries(
      consistencyResult.summary.languageHealth
    )) {
      const emoji = score >= 95 ? '💚' : score >= 80 ? '💛' : '❤️';
      console.log(`  ${emoji} ${language}: ${score}%`);
    }

    // Key Issues by Language
    const issuesByLanguage = consistencyResult.keyIssues.reduce(
      (acc, issue) => {
        if (!acc[issue.language]) {
          acc[issue.language] = [];
        }
        acc[issue.language].push(issue);
        return acc;
      },
      {} as Record<string, typeof consistencyResult.keyIssues>
    );

    for (const [language, issues] of Object.entries(issuesByLanguage)) {
      const criticalIssues = issues.filter(i => i.severity === 'error');
      if (criticalIssues.length > 0) {
        console.log(
          `\n🚨 Critical Issues in ${language} (${criticalIssues.length}):`
        );
        criticalIssues.slice(0, 5).forEach(issue => {
          console.log(`  ${issue.type}: ${issue.key}`);
        });
      }
    }

    // Structure Issues
    if (consistencyResult.structureIssues.length > 0) {
      console.log(
        `\n🏗️  Key Structure Issues (${consistencyResult.structureIssues.length}):`
      );
      consistencyResult.structureIssues.slice(0, 10).forEach(issue => {
        console.log(`  ${issue.key}: ${issue.description}`);
        if (issue.suggestion) {
          console.log(`    💡 Suggestion: ${issue.suggestion}`);
        }
      });
    }

    console.log('\n=================================\n');
  }

  private getHealthEmoji(health: string): string {
    switch (health) {
      case 'excellent':
        return '💚';
      case 'good':
        return '💛';
      case 'needs-improvement':
        return '🧡';
      case 'critical':
        return '❤️';
      default:
        return '❓';
    }
  }
}

/**
 * Development utility function to run a quick scan
 */
export async function runTranslationScan(
  fs: FileSystemInterface
): Promise<void> {
  const scanner = new TranslationScanner(fs);

  try {
    const report = await scanner.generateReport();
    scanner.printReport(report);
    scanner.printConsistencyReport();

    // Exit with error code if there are critical issues
    if (report.summary.overallHealth === 'critical') {
      console.error(
        '🚨 Critical translation issues found! Please fix before proceeding.'
      );
      process.exit(1);
    }
  } catch (error) {
    console.error('Failed to run translation scan:', error);
    process.exit(1);
  }
}

/**
 * Browser-compatible version for development tools
 */
export function createBrowserScanner(): TranslationScanner {
  // Mock file system for browser environment
  const mockFs: FileSystemInterface = {
    async readFile(_path: string): Promise<string> {
      throw new Error('File system access not available in browser');
    },
    async listFiles(
      _directory: string,
      _extensions: string[]
    ): Promise<string[]> {
      throw new Error('File system access not available in browser');
    },
  };

  return new TranslationScanner(mockFs);
}

/**
 * Quick validation function for development use
 */
export function validateCurrentTranslations(): void {
  console.log('🌐 Running quick translation validation...');

  const consistencyResult = validateTranslationConsistency();
  const criticalIssues = consistencyResult.keyIssues.filter(
    i => i.severity === 'error'
  ).length;

  if (criticalIssues > 0) {
    console.warn(`⚠️  Found ${criticalIssues} critical translation issues`);
  } else {
    console.log('✅ No critical translation issues found');
  }

  // Log summary
  console.log(
    `📊 Summary: ${consistencyResult.summary.totalIssues} total issues, ${criticalIssues} critical`
  );
}

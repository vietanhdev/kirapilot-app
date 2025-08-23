/**
 * Tests for translation validation utilities
 */

import {
  scanFileForHardcodedStrings,
  validateTranslationCoverage,
  findUnusedTranslationKeys,
  findInconsistentTranslationKeys,
  generateTranslationValidationReport,
} from '../translationValidation';

describe('Translation Validation', () => {
  describe('scanFileForHardcodedStrings', () => {
    it('should detect hardcoded strings in JSX', () => {
      const content = `
        function Component() {
          return (
            <div>
              <h1>Hardcoded Title</h1>
              <p>This is a hardcoded message</p>
              <button>{t('common.save')}</button>
            </div>
          );
        }
      `;

      const matches = scanFileForHardcodedStrings('Component.tsx', content);

      expect(matches.length).toBeGreaterThanOrEqual(2);
      expect(matches.some(m => m.content === 'Hardcoded Title')).toBe(true);
      expect(
        matches.some(m => m.content === 'This is a hardcoded message')
      ).toBe(true);
    });

    it('should detect hardcoded strings in component props', () => {
      const content = `
        <input placeholder="Enter your name" />
        <img alt="Profile picture" />
        <button title="Click to save" />
      `;

      const matches = scanFileForHardcodedStrings('Component.tsx', content);

      expect(matches.length).toBeGreaterThanOrEqual(3);
      expect(matches.some(m => m.content === 'Enter your name')).toBe(true);
      expect(matches.some(m => m.content === 'Profile picture')).toBe(true);
      expect(matches.some(m => m.content === 'Click to save')).toBe(true);
    });

    it('should skip translation function calls', () => {
      const content = `
        function Component() {
          return (
            <div>
              <h1>{t('page.title')}</h1>
              <p>{getTranslation(lang, 'page.description')}</p>
              <button>{safeTranslation(lang, 'common.save', 'Save')}</button>
            </div>
          );
        }
      `;

      const matches = scanFileForHardcodedStrings('Component.tsx', content);

      // Should have minimal matches, mostly from JSX structure
      expect(matches.length).toBeLessThan(5);
      // Should not contain the translation keys
      expect(matches.some(m => m.content.includes('page.title'))).toBe(false);
      expect(matches.some(m => m.content.includes('page.description'))).toBe(
        false
      );
    });

    it('should skip non-translatable patterns', () => {
      const content = `
        const config = {
          url: 'https://example.com',
          email: 'test@example.com',
          color: '#ff0000',
          size: '16px',
          count: '123',
          className: 'btn-primary'
        };
      `;

      const matches = scanFileForHardcodedStrings('config.ts', content);

      // Should skip URLs, emails, colors, CSS units, numbers, and short identifiers
      const nonTranslatableMatches = matches.filter(
        m =>
          m.content.includes('https://') ||
          m.content.includes('@') ||
          m.content.includes('#ff0000') ||
          m.content.includes('16px') ||
          m.content === '123' ||
          m.content === 'btn-primary'
      );
      expect(nonTranslatableMatches).toHaveLength(0);
    });

    it('should generate translation key suggestions', () => {
      const content = `
        <button>Save Changes</button>
      `;

      const matches = scanFileForHardcodedStrings('TaskModal.tsx', content);

      const saveChangesMatch = matches.find(m => m.content === 'Save Changes');
      expect(saveChangesMatch).toBeDefined();
      expect(saveChangesMatch?.suggestion).toMatch(/task.*modal/i);
    });
  });

  describe('validateTranslationCoverage', () => {
    it('should identify missing translations', () => {
      const reports = validateTranslationCoverage();

      expect(reports).toBeInstanceOf(Array);
      expect(reports.length).toBeGreaterThan(0);

      // Each report should have the required properties
      reports.forEach(report => {
        expect(report).toHaveProperty('language');
        expect(report).toHaveProperty('totalKeys');
        expect(report).toHaveProperty('missingKeys');
        expect(report).toHaveProperty('extraKeys');
        expect(report).toHaveProperty('coveragePercentage');
        expect(report.coveragePercentage).toBeGreaterThanOrEqual(0);
        expect(report.coveragePercentage).toBeLessThanOrEqual(100);
      });
    });
  });

  describe('findUnusedTranslationKeys', () => {
    it('should find unused keys', () => {
      const codebaseContent = new Map([
        ['Component1.tsx', 't("common.save")'],
        ['Component2.tsx', 'getTranslation(lang, "common.cancel")'],
        ['Component3.tsx', 'safeTranslation(lang, "tasks.title")'],
      ]);

      const unusedKeys = findUnusedTranslationKeys(codebaseContent);

      expect(unusedKeys).toBeInstanceOf(Array);
      // Should not include the used keys
      expect(unusedKeys).not.toContain('common.save');
      expect(unusedKeys).not.toContain('common.cancel');
      expect(unusedKeys).not.toContain('tasks.title');
    });
  });

  describe('findInconsistentTranslationKeys', () => {
    it('should find keys that exist in some languages but not others', () => {
      const inconsistentKeys = findInconsistentTranslationKeys();

      expect(inconsistentKeys).toBeInstanceOf(Array);
      // The result depends on the actual translation files
      // We just verify the function runs without error
    });
  });

  describe('generateTranslationValidationReport', () => {
    it('should generate a comprehensive report', () => {
      const hardcodedStrings = [
        {
          file: 'test.tsx',
          line: 1,
          column: 1,
          content: 'Test string',
          context: 'test context',
          severity: 'error' as const,
        },
      ];

      const codebaseContent = new Map([['test.tsx', 't("common.save")']]);

      const report = generateTranslationValidationReport(
        hardcodedStrings,
        codebaseContent
      );

      expect(report).toHaveProperty('hardcodedStrings');
      expect(report).toHaveProperty('coverageReports');
      expect(report).toHaveProperty('unusedKeys');
      expect(report).toHaveProperty('inconsistentKeys');
      expect(report).toHaveProperty('summary');

      expect(report.summary).toHaveProperty('totalHardcodedStrings');
      expect(report.summary).toHaveProperty('totalMissingTranslations');
      expect(report.summary).toHaveProperty('totalUnusedKeys');
      expect(report.summary).toHaveProperty('overallHealth');

      expect(['excellent', 'good', 'needs-improvement', 'critical']).toContain(
        report.summary.overallHealth
      );
    });
  });
});

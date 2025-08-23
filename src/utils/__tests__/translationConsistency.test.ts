/**
 * Tests for translation consistency validation utilities
 */

import {
  validateKeyConsistency,
  validateKeyStructure,
  validateTranslationConsistency,
  isValidTranslationKey,
  suggestKeyImprovements,
} from '../translationConsistency';

describe('Translation Consistency', () => {
  describe('validateKeyConsistency', () => {
    it('should identify missing and extra keys', () => {
      const issues = validateKeyConsistency();

      expect(issues).toBeInstanceOf(Array);

      // Each issue should have the required properties
      issues.forEach(issue => {
        expect(issue).toHaveProperty('key');
        expect(issue).toHaveProperty('type');
        expect(issue).toHaveProperty('language');
        expect(issue).toHaveProperty('severity');
        expect(['missing', 'extra', 'type-mismatch', 'empty-value']).toContain(
          issue.type
        );
        expect(['error', 'warning']).toContain(issue.severity);
      });
    });
  });

  describe('validateKeyStructure', () => {
    it('should identify structural issues', () => {
      const issues = validateKeyStructure();

      expect(issues).toBeInstanceOf(Array);

      // Each issue should have the required properties
      issues.forEach(issue => {
        expect(issue).toHaveProperty('key');
        expect(issue).toHaveProperty('issue');
        expect(issue).toHaveProperty('description');
        expect([
          'invalid-format',
          'inconsistent-nesting',
          'naming-convention',
        ]).toContain(issue.issue);
      });
    });
  });

  describe('validateTranslationConsistency', () => {
    it('should generate a comprehensive consistency report', () => {
      const result = validateTranslationConsistency();

      expect(result).toHaveProperty('keyIssues');
      expect(result).toHaveProperty('structureIssues');
      expect(result).toHaveProperty('summary');

      expect(result.summary).toHaveProperty('totalIssues');
      expect(result.summary).toHaveProperty('criticalIssues');
      expect(result.summary).toHaveProperty('languageHealth');

      // Language health should be a score between 0-100 for each language
      Object.values(result.summary.languageHealth).forEach(score => {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      });
    });
  });

  describe('isValidTranslationKey', () => {
    it('should validate correct key formats', () => {
      expect(isValidTranslationKey('common.save')).toBe(true);
      expect(isValidTranslationKey('tasks.modal.title.create')).toBe(true);
      expect(isValidTranslationKey('ai.tools.displayName.getTasks')).toBe(true);
    });

    it('should reject invalid key formats', () => {
      expect(isValidTranslationKey('invalid_key')).toBe(false);
      expect(isValidTranslationKey('invalid-key')).toBe(false);
      expect(isValidTranslationKey('Invalid.Key')).toBe(false);
      expect(isValidTranslationKey('too.deeply.nested.key.structure')).toBe(
        false
      );
    });

    it('should reject keys that are too deeply nested', () => {
      expect(isValidTranslationKey('level1.level2.level3.level4')).toBe(true); // 4 levels OK
      expect(isValidTranslationKey('level1.level2.level3.level4.level5')).toBe(
        false
      ); // 5 levels too deep
    });
  });

  describe('suggestKeyImprovements', () => {
    it('should suggest improvements for invalid keys', () => {
      const suggestions = suggestKeyImprovements('invalid_key_format');
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0]).toContain('invalidkeyformat');
    });

    it('should suggest prefix improvements', () => {
      const suggestions = suggestKeyImprovements('button.save');
      expect(suggestions.length).toBeGreaterThan(0);
      // Should suggest using 'common' prefix for button-related keys
      expect(suggestions.some(s => s.includes('common'))).toBe(true);
    });

    it('should suggest shortening deeply nested keys', () => {
      const suggestions = suggestKeyImprovements(
        'very.deeply.nested.key.structure'
      );
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.includes('Reduce nesting'))).toBe(true);
    });

    it('should return empty array for valid keys', () => {
      const suggestions = suggestKeyImprovements('common.save');
      expect(suggestions).toHaveLength(0);
    });
  });

  describe('key naming conventions', () => {
    it('should accept camelCase segments', () => {
      expect(isValidTranslationKey('common.saveChanges')).toBe(true);
      expect(isValidTranslationKey('tasks.createNewTask')).toBe(true);
    });

    it('should reject non-camelCase segments', () => {
      expect(isValidTranslationKey('common.save_changes')).toBe(false);
      expect(isValidTranslationKey('tasks.create-new-task')).toBe(false);
      expect(isValidTranslationKey('Common.Save')).toBe(false);
    });

    it('should accept standard domain prefixes', () => {
      const validPrefixes = [
        'common.test',
        'nav.test',
        'settings.test',
        'tasks.test',
        'timer.test',
        'reports.test',
        'planning.test',
        'ai.test',
        'notifications.test',
        'database.test',
        'security.test',
      ];

      validPrefixes.forEach(key => {
        expect(isValidTranslationKey(key)).toBe(true);
      });
    });
  });
});

# Design Document

## Overview

This design outlines the comprehensive refactoring of KiraPilot's internationalization (i18n) system to support Vietnamese as a base language and systematically replace all hardcoded text strings throughout the application. The current i18n system provides a solid foundation with English, Spanish, French, and German translations, but requires extension and comprehensive application across all components, services, and AI interactions.

## Architecture

### Current i18n System Analysis

The existing i18n system consists of:

- **Translation files**: Located in `src/i18n/locales/` with language-specific exports
- **Translation hook**: `useTranslation()` hook providing `t()` function and current language
- **Language management**: Type-safe language definitions and validation
- **Fallback mechanism**: Automatic fallback to English for missing translations

### Enhanced i18n Architecture

The refactored system will maintain the current architecture while extending it to:

- **Vietnamese language support**: Add `vi.ts` locale file with comprehensive translations
- **Comprehensive coverage**: Ensure all user-facing text uses translation keys
- **AI integration**: Localize AI service messages and tool descriptions
- **Dynamic content**: Support for pluralization and variable substitution
- **Development tools**: Automated detection of missing translations

## Components and Interfaces

### 1. Language Support Extension

**Vietnamese Locale Integration**

```typescript
// src/i18n/index.ts
export type Language = 'en' | 'es' | 'fr' | 'de' | 'vi';

export const languages: Record<Language, string> = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  vi: 'Tiếng Việt',
};
```

**Vietnamese Translation File Structure**

```typescript
// src/i18n/locales/vi.ts
export const vi = {
  // Common actions and UI elements
  'common.save': 'Lưu',
  'common.cancel': 'Hủy',
  'common.delete': 'Xóa',
  // ... comprehensive Vietnamese translations
};
```

### 2. Component Refactoring Strategy

**Hardcoded Text Identification**
Based on code analysis, the following components contain hardcoded strings requiring translation:

- **TaskModal**: "Edit Task", "Create New Task", "What needs to be done?", "Add details about this task...", etc.
- **Settings**: Various setting labels and descriptions
- **AI Components**: "Ready to help", "Setup required", tool descriptions
- **Reports**: Chart labels, time range options, productivity metrics
- **Planning**: Navigation labels, status indicators

**Translation Key Naming Convention**

```typescript
// Hierarchical naming pattern
'component.section.element': 'Translation'

// Examples:
'task.modal.title.create': 'Create New Task'
'task.modal.title.edit': 'Edit Task'
'task.modal.placeholder.title': 'What needs to be done?'
'task.modal.placeholder.description': 'Add details about this task...'
```

### 3. AI Service Localization

**Tool Description Localization**

```typescript
// src/services/ai/ToolExecutionEngine.ts
private getLocalizedToolDescription(toolName: string): string {
  const { t } = useTranslation();
  const descriptionKey = `ai.tools.${toolName}.description`;
  return t(descriptionKey);
}
```

**AI Response Localization**

```typescript
// Localized error messages and status updates
private formatLocalizedResponse(result: ToolResult, toolName: string): string {
  const { t } = useTranslation();
  if (!result.success) {
    return t('ai.error.toolFailed', { toolName: this.getToolDisplayName(toolName), error: result.error });
  }
  return t('ai.success.toolExecuted', { toolName: this.getToolDisplayName(toolName) });
}
```

### 4. Enhanced Translation System

**Variable Substitution Support**

```typescript
// Enhanced getTranslation function
export const getTranslation = (
  language: Language,
  key: TranslationKey,
  variables?: Record<string, string | number>
): string => {
  let translation = translations[language][key] || translations.en[key] || key;

  if (variables) {
    Object.entries(variables).forEach(([key, value]) => {
      translation = translation.replace(`{${key}}`, String(value));
    });
  }

  return translation;
};
```

**Pluralization Support**

```typescript
// Support for plural forms
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
```

## Data Models

### Translation Key Structure

```typescript
// Extended translation key types
export interface TranslationKeys {
  // Common UI elements
  common: {
    save: string;
    cancel: string;
    delete: string;
    edit: string;
    // ... more common keys
  };

  // Task management
  task: {
    modal: {
      title: {
        create: string;
        edit: string;
      };
      placeholder: {
        title: string;
        description: string;
      };
      // ... more task keys
    };
  };

  // AI interactions
  ai: {
    tools: {
      [toolName: string]: {
        description: string;
        success: string;
        error: string;
      };
    };
    status: {
      ready: string;
      setupRequired: string;
      thinking: string;
    };
  };

  // Settings
  settings: {
    [section: string]: {
      [setting: string]: string;
    };
  };
}
```

### Language Configuration

```typescript
// Enhanced language configuration
export interface LanguageConfig {
  code: Language;
  name: string;
  nativeName: string;
  direction: 'ltr' | 'rtl';
  dateFormat: string;
  numberFormat: Intl.NumberFormatOptions;
}

export const languageConfigs: Record<Language, LanguageConfig> = {
  vi: {
    code: 'vi',
    name: 'Vietnamese',
    nativeName: 'Tiếng Việt',
    direction: 'ltr',
    dateFormat: 'dd/MM/yyyy',
    numberFormat: { locale: 'vi-VN' },
  },
  // ... other language configs
};
```

## Error Handling

### Missing Translation Detection

```typescript
// Development-time missing translation detection
export const getTranslation = (
  language: Language,
  key: TranslationKey,
  variables?: Record<string, string | number>
): string => {
  const translation = translations[language]?.[key];

  if (!translation) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        `Missing translation for key: ${key} in language: ${language}`
      );
    }

    // Fallback to English
    const fallback = translations.en[key];
    if (!fallback) {
      console.error(`Missing translation key: ${key} in all languages`);
      return key; // Return key as last resort
    }
    return fallback;
  }

  return processTranslation(translation, variables);
};
```

### Runtime Error Handling

```typescript
// Graceful error handling for translation failures
export const safeTranslation = (
  language: Language,
  key: TranslationKey,
  fallback?: string
): string => {
  try {
    return getTranslation(language, key);
  } catch (error) {
    console.error(`Translation error for key ${key}:`, error);
    return fallback || key;
  }
};
```

## Testing Strategy

### Translation Coverage Testing

```typescript
// Automated tests to ensure translation coverage
describe('Translation Coverage', () => {
  it('should have all keys present in all languages', () => {
    const englishKeys = Object.keys(translations.en);

    Object.keys(translations).forEach(lang => {
      if (lang === 'en') return;

      const langKeys = Object.keys(translations[lang]);
      const missingKeys = englishKeys.filter(key => !langKeys.includes(key));

      expect(missingKeys).toEqual([]);
    });
  });

  it('should not have unused translation keys', () => {
    // Test to identify unused translation keys
  });
});
```

### Component Translation Testing

```typescript
// Test that components use translations correctly
describe('Component Translations', () => {
  it('should display Vietnamese text when language is set to vi', () => {
    const mockPreferences = { language: 'vi' };
    render(<TaskModal />, { preferences: mockPreferences });

    expect(screen.getByText('Tạo Nhiệm Vụ Mới')).toBeInTheDocument();
  });
});
```

### AI Service Translation Testing

```typescript
// Test AI service localization
describe('AI Service Translations', () => {
  it('should return localized tool descriptions', () => {
    const engine = new ToolExecutionEngine();
    const description = engine.getLocalizedToolDescription('create_task');

    expect(description).toBe('Tạo nhiệm vụ mới trong hệ thống');
  });
});
```

## Implementation Phases

### Phase 1: Vietnamese Language Support

- Add Vietnamese locale file with comprehensive translations
- Update language type definitions and configurations
- Test Vietnamese language selection and display

### Phase 2: Component Refactoring

- Systematically replace hardcoded strings in UI components
- Implement translation keys following naming conventions
- Update component tests to verify translation usage

### Phase 3: AI Service Localization

- Localize AI tool descriptions and messages
- Implement localized error handling in AI services
- Add translation support for dynamic AI responses

### Phase 4: Enhanced Translation Features

- Implement variable substitution and pluralization
- Add development tools for missing translation detection
- Create comprehensive translation coverage tests

### Phase 5: Quality Assurance

- Conduct thorough testing across all supported languages
- Verify proper fallback behavior
- Performance testing for translation loading and switching

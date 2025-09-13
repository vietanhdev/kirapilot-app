# KiraPilot Internationalization (i18n) System

This directory contains the internationalization system for KiraPilot, providing comprehensive multi-language support with advanced validation and management tools.

## 🌍 Supported Languages

| Language   | Code | Native Name | Coverage         |
| ---------- | ---- | ----------- | ---------------- |
| English    | `en` | English     | 100% (Reference) |
| Spanish    | `es` | Español     | ~95%             |
| French     | `fr` | Français    | ~95%             |
| German     | `de` | Deutsch     | ~95%             |
| Vietnamese | `vi` | Tiếng Việt  | ~95%             |
| Japanese   | `ja` | 日本語      | ~95%             |
| Portuguese | `pt` | Português   | ~95%             |

## 📁 Directory Structure

```
src/i18n/
├── locales/           # Translation files
│   ├── en.ts         # English (reference language)
│   ├── es.ts         # Spanish
│   ├── fr.ts         # French
│   ├── de.ts         # German
│   ├── vi.ts         # Vietnamese
│   ├── ja.ts         # Japanese
│   └── pt.ts         # Portuguese
├── index.ts          # Main i18n exports and utilities
└── README.md         # This file
```

## 🚀 Quick Start

### Using Translations in Components

```tsx
import { useTranslation } from '../hooks/useTranslation';

export const MyComponent = () => {
  const { t } = useTranslation();

  return (
    <div>
      <h1>{t('common.welcome')}</h1>
      <p>{t('tasks.description', { count: 5 })}</p>
    </div>
  );
};
```

### Adding New Translation Keys

1. Add the key to the English reference file (`locales/en.ts`):

```typescript
export const en = {
  // ... existing keys
  'myFeature.newKey': 'My new translatable text',
};
```

2. Add translations to other language files:

```typescript
export const es = {
  // ... existing keys
  'myFeature.newKey': 'Mi nuevo texto traducible',
};
```

3. Use the key in your component:

```tsx
const text = t('myFeature.newKey');
```

## 🔧 Translation Management Tools

### Command Line Tools

```bash
# Check translation coverage and validate keys
npm run i18n:check

# Validate translation key structure only
npm run i18n:validate

# Export all translations to CSV
npm run i18n:export

# Generate translation stubs for a specific language
npm run i18n:stubs es

# Show help
npm run i18n:help
```

### Development UI

The `TranslationManager` component provides a visual interface for managing translations:

```tsx
import { TranslationManager } from '../components/dev/TranslationManager';

// Use in development settings or admin panel
<TranslationManager />;
```

### Language Switcher Component

```tsx
import { LanguageSwitcher } from '../components/common/LanguageSwitcher';

// Full language switcher
<LanguageSwitcher />

// Minimal version
<LanguageSwitcher variant="minimal" showLabel={false} />

// Development quick switcher (auto-hidden in production)
<DevLanguageSwitcher />
```

## 📝 Translation Key Naming Conventions

### Hierarchical Structure

Use dot notation to organize keys hierarchically:

```typescript
'common.save'; // ✅ Good
'settings.ai.apiKey'; // ✅ Good
'save_button'; // ❌ Avoid underscores
'settingsAiApiKey'; // ❌ Avoid flat camelCase
```

### Standard Prefixes

Use consistent prefixes for different domains:

- `common.*` - Shared UI elements (buttons, labels, etc.)
- `nav.*` - Navigation items
- `settings.*` - Settings and preferences
- `tasks.*` - Task management
- `timer.*` - Time tracking
- `reports.*` - Analytics and reports
- `planning.*` - Planning and scheduling
- `ai.*` - AI assistant features
- `notifications.*` - System notifications

### Examples

```typescript
// ✅ Good examples
'common.save';
'common.cancel';
'tasks.create';
'tasks.deleteConfirm';
'settings.ai.apiKey';
'timer.startSession';

// ❌ Avoid these patterns
'saveButton'; // Missing prefix
'common.save.button.text'; // Too deeply nested
'task_create'; // Underscores
'SAVE'; // All caps
```

## 🔍 Validation and Quality Assurance

### Automatic Validation

The system includes comprehensive validation:

1. **Coverage Validation**: Ensures all languages have translations for all keys
2. **Consistency Validation**: Checks for missing or extra keys across languages
3. **Structure Validation**: Validates key naming conventions
4. **Usage Tracking**: Monitors which keys are actually used (development only)

### Development Warnings

In development mode, the system will warn about:

- Missing translations (console warnings)
- Unused translation keys
- Invalid key naming patterns
- Inconsistent translations across languages

### Translation Health Scores

Each language gets a health score based on:

- **Coverage**: Percentage of keys translated
- **Consistency**: No extra or missing keys
- **Quality**: Proper key structure and naming

Health levels:

- **Excellent** (95-100%): Ready for production
- **Good** (85-94%): Minor issues, mostly ready
- **Needs Improvement** (70-84%): Significant gaps
- **Critical** (<70%): Major translation work needed

## 🛠️ Advanced Features

### Variable Substitution

```tsx
// In translation file
'welcome.message': 'Hello {name}, you have {count} tasks'

// In component
const message = t('welcome.message', { name: 'John', count: 5 });
// Result: "Hello John, you have 5 tasks"
```

### Plural Forms

```tsx
// In translation file
'tasks.count.singular': 'You have {count} task'
'tasks.count.plural': 'You have {count} tasks'

// In component
const { tPlural } = useTranslation();
const message = tPlural('tasks.count', taskCount, { count: taskCount });
```

### Safe Translations

```tsx
const { tSafe } = useTranslation();

// Provides fallback if key is missing
const text = tSafe('possibly.missing.key', 'Default text');
```

### Runtime Validation Hook

```tsx
import { useTranslationValidation } from '../hooks/useTranslationValidation';

const MyDevComponent = () => {
  const {
    coverageReports,
    inconsistentKeys,
    validateTranslations,
    getLanguageHealth,
  } = useTranslationValidation();

  // Use validation data in your component
};
```

## 📊 Translation Workflow

### For Developers

1. **Add New Features**: Add English keys first
2. **Validate**: Run `npm run i18n:check` to see missing translations
3. **Generate Stubs**: Use `npm run i18n:stubs <lang>` for quick setup
4. **Test**: Use `DevLanguageSwitcher` to test different languages

### For Translators

1. **Export Current State**: Run `npm run i18n:export` to get CSV
2. **Translate**: Use spreadsheet software or translation tools
3. **Import**: Copy translations back to locale files
4. **Validate**: Run `npm run i18n:check` to verify completeness

### For Project Managers

1. **Monitor Health**: Use `TranslationManager` component
2. **Track Progress**: Check coverage percentages
3. **Identify Priorities**: Focus on languages with low health scores
4. **Export Reports**: Generate validation reports for stakeholders

## 🔄 Continuous Integration

### Pre-commit Hooks

The system can be integrated with pre-commit hooks:

```bash
# In .husky/pre-commit
npm run i18n:validate
```

### CI/CD Pipeline

Add translation validation to your CI pipeline:

```yaml
# In GitHub Actions or similar
- name: Validate Translations
  run: |
    npm run i18n:check
    # Fail if critical issues found
```

## 🌟 Best Practices

### 1. Keep Keys Descriptive

```typescript
// ✅ Good - clear context
'tasks.deleteConfirmMessage';
'settings.ai.apiKeyPlaceholder';

// ❌ Avoid - unclear context
'message';
'placeholder';
```

### 2. Group Related Keys

```typescript
// ✅ Good - grouped by feature
'timer.start';
'timer.pause';
'timer.stop';
'timer.reset';

// ❌ Avoid - scattered
'startTimer';
'pauseButton';
'stopAction';
'resetTimer';
```

### 3. Use Consistent Terminology

```typescript
// ✅ Good - consistent "create" vs "add"
'tasks.create';
'projects.create';
'categories.create';

// ❌ Avoid - mixed terminology
'tasks.create';
'projects.add';
'categories.new';
```

### 4. Plan for Pluralization

```typescript
// ✅ Good - supports plurals
'tasks.count': '{count} task(s)'
// Or separate keys:
'tasks.count.singular': '{count} task'
'tasks.count.plural': '{count} tasks'
```

### 5. Consider Context

```typescript
// ✅ Good - context-specific
'navigation.settings'; // Settings in nav menu
'button.settings'; // Settings button
'page.settings.title'; // Settings page title

// ❌ Avoid - ambiguous
'settings'; // Which settings? Where?
```

## 🐛 Troubleshooting

### Common Issues

1. **Missing Translation Warning**
   - Check if key exists in reference language (English)
   - Verify key spelling and casing
   - Run `npm run i18n:check` to see all missing keys

2. **Key Not Found Error**
   - Ensure key is added to `en.ts` first
   - Check TypeScript types are updated
   - Restart development server

3. **Inconsistent Translations**
   - Run `npm run i18n:validate` to find structural issues
   - Use `TranslationManager` component to visualize problems
   - Generate stubs for missing translations

4. **Performance Issues**
   - Translation validation only runs in development
   - Production builds exclude validation overhead
   - Consider lazy loading for large translation files

### Getting Help

1. Check the console for development warnings
2. Use the `TranslationManager` component for visual debugging
3. Run `npm run i18n:help` for command-line tool usage
4. Review validation reports for detailed analysis

## 🚀 Future Enhancements

- **Automatic Translation**: Integration with translation services
- **Context Screenshots**: Visual context for translators
- **Translation Memory**: Reuse of similar translations
- **Collaborative Tools**: Real-time translation collaboration
- **A/B Testing**: Test different translations
- **Analytics**: Track which translations perform better

---

For more information, see the [main project documentation](../../README.md) or check the [translation validation utilities](../utils/translationValidation.ts).

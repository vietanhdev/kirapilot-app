# Translation Guide

This guide provides comprehensive documentation for managing translations in KiraPilot, including naming conventions, best practices, and development tools.

## Table of Contents

- [Overview](#overview)
- [Translation Key Naming Conventions](#translation-key-naming-conventions)
- [File Structure](#file-structure)
- [Adding New Translations](#adding-new-translations)
- [Development Tools](#development-tools)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Overview

KiraPilot uses a hierarchical translation system that supports multiple languages with automatic fallback to English. The system is designed to be:

- **Type-safe**: All translation keys are validated at compile time
- **Consistent**: Standardized naming conventions across all languages
- **Maintainable**: Clear organization and validation tools
- **Developer-friendly**: Comprehensive development warnings and tools

### Supported Languages

- **English (en)** - Reference language
- **Spanish (es)** - Español
- **French (fr)** - Français
- **German (de)** - Deutsch
- **Vietnamese (vi)** - Tiếng Việt

## Translation Key Naming Conventions

### Hierarchical Structure

Translation keys follow a hierarchical dot notation pattern:

```
domain.component.element
```

**Examples:**

```typescript
'common.save'; // ✅ Good
'tasks.modal.title.create'; // ✅ Good
'ai.tools.displayName.getTasks'; // ✅ Good
'settings.general.theme'; // ✅ Good
```

### Naming Rules

1. **Use camelCase** for each segment

   ```typescript
   'tasks.addNotes'; // ✅ Good
   'tasks.add_notes'; // ❌ Bad - use camelCase
   'tasks.add-notes'; // ❌ Bad - use camelCase
   ```

2. **Maximum 4 levels deep**

   ```typescript
   'ai.tools.displayName.getTasks'; // ✅ Good (4 levels)
   'ai.tools.displayName.getTasks.sub'; // ❌ Bad (5 levels)
   ```

3. **Use descriptive names**

   ```typescript
   'tasks.deleteConfirmMessage'; // ✅ Good - clear purpose
   'tasks.msg'; // ❌ Bad - unclear
   ```

4. **Follow domain prefixes**
   ```typescript
   'common.*'; // Shared UI elements
   'nav.*'; // Navigation elements
   'settings.*'; // Settings and preferences
   'tasks.*'; // Task management
   'timer.*'; // Time tracking
   'reports.*'; // Analytics and reports
   'planning.*'; // Planning and scheduling
   'ai.*'; // AI assistant features
   'notifications.*'; // System notifications
   'database.*'; // Database error messages
   'security.*'; // Security-related messages
   ```

### Domain-Specific Conventions

#### Common Elements (`common.*`)

For reusable UI elements and actions:

```typescript
'common.save'; // Action buttons
'common.cancel'; // Action buttons
'common.loading'; // Status messages
'common.error'; // Generic states
'common.confirmDialog.confirm'; // Nested components
```

#### Component-Specific (`[feature].[component].*`)

For feature-specific components:

```typescript
'tasks.modal.title.create'; // Task modal titles
'tasks.modal.placeholder.title'; // Form placeholders
'settings.general.theme'; // Settings sections
'ai.status.ready'; // AI status messages
```

#### Error Messages (`[service].error.*`)

For service-layer error messages:

```typescript
'database.error.initFailed'; // Database errors
'taskService.error.createFailed'; // Service errors
'security.error.encryptFailed'; // Security errors
```

## File Structure

Translation files are located in `src/i18n/locales/`:

```
src/i18n/
├── index.ts              # Main i18n configuration
└── locales/
    ├── en.ts            # English (reference)
    ├── es.ts            # Spanish
    ├── fr.ts            # French
    ├── de.ts            # German
    └── vi.ts            # Vietnamese
```

### File Format

Each locale file exports a translation object:

```typescript
// src/i18n/locales/en.ts
export const en = {
  // Common elements
  'common.save': 'Save',
  'common.cancel': 'Cancel',

  // Feature-specific
  'tasks.title': 'Tasks',
  'tasks.create': 'Create Task',

  // Nested structure
  'tasks.modal.title.create': 'Create New Task',
  'tasks.modal.title.edit': 'Edit Task',
};
```

## Adding New Translations

### Step 1: Add to English (Reference)

Always start by adding the key to `src/i18n/locales/en.ts`:

```typescript
export const en = {
  // ... existing keys
  'tasks.newFeature.title': 'New Feature Title',
  'tasks.newFeature.description': 'Description of the new feature',
};
```

### Step 2: Add to All Other Languages

Add the same key to all other language files:

```typescript
// src/i18n/locales/es.ts
export const es = {
  // ... existing keys
  'tasks.newFeature.title': 'Título de Nueva Función',
  'tasks.newFeature.description': 'Descripción de la nueva función',
};
```

### Step 3: Use in Components

Import and use the translation:

```typescript
import { useTranslation } from '../hooks/useTranslation';

function MyComponent() {
  const { t } = useTranslation();

  return (
    <div>
      <h1>{t('tasks.newFeature.title')}</h1>
      <p>{t('tasks.newFeature.description')}</p>
    </div>
  );
}
```

### Variable Substitution

For dynamic content, use variable substitution:

```typescript
// Translation
'tasks.timeEstimate': 'Estimated: {minutes} minutes'

// Usage
t('tasks.timeEstimate', { minutes: 30 })
// Result: "Estimated: 30 minutes"
```

### Pluralization

For plural forms, use separate keys:

```typescript
// Translations
'tasks.count.singular': '{count} task'
'tasks.count.plural': '{count} tasks'

// Usage with helper
getTranslationPlural('en', 'tasks.count', taskCount, { count: taskCount })
```

## Development Tools

### Validation Utilities

The system includes comprehensive validation tools:

```typescript
import { validateCurrentTranslations } from '../utils/translationScanner';

// Quick validation
validateCurrentTranslations();
```

### Development Warnings

In development mode, the system automatically warns about:

- **Missing translations**: Keys that exist in English but not in other languages
- **Invalid key formats**: Keys that don't follow naming conventions
- **Unused keys**: Translation keys that aren't used in the codebase
- **Hardcoded strings**: Text that should be translated

### Console Output Examples

```
🌐 Translation missing: "tasks.newFeature" for language "es"
🌐 Translation key "invalid_key_format" doesn't follow naming conventions
🌐 Found 3 unused translation keys: ["old.key1", "old.key2", "old.key3"]
🌐 Found 5 critical hardcoded strings that need translation
```

### Scanning Tools

Use the translation scanner to analyze the entire codebase:

```typescript
import { TranslationScanner } from '../utils/translationScanner';

// Create scanner and generate report
const scanner = new TranslationScanner(fileSystem);
const report = await scanner.generateReport();
scanner.printReport(report);
```

## Best Practices

### 1. Always Use Translation Keys

❌ **Don't use hardcoded strings:**

```typescript
<button>Save Changes</button>
<p>Please enter a valid email address</p>
```

✅ **Use translation keys:**

```typescript
<button>{t('common.saveChanges')}</button>
<p>{t('validation.emailInvalid')}</p>
```

### 2. Group Related Keys

❌ **Don't scatter related keys:**

```typescript
'saveButton': 'Save',
'cancelButton': 'Cancel',
'taskTitle': 'Task Title',
'taskDescription': 'Task Description',
```

✅ **Group by feature/component:**

```typescript
'common.save': 'Save',
'common.cancel': 'Cancel',
'tasks.title': 'Task Title',
'tasks.description': 'Task Description',
```

### 3. Use Descriptive Keys

❌ **Don't use generic names:**

```typescript
'text1': 'Welcome to KiraPilot',
'msg': 'Task created successfully',
```

✅ **Use descriptive names:**

```typescript
'welcome.title': 'Welcome to KiraPilot',
'tasks.createSuccess': 'Task created successfully',
```

### 4. Handle Edge Cases

Always provide fallbacks and handle missing translations:

```typescript
// Use safeTranslation for critical UI elements
const title = safeTranslation(language, 'tasks.title', 'Tasks');

// Handle pluralization properly
const taskCount = getTranslationPlural(language, 'tasks.count', count, {
  count,
});
```

### 5. Keep Translations Consistent

- Use the same terminology across all features
- Maintain consistent tone and style
- Follow platform-specific conventions (e.g., "Cancel" vs "Annuler")

### 6. Test All Languages

- Verify translations in all supported languages
- Check for text overflow in different languages
- Test right-to-left languages if supported

## Troubleshooting

### Common Issues

#### 1. Missing Translation Warning

```
🌐 Translation missing: "new.key" for language "es"
```

**Solution:** Add the key to the missing language file:

```typescript
// src/i18n/locales/es.ts
'new.key': 'Spanish translation here',
```

#### 2. Invalid Key Format

```
🌐 Translation key "invalid_key" doesn't follow naming conventions
```

**Solution:** Use camelCase and hierarchical structure:

```typescript
// Change from:
'invalid_key': 'Text'
// To:
'feature.invalidKey': 'Text'
```

#### 3. Hardcoded String Detected

```
🌐 Found hardcoded string: "Save Changes" in TaskModal.tsx:45
```

**Solution:** Replace with translation key:

```typescript
// Change from:
<button>Save Changes</button>
// To:
<button>{t('common.saveChanges')}</button>
```

#### 4. Unused Translation Key

```
🌐 Found unused translation key: "old.feature.title"
```

**Solution:** Either use the key or remove it from all language files.

### Debugging Tips

1. **Enable development warnings** by setting `NODE_ENV=development`
2. **Use browser console** to see translation warnings
3. **Run validation tools** regularly during development
4. **Check coverage reports** to ensure all languages are complete

### Performance Considerations

- Translation loading is optimized for the current language
- Fallback to English is automatic and fast
- Variable substitution is cached for performance
- Large translation objects are split by feature when possible

## Migration Guide

### From Hardcoded Strings

1. **Identify hardcoded strings** using the scanner tool
2. **Create appropriate translation keys** following naming conventions
3. **Add translations** to all language files
4. **Replace hardcoded strings** with translation calls
5. **Test all languages** to ensure proper display

### Adding New Languages

1. **Create new locale file** in `src/i18n/locales/`
2. **Add language to type definitions** in `src/i18n/index.ts`
3. **Copy all keys from English** and translate values
4. **Test the new language** thoroughly
5. **Update language selector** in settings

## Contributing

When contributing translations:

1. **Follow naming conventions** strictly
2. **Add keys to ALL languages** (use English as placeholder if needed)
3. **Test your changes** with the validation tools
4. **Provide context** for translators when adding complex keys
5. **Update this guide** if adding new conventions

For questions or issues with translations, please refer to the development team or create an issue in the project repository.

# Code Formatting Setup

This project uses an automated code formatting and linting setup to ensure consistent code quality and style.

## Tools Used

### 🎨 Prettier

- **Purpose**: Code formatting (spacing, indentation, line breaks, etc.)
- **Config**: `.prettierrc` and `.prettierignore`
- **Features**:
  - Single quotes for strings
  - Semicolons enforced
  - 80 character line width
  - 2-space indentation
  - LF line endings

### 🔍 ESLint

- **Purpose**: Code linting (code quality, best practices, error detection)
- **Config**: `eslint.config.js` (ESLint 9+ flat config)
- **Features**:
  - TypeScript support
  - React best practices
  - Unused variable detection (with underscore prefix exception)
  - Basic code quality rules

### 🪝 Husky

- **Purpose**: Git hooks management
- **Config**: `.husky/pre-commit`
- **Features**:
  - Runs formatting and linting before each commit
  - Prevents commits with formatting issues

### 🧹 lint-staged

- **Purpose**: Run tools only on staged files
- **Config**: `package.json` under `lint-staged`
- **Features**:
  - Faster pre-commit checks (only staged files)
  - Automatic formatting fixes
  - TypeScript and JavaScript support

## Available Scripts

```bash
# Check formatting (doesn't modify files)
npm run format:check

# Format all files
npm run format

# Lint code (with warnings allowed)
npm run lint

# Lint and auto-fix issues
npm run lint:fix

# Type checking only
npm run type-check
```

## How It Works

### During Development

1. Write your code normally
2. Stage your files with `git add`
3. Commit with `git commit -m "your message"`
4. **Pre-commit hook automatically runs**:
   - ESLint checks and fixes code issues
   - Prettier formats the code
   - If any errors occur, commit is rejected

### Manual Formatting

You can also run formatting manually:

```bash
# Format all source files
npm run format

# Check if files need formatting
npm run format:check

# Lint and fix issues
npm run lint:fix
```

## Configuration Details

### Prettier Configuration (`.prettierrc`)

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 80,
  "tabWidth": 2,
  "useTabs": false,
  "endOfLine": "lf",
  "arrowParens": "avoid",
  "bracketSpacing": true,
  "jsxSingleQuote": true,
  "quoteProps": "as-needed"
}
```

### ESLint Configuration

- **Essential rules**: `prefer-const`, `no-var`
- **React rules**: JSX scope, prop-types disabled
- **TypeScript rules**: Unused vars (warnings), explicit any (warnings)
- **Disabled rules**: console, undef, prototype-builtins (for development)

### lint-staged Configuration

```json
{
  "*.{ts,tsx}": ["eslint --fix --max-warnings 200", "prettier --write"],
  "*.{js,jsx,json,css,md}": ["prettier --write"]
}
```

## IDE Integration

### VS Code

Install these extensions for the best experience:

- **Prettier - Code formatter**: Automatic formatting on save
- **ESLint**: Real-time linting feedback

Add to your VS Code settings (`.vscode/settings.json`):

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  }
}
```

### Other IDEs

Most modern IDEs support Prettier and ESLint. Check your IDE's documentation for setup instructions.

## Troubleshooting

### Pre-commit Hook Fails

1. **Check the error message** in the terminal
2. **Run manually**: `npm run lint:fix` and `npm run format`
3. **Stage the fixes**: `git add .`
4. **Try committing again**

### Formatting Conflicts

1. **Run Prettier**: `npm run format`
2. **Check ESLint**: `npm run lint:fix`
3. **Resolve any remaining issues manually**

### Disabling for Emergency Commits

⚠️ **Not recommended**, but if absolutely necessary:

```bash
git commit --no-verify -m "emergency fix"
```

## Benefits

✅ **Consistent code style** across the entire project  
✅ **Automatic formatting** - no manual formatting needed  
✅ **Early error detection** before code review  
✅ **Improved code quality** through linting rules  
✅ **Better collaboration** - no formatting-related conflicts  
✅ **IDE agnostic** - works regardless of editor choice

## Customization

### Adding New Rules

1. **ESLint rules**: Edit `eslint.config.js`
2. **Prettier options**: Edit `.prettierrc`
3. **File patterns**: Update `lint-staged` in `package.json`

### Excluding Files

1. **Prettier**: Add patterns to `.prettierignore`
2. **ESLint**: Add patterns to `ignores` in `eslint.config.js`

Remember to test changes thoroughly and ensure the pre-commit hook still works after modifications!

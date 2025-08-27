# Development Setup

Get your development environment ready for contributing to KiraPilot.

## Prerequisites

Before you begin, ensure you have the following installed on your system:

### Required Software

- **Node.js 18+**: Download from [nodejs.org](https://nodejs.org/)
- **Rust (latest stable)**: Install via [rustup.rs](https://rustup.rs/)
- **Git**: Download from [git-scm.com](https://git-scm.com/)

### Platform-Specific Requirements

#### macOS

```bash
# Install Xcode Command Line Tools
xcode-select --install

# Install Homebrew (optional but recommended)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

#### Windows

- Install [Visual Studio Build Tools](https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022)
- Ensure Windows SDK is installed

#### Linux (Ubuntu/Debian)

```bash
sudo apt update
sudo apt install build-essential curl wget file libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev
```

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/vietanhdev/kirapilot-app.git
cd kirapilot-app
```

### 2. Install Dependencies

```bash
# Install Node.js dependencies
npm install

# Install Rust dependencies (handled automatically by Tauri)
# This will be done when you first run the Tauri dev command
```

### 3. Set Up Development Database

The application uses SQLite with automatic migrations. The database will be created automatically when you first run the application.

```bash
# The database file will be created at:
# - macOS: ~/Library/Application Support/com.kirapilot.app/kirapilot.db
# - Windows: %APPDATA%/com.kirapilot.app/kirapilot.db
# - Linux: ~/.local/share/com.kirapilot.app/kirapilot.db
```

### 4. Start the Development Server

```bash
# Start the Tauri development server
npm run tauri dev

# Or start just the frontend (for UI development)
npm run dev
```

## Development Workflow

### Daily Development

1. **Pull latest changes**:

   ```bash
   git pull origin main
   npm install  # In case dependencies changed
   ```

2. **Start development server**:

   ```bash
   npm run tauri dev
   ```

3. **Run tests** (in a separate terminal):
   ```bash
   npm test
   ```

### Code Quality Checks

Before committing, always run:

```bash
# Type checking
npm run type-check

# Linting
npm run lint

# Formatting check
npm run format:check

# Run all tests
npm test

# Build to ensure everything compiles
npm run build
```

### Git Hooks

The project uses Husky for Git hooks:

- **Pre-commit**: Runs lint-staged to format and lint staged files
- **Commit-msg**: Validates commit message format

### Available Scripts

```bash
# Development
npm run dev              # Start Vite dev server
npm run tauri dev        # Start Tauri app in dev mode

# Building
npm run build            # Build frontend (tsc + vite build)
npm run tauri:build      # Build Tauri application
npm run build:all        # Run type-check, lint, test, and build

# Testing
npm test                 # Run Jest tests
npm run test:watch       # Jest in watch mode
npm run test:coverage    # Generate coverage report

# Code Quality
npm run lint             # ESLint check
npm run lint:fix         # ESLint auto-fix
npm run format           # Prettier format
npm run format:check     # Prettier check
npm run type-check       # TypeScript check without emit
```

## IDE Setup

### VS Code (Recommended)

Install the following extensions:

- **Rust Analyzer**: Rust language support
- **Tauri**: Tauri-specific features
- **ES7+ React/Redux/React-Native snippets**: React snippets
- **TypeScript Importer**: Auto import for TypeScript
- **Prettier**: Code formatting
- **ESLint**: Linting support

### Recommended VS Code Settings

Create `.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.preferences.importModuleSpecifier": "relative",
  "rust-analyzer.checkOnSave.command": "clippy"
}
```

## Troubleshooting

### Common Issues

#### Rust Compilation Errors

```bash
# Update Rust toolchain
rustup update

# Clear Rust cache
cargo clean
```

#### Node.js Module Issues

```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

#### Database Issues

```bash
# Reset development database
rm -f src-tauri/kirapilot.db
# Restart the app to recreate with fresh migrations
```

#### Build Failures

```bash
# Clean all build artifacts
npm run clean  # If available
rm -rf dist/
rm -rf src-tauri/target/
npm run build
```

### Getting Help

- Check the [FAQ](../user-guide/faq.md) for common questions
- Review [troubleshooting guide](../user-guide/troubleshooting.md)
- Open an issue on GitHub for bugs
- Join our Discord community for development discussions

## Next Steps

Once your environment is set up:

1. Read the [Architecture Overview](./architecture.md)
2. Understand the [Project Structure](./project-structure.md)
3. Review the [Contributing Guidelines](./contributing.md)
4. Explore the [Database Documentation](./database.md)

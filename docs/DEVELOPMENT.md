# Development Setup Guide

This guide covers setting up the development environment for KiraPilot.

## Prerequisites

### System Requirements

- **Node.js**: LTS version (20.x recommended)
- **Rust**: Latest stable version
- **Git**: For version control

### Platform-Specific Dependencies

#### Linux (Ubuntu/Debian)

```bash
sudo apt-get update
sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf
```

#### macOS

```bash
# Install Xcode Command Line Tools
xcode-select --install

# Install Homebrew (if not already installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

#### Windows

- Install Visual Studio 2022 with C++ build tools
- Install WebView2 runtime (usually pre-installed on Windows 11)

## Initial Setup

### 1. Clone and Install

```bash
# Clone the repository
git clone https://github.com/vietanhdev/kirapilot-app.git
cd kirapilot-app

# Install Node.js dependencies
npm ci

# Install Rust toolchain (if not already installed)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env
```

### 2. Verify Installation

```bash
# Check versions
node --version
npm --version
rustc --version
cargo --version

# Verify Tauri CLI works
npm run tauri --version
```

## Development Workflow

### Daily Development

```bash
# Start development server with hot reload
npm run dev

# In another terminal, start Tauri app
npm run tauri dev
```

This will:

- Start Vite dev server with HMR
- Launch the Tauri desktop application
- Auto-reload on file changes

### Code Quality Commands

```bash
# Type checking
npm run type-check         # TypeScript compilation check

# Linting
npm run lint              # Check for lint errors
npm run lint:fix          # Auto-fix lint issues

# Formatting
npm run format           # Format code with Prettier
npm run format:check     # Check if code is formatted

# Testing
npm test                 # Run Jest tests once
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Generate coverage report

# Pre-commit checks (run all quality checks)
npm run lint && npm run type-check && npm test
```

### Building

```bash
# Frontend build only
npm run build

# Full application build
npm run tauri build
```

## Development Tools

### Code Editor Setup

**VS Code Extensions** (recommended):

- TypeScript and JavaScript Language Features
- ESLint
- Prettier
- Tailwind CSS IntelliSense
- rust-analyzer
- Tauri

### Environment Variables

Create a `.env.local` file for local development:

```env
# Development settings
VITE_DEV_MODE=true
VITE_LOG_LEVEL=debug

# Database settings
VITE_DB_NAME=kirapilot_dev.db
```

## Database Development

### Local Database

KiraPilot uses SQLite with Tauri's SQL plugin:

```typescript
// Initialize database
const db = await initializeDatabase();

// Execute queries
const tasks = await db.select('SELECT * FROM tasks');
```

### Migrations

Database schema changes use a migration system:

```typescript
// Add new migration to src/services/database/index.ts
{
  version: '003',
  description: 'Add new feature',
  up: ['CREATE TABLE new_feature (...)'],
  down: ['DROP TABLE new_feature']
}
```

### Testing Database Operations

Use the built-in database test component:

```typescript
// In development, add to your component
import { DatabaseTest } from './services/database/DatabaseTest';

<DatabaseTest />
```

## Debugging

### Frontend Debugging

- Use browser dev tools in the Tauri webview
- Console logs appear in the terminal running `npm run tauri dev`
- React DevTools extension works normally

### Backend (Rust) Debugging

```bash
# Enable Rust debug logs
RUST_LOG=debug npm run tauri dev

# For specific modules
RUST_LOG=tauri=debug npm run tauri dev
```

### Database Debugging

```typescript
// Enable SQL query logging
import { debugDatabase } from './services/database/utils';

// Run in development
await debugDatabase();
```

## Common Issues

### Build Errors

**Tauri build fails on Linux:**

```bash
# Install missing dependencies
sudo apt-get install libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev
```

**TypeScript errors:**

```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm ci
```

**Database connection issues:**

- Ensure SQLite database file permissions are correct
- Check Tauri capabilities in `src-tauri/capabilities/default.json`

### Performance

**Slow development server:**

- Disable unused VS Code extensions
- Increase Node.js memory: `NODE_OPTIONS="--max-old-space-size=8192"`

**Large bundle size:**

- Analyze with `npm run build -- --analyze`
- Check for duplicate dependencies

## Git Workflow

### Commit Standards

Follow conventional commits:

```bash
feat: add task dependency system
fix: resolve timer pause issue
docs: update setup instructions
refactor: simplify database queries
```

### Pre-commit Hooks

Husky runs these checks automatically:

```bash
# .husky/pre-commit
npm run lint
npm run type-check
npm test
```

### Branch Strategy

- `main`: Production-ready code
- `develop`: Integration branch
- `feature/*`: New features
- `fix/*`: Bug fixes

## IDE Configuration

### VS Code Settings

```json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "tailwindCSS.experimental.classRegex": [
    ["cva\\(([^)]*)\\)", "[\"'`]([^\"'`]*).*?[\"'`]"]
  ]
}
```

## Quick Reference

### Essential Commands

```bash
# Start development
npm run tauri dev

# Code quality check
npm run lint && npm run type-check && npm test

# Build application
npm run tauri build
```

### Project Structure

For detailed architecture information, see [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md).

### Testing Strategy

For comprehensive testing guidelines, see [TESTING.md](TESTING.md).

This setup provides a robust development environment for building KiraPilot with proper tooling, testing, and debugging capabilities.

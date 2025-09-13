# Building and Deployment

Learn how to build and deploy KiraPilot for different platforms.

## Prerequisites

### System Requirements

- **Node.js**: 18.0 or later
- **Rust**: 1.70 or later (installed via [rustup](https://rustup.rs/))
- **Platform-specific tools**:
  - **macOS**: Xcode Command Line Tools
  - **Windows**: Microsoft C++ Build Tools
  - **Linux**: Build essentials (gcc, pkg-config, etc.)

### Installation

1. **Clone the repository**:

   ```bash
   git clone https://github.com/vietanhdev/kirapilot-app.git
   cd kirapilot-app
   ```

2. **Install dependencies**:

   ```bash
   npm install
   ```

3. **Install Rust dependencies** (handled automatically by Tauri):
   ```bash
   npm run tauri --version
   ```

## Development Build

### Start Development Server

Run the development server with hot module replacement:

```bash
npm run dev
```

This starts:

- **Vite dev server** on `http://localhost:1421`
- **Hot Module Replacement** for instant updates
- **TypeScript compilation** in watch mode

### Start Tauri Development App

Run the full Tauri application in development mode:

```bash
npm run tauri:dev
```

This:

- Builds the Rust backend
- Starts the frontend dev server
- Opens the native desktop application
- Enables hot reload for both frontend and backend changes

### Development Scripts

```bash
# Type checking without emitting files
npm run type-check

# Linting with ESLint
npm run lint
npm run lint:fix

# Code formatting with Prettier
npm run format
npm run format:check

# Run tests
npm test
npm run test:watch
npm run test:coverage

# Version management
npm run sync-version
npm run version:patch
npm run version:minor
npm run version:major

# Internationalization
npm run i18n:validate
npm run i18n:check

# Documentation
npm run docs:start
npm run docs:build
npm run docs:serve
```

## Production Build

### Frontend Build

Build the React frontend for production:

```bash
npm run build
```

This process:

1. Generates build metadata (`scripts/generate-build-info.js`)
2. Runs TypeScript compilation (`tsc`)
3. Builds with Vite for production
4. Optimizes assets and bundles
5. Outputs to `dist/` directory

### Full Application Build

Build the complete Tauri application:

```bash
npm run tauri:build
```

This creates:

- **Optimized frontend bundle**
- **Compiled Rust binary**
- **Platform-specific installer**
- **Code-signed application** (if configured)

### Build Verification

Run the complete build pipeline with all checks:

```bash
npm run build:all
```

This executes:

1. `npm run type-check` - TypeScript validation
2. `npm run lint` - Code quality checks
3. `npm run test` - Test suite
4. `npm run build` - Production build

### Release Preparation

Prepare a complete release build:

```bash
npm run release:prepare
```

This runs:

1. Version synchronization across files
2. Complete build pipeline
3. Tauri application build
4. Asset optimization

## Platform-Specific Builds

### Cross-Platform Build Setup

Install cross-compilation targets:

```bash
npm run cross-platform:install
```

This installs Rust targets for:

- **macOS**: `universal-apple-darwin` (Intel + Apple Silicon)
- **Windows**: `x86_64-pc-windows-msvc`
- **Linux**: `x86_64-unknown-linux-gnu`, `aarch64-unknown-linux-gnu`

### Individual Platform Builds

#### macOS Universal Binary

```bash
npm run build:macos
```

Creates a universal binary supporting both Intel and Apple Silicon Macs.

#### Windows x64

```bash
npm run build:windows
```

Builds for Windows 10/11 x64 systems.

#### Linux x64

```bash
npm run build:linux
```

Creates AppImage and DEB packages for x64 Linux distributions.

#### Linux ARM64

```bash
npm run build:linux-arm64
```

Builds for ARM64 Linux systems (Raspberry Pi, etc.).

### Build All Platforms

Build for all supported platforms:

```bash
npm run build:all-platforms
```

Or use the automated script:

```bash
npm run cross-platform:build
```

## Build Configuration

### Vite Configuration

Key build settings in `vite.config.ts`:

```typescript
export default defineConfig({
  plugins: [react(), tsconfigPaths(), tailwindcss()],
  build: {
    rollupOptions: {
      external: ['node:', 'async_hooks', 'worker_threads'],
    },
  },
  optimizeDeps: {
    include: ['@langchain/core', '@langchain/google-genai'],
    exclude: ['@tauri-apps/api'],
  },
});
```

### Tauri Configuration

Build settings in `src-tauri/tauri.conf.json`:

```json
{
  "build": {
    "beforeBuildCommand": "npm run build",
    "beforeDevCommand": "npm run dev",
    "devPath": "http://localhost:1421",
    "distDir": "../dist"
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "identifier": "com.kirapilot.app",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ]
  }
}
```

### Rust Dependencies

Key dependencies in `src-tauri/Cargo.toml`:

```toml
[dependencies]
tauri = { version = "2", features = ["macos-private-api"] }
tauri-plugin-sql = { version = "2", features = ["sqlite"] }
tauri-plugin-opener = "2"
tauri-plugin-notification = "2"
tauri-plugin-dialog = "2"
sea-orm = { version = "1.1", features = ["sqlx-sqlite", "runtime-tokio-rustls", "macros", "with-chrono", "with-uuid"] }
sea-orm-migration = { version = "1.1" }
candle-core = "0.8"
candle-nn = "0.8"
candle-transformers = "0.8"
```

## Build Optimization

### Bundle Analysis

Analyze bundle size and dependencies:

```bash
# Install bundle analyzer
npm install --save-dev webpack-bundle-analyzer

# Analyze build
npm run build && npx webpack-bundle-analyzer dist/assets/*.js
```

### Performance Optimization

1. **Code Splitting**: Automatic route-based splitting
2. **Tree Shaking**: Remove unused code
3. **Asset Optimization**: Compress images and fonts
4. **Dependency Optimization**: Exclude unnecessary packages

### Build Size Optimization

- **Frontend bundle**: ~2-3MB (gzipped)
- **Rust binary**: ~15-20MB
- **Total installer**: ~25-30MB

## Deployment

### GitHub Releases

Automated deployment via GitHub Actions:

```yaml
# .github/workflows/release.yml
name: Release
on:
  push:
    tags: ['v*']
jobs:
  build:
    strategy:
      matrix:
        platform: [macos-latest, ubuntu-latest, windows-latest]
    runs-on: ${{ matrix.platform }}
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
      - name: Install Rust
        uses: dtolnay/rust-toolchain@stable
      - name: Build application
        run: npm run release:prepare
```

### Code Signing

#### macOS Code Signing

Set environment variables:

```bash
export APPLE_CERTIFICATE="path/to/certificate.p12"
export APPLE_CERTIFICATE_PASSWORD="certificate_password"
export APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name"
```

#### Windows Code Signing

Configure in `tauri.conf.json`:

```json
{
  "bundle": {
    "windows": {
      "certificateThumbprint": "CERTIFICATE_THUMBPRINT",
      "timestampUrl": "http://timestamp.sectigo.com"
    }
  }
}
```

### Distribution

1. **GitHub Releases**: Primary distribution method
2. **Direct Download**: From project website
3. **Package Managers**: Future support for Homebrew, Chocolatey, etc.

## Troubleshooting

### Common Build Issues

#### Node.js Version Conflicts

```bash
# Use Node Version Manager
nvm use 18
npm install
```

#### Rust Compilation Errors

```bash
# Update Rust toolchain
rustup update
cargo clean
```

#### Tauri Build Failures

```bash
# Clear Tauri cache
rm -rf src-tauri/target
npm run tauri:build
```

#### Memory Issues During Build

```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"
npm run build
```

### Platform-Specific Issues

#### macOS: Xcode Command Line Tools

```bash
xcode-select --install
```

#### Windows: Visual Studio Build Tools

Install Microsoft C++ Build Tools or Visual Studio Community.

#### Linux: Missing Dependencies

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install build-essential pkg-config libssl-dev

# Fedora/RHEL
sudo dnf install gcc pkg-config openssl-devel
```

### Build Performance

- **Parallel builds**: Use `npm run build:all-platforms` for concurrent builds
- **Incremental builds**: Leverage Rust's incremental compilation
- **Cache optimization**: Use CI cache for dependencies

This comprehensive build system ensures reliable, optimized builds across all supported platforms while maintaining excellent developer experience.

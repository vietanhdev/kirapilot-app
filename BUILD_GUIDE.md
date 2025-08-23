# KiraPilot Build Guide

This guide explains how to build KiraPilot for different platforms.

## Quick Start

### Prerequisites

- Node.js (LTS version)
- Rust (stable toolchain)
- Platform-specific dependencies (see below)

### Build Commands

```bash
# Install dependencies
npm ci

# Build the app for your current platform
npm run tauri build
```

## Platform-Specific Setup

### Windows

- Install Visual Studio Build Tools with C++ support
- WebView2 Runtime (usually pre-installed on Windows 10/11)
- The build will create NSIS installer (.exe)

### macOS

- Xcode Command Line Tools: `xcode-select --install`
- The build will create .app bundle and .dmg installer

### Linux (Ubuntu/Debian)

```bash
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf build-essential curl wget file libssl-dev
```

## Troubleshooting

### Common Issues

1. **macOS DMG fails in CI**:
   - Set `CI=true` environment variable
   - Use ad-hoc signing: `export APPLE_SIGNING_IDENTITY="-"`

2. **Windows WiX bundler errors**:
   - The config now uses NSIS instead of WiX for better compatibility
   - Ensure WebView2 Runtime is installed

3. **Build cache issues**:
   - Clean build: `rm -rf src-tauri/target dist node_modules/.cache`
   - Reinstall: `npm ci`

### Fix Scripts

For automated troubleshooting:

**Linux/macOS:**

```bash
chmod +x scripts/build-fix.sh
./scripts/build-fix.sh
```

**Windows (PowerShell as Administrator):**

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
.\scripts\build-fix.ps1
```

## Release Process

The app automatically builds and releases when you push to the `release` branch:

1. Update version using one of these commands:
   - `npm run version:patch` (for bug fixes: 0.0.10 → 0.0.11)
   - `npm run version:minor` (for new features: 0.0.10 → 0.1.0)
   - `npm run version:major` (for breaking changes: 0.0.10 → 1.0.0)

   This automatically syncs versions across package.json, Cargo.toml, and tauri.conf.json

2. Commit changes to `release` branch
3. GitHub Actions will build for all platforms and create a draft release

**Note**: The version is now automatically synced across all configuration files and dynamically referenced in the UI.

## Development

For development builds:

```bash
npm run tauri dev
```

This starts the development server with hot-reload enabled.

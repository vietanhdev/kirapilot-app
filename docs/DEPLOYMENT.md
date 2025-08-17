# KiraPilot Deployment Guide

This document covers the deployment and distribution process for KiraPilot, a Tauri-based desktop application.

## Build Requirements

### System Dependencies

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

### Development Tools

- **Node.js** (LTS version recommended)
- **Rust** (latest stable version)
- **Tauri CLI** (automatically installed via npm scripts)

## Local Development Build

### Setup

```bash
# Clone the repository
git clone https://github.com/vietanhdev/kirapilot-app.git
cd kirapilot-app

# Install dependencies
npm ci

# Install Rust dependencies
cd src-tauri
cargo fetch
cd ..
```

### Development Mode

```bash
# Run in development mode with hot reload
npm run tauri:dev
```

### Production Build

```bash
# Build for production (current platform only)
npm run release:prepare
```

## Automated Builds (GitHub Actions)

### Build Pipeline

The project uses GitHub Actions for automated building and testing:

1. **Build and Test Workflow** (`.github/workflows/build.yml`)
   - Triggers on push to `main` or `develop` branches
   - Triggers on pull requests
   - Runs tests, linting, and builds for all platforms
   - Uploads build artifacts

2. **Release Workflow** (`.github/workflows/release.yml`)
   - Triggers on version tags (`v*`)
   - Builds for all platforms
   - Creates GitHub releases with installers

### Platform Support

The automated build system supports:

- **Windows**: `.msi` installer and `.exe` portable
- **macOS**: `.dmg` for Intel (x86_64) and Apple Silicon (aarch64)
- **Linux**: `.AppImage` universal and `.deb` packages

## Manual Release Process

### 1. Version Update

Update version in these files:

- `package.json`
- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml`

### 2. Create Release Tag

```bash
git tag v0.1.0
git push origin v0.1.0
```

### 3. Monitor Build

- Check GitHub Actions for build status
- Download artifacts from the release page

## Code Signing (Optional)

### Windows

To enable Windows code signing, add these secrets to your GitHub repository:

- `TAURI_PRIVATE_KEY`: Your private key for Tauri updater
- `TAURI_KEY_PASSWORD`: Password for the private key

### macOS

For macOS code signing, add these secrets:

- `APPLE_CERTIFICATE`: Base64 encoded certificate
- `APPLE_CERTIFICATE_PASSWORD`: Certificate password
- `APPLE_SIGNING_IDENTITY`: Developer ID Application certificate name
- `APPLE_ID`: Apple ID for notarization
- `APPLE_PASSWORD`: App-specific password
- `APPLE_TEAM_ID`: Apple Developer Team ID

## Distribution Platforms

### GitHub Releases

- Primary distribution method
- Automatic releases via GitHub Actions
- Supports all platforms

### Future Distribution Options

- **Windows**: Microsoft Store
- **macOS**: Mac App Store
- **Linux**: Snap Store, Flatpak

## Security Considerations

### Local Data Storage

- All user data stored locally in SQLite database
- No sensitive data transmitted to external services
- AI requests can be disabled in privacy settings

### Privacy

- Optional AI features with transparent data usage
- Local processing preferred over cloud services
- User controls for data retention and deletion

## Build Optimization

### Bundle Size Reduction

The build is optimized for size:

- Rust release profile with LTO enabled
- Tree-shaking in Vite build
- Compressed assets
- Static linking on Windows

### Performance

- Native platform integration
- Efficient SQLite operations
- Minimal memory footprint
- Fast startup times

## Troubleshooting

### Common Build Issues

#### Linux: Missing Dependencies

```bash
# Install required system packages
sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf
```

#### Windows: Build Tools Not Found

- Ensure Visual Studio 2022 with C++ tools is installed
- Check that Windows SDK is available

#### macOS: Signing Issues

- Verify Xcode Command Line Tools are installed
- Check that certificates are properly configured

### Debug Builds

For debugging build issues:

```bash
npm run tauri:build:debug
```

## Monitoring and Analytics

### Crash Reporting

- Built-in error boundaries in React components
- Rust panic handling in Tauri backend
- Local error logging for debugging

### Performance Monitoring

- Database query performance tracking
- Memory usage monitoring
- Startup time optimization

## Support and Documentation

- **User Guide**: Available in the application Help menu
- **Developer Documentation**: `/docs` directory
- **API Reference**: Generated from TypeScript interfaces
- **Issue Tracking**: GitHub Issues

For deployment questions or issues, please create an issue on the GitHub repository.

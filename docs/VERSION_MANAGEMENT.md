# Version Management

KiraPilot uses a centralized version management system that keeps all configuration files in sync.

## How It Works

The version is defined in `package.json` and automatically synced to:

- `src-tauri/Cargo.toml` (Rust package version)
- `src-tauri/tauri.conf.json` (Tauri app version)
- Translation files (UI display version)

## Updating Versions

Use these npm scripts to update versions:

```bash
# Patch version (bug fixes): 0.0.10 → 0.0.11
npm run version:patch

# Minor version (new features): 0.0.10 → 0.1.0
npm run version:minor

# Major version (breaking changes): 0.0.10 → 1.0.0
npm run version:major
```

These commands will:

1. Update the version in `package.json`
2. Automatically sync to Tauri configuration files
3. Create a git commit and tag

## Manual Sync

If you need to manually sync versions (e.g., after editing package.json directly):

```bash
npm run sync-version
```

## Dynamic Version Display

The UI dynamically displays the current version from `package.json` using the utility in `src/utils/version.ts`:

```typescript
import { getFormattedVersion, APP_VERSION } from '../utils/version';

// Get formatted version string: "Version 0.0.10"
const displayVersion = getFormattedVersion();

// Get raw version: "0.0.10"
const rawVersion = APP_VERSION;
```

## Translation Files

Version strings in translation files are automatically generated from the package version:

```typescript
'settings.version': (() => {
  try {
    const { getFormattedVersion } = require('../../utils/version');
    return getFormattedVersion();
  } catch {
    return 'Version 0.0.10'; // Fallback
  }
})(),
```

This ensures the UI always shows the correct version without manual updates.

## Release Process

The release process automatically uses the synced version:

1. Update version using `npm run version:*`
2. Run `npm run release:prepare` (includes version sync)
3. Commit and push to trigger CI/CD

All build artifacts will use the same version number across platforms.

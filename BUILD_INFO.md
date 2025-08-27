# Build Information System

KiraPilot uses an automated build information system that generates metadata about each build, including version, git information, and build environment details.

## Overview

The build info system consists of:

- **`scripts/generate-build-info.js`** - Generates build metadata
- **`src/build-info.json`** - Generated build metadata (git-ignored)
- **`src/utils/version.ts`** - Utilities to access build info
- **`src/components/common/BuildInfo.tsx`** - UI component to display build info

## Generated Information

The system automatically captures:

- **Version**: From package.json
- **Build Date**: ISO timestamp of when build was generated
- **Git Information**: Hash, branch, tag, and dirty status
- **Environment**: NODE_ENV value
- **System Info**: Platform, architecture, Node.js version

## Usage

### Command Line

```bash
# Generate build info manually
npm run sync-version

# Show current build info
npm run build-info

# Version bump (automatically generates build info)
npm run version:patch
npm run version:minor
npm run version:major
```

### In Code

```typescript
import {
  getBuildInfo,
  getDetailedVersion,
  getBuildDate,
} from '../utils/version';

// Get complete build info object
const buildInfo = getBuildInfo();

// Get formatted version string
const version = getDetailedVersion(); // "Version 0.0.22 - 6ff67a9"

// Get formatted build date
const buildDate = getBuildDate(); // "8/27/2025, 10:00:28 AM"
```

### In Components

```tsx
import { BuildInfo } from '../components/common';

// Compact version display
<BuildInfo variant="compact" />

// Detailed build information
<BuildInfo variant="detailed" />
```

## Automatic Generation

Build info is automatically generated during:

- **Version sync**: `npm run sync-version`
- **Frontend build**: `npm run build`
- **Tauri build**: `npm run tauri:build`
- **Version bumps**: `npm run version:patch|minor|major`

## File Structure

```
scripts/
├── generate-build-info.js    # Build info generator
├── show-build-info.js        # CLI display utility
└── sync-version.js           # Version sync (includes build info)

src/
├── build-info.json           # Generated metadata (git-ignored)
├── build-info.d.ts          # TypeScript declarations
├── utils/version.ts          # Build info utilities
└── components/common/
    └── BuildInfo.tsx         # UI component
```

## Integration

The build info is displayed in:

- **Settings > About**: Compact version chip and detailed build information
- **CLI**: `npm run build-info` command
- **Available for**: Any component that needs version/build metadata

## Development vs Production

- **Development**: Shows "modified" status for uncommitted changes
- **Production**: Clean builds show exact git state
- **Environment**: Automatically detected from NODE_ENV

#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the current version from package.json
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const version = packageJson.version;

const versionType = process.argv[2] || 'patch';

try {
  console.log(`Creating commit and tag for version ${version}...`);

  // Add all changes
  execSync('git add .', { stdio: 'inherit' });

  // Create commit with version message
  const commitMessage = `chore: bump version to ${version}`;
  execSync(`git commit -m "${commitMessage}"`, { stdio: 'inherit' });

  // Create git tag
  const tagName = `v${version}`;
  execSync(`git tag "${tagName}"`, { stdio: 'inherit' });

  console.log(`✅ Successfully created commit and tag ${tagName}`);
  console.log(`📝 Commit message: ${commitMessage}`);
} catch (error) {
  console.error('❌ Error creating commit and tag:', error.message);
  process.exit(1);
}

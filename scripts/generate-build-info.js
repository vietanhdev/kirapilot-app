#!/usr/bin/env node

/**
 * Script to generate build information JSON file
 * This includes version, build date, git hash, and other build metadata
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read package.json version
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// Get git information
let gitHash = 'unknown';
let gitBranch = 'unknown';
let gitTag = null;
let isDirty = false;

try {
  gitHash = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  gitBranch = execSync('git rev-parse --abbrev-ref HEAD', {
    encoding: 'utf8',
  }).trim();

  // Check if there's a tag for this commit
  try {
    gitTag = execSync('git describe --exact-match --tags HEAD', {
      encoding: 'utf8',
    }).trim();
  } catch {
    // No tag for this commit
  }

  // Check if working directory is dirty
  const status = execSync('git status --porcelain', {
    encoding: 'utf8',
  }).trim();
  isDirty = status.length > 0;
} catch (error) {
  console.warn('Warning: Could not get git information:', error.message);
}

// Generate build info
const buildInfo = {
  version: packageJson.version,
  buildDate: new Date().toISOString(),
  buildTimestamp: Date.now(),
  git: {
    hash: gitHash,
    shortHash: gitHash.substring(0, 7),
    branch: gitBranch,
    tag: gitTag,
    isDirty,
  },
  environment: process.env.NODE_ENV || 'development',
  nodeVersion: process.version,
  platform: process.platform,
  arch: process.arch,
};

// Write build info to JSON file
const buildInfoPath = path.join(__dirname, '..', 'src', 'build-info.json');
fs.writeFileSync(buildInfoPath, JSON.stringify(buildInfo, null, 2));

console.log('✓ Generated build-info.json');
console.log(`  Version: ${buildInfo.version}`);
console.log(`  Build Date: ${buildInfo.buildDate}`);
console.log(`  Git Hash: ${buildInfo.git.shortHash}`);
console.log(`  Git Branch: ${buildInfo.git.branch}`);
if (buildInfo.git.tag) {
  console.log(`  Git Tag: ${buildInfo.git.tag}`);
}
if (buildInfo.git.isDirty) {
  console.log('  ⚠ Working directory has uncommitted changes');
}

#!/usr/bin/env node

/**
 * Script to sync version between package.json, Cargo.toml, and tauri.conf.json
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
const version = packageJson.version;

console.log(`Syncing version: ${version}`);

// Update package-lock.json by running npm install
const projectRoot = path.join(__dirname, '..');
try {
  execSync('npm install', { cwd: projectRoot, stdio: 'inherit' });
  console.log('✓ Updated package-lock.json');
} catch (error) {
  console.warn(
    '⚠ Warning: Could not update package-lock.json:',
    error.message
  );
}

// Update Cargo.toml
const cargoTomlPath = path.join(__dirname, '..', 'src-tauri', 'Cargo.toml');
let cargoContent = fs.readFileSync(cargoTomlPath, 'utf8');
cargoContent = cargoContent.replace(
  /^version = ".*"$/m,
  `version = "${version}"`
);
fs.writeFileSync(cargoTomlPath, cargoContent);
console.log('✓ Updated Cargo.toml');

// Update Cargo.lock by running cargo update in src-tauri directory
const srcTauriPath = path.join(__dirname, '..', 'src-tauri');
try {
  execSync('cargo update --workspace', { cwd: srcTauriPath, stdio: 'inherit' });
  console.log('✓ Updated Cargo.lock');
} catch (error) {
  console.warn('⚠ Warning: Could not update Cargo.lock:', error.message);
}

// Update tauri.conf.json
const tauriConfPath = path.join(
  __dirname,
  '..',
  'src-tauri',
  'tauri.conf.json'
);
const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));
tauriConf.version = version;
fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2));
console.log('✓ Updated tauri.conf.json');

console.log(`All version files synced to ${version}:`);
console.log('  - package.json');
console.log('  - package-lock.json');
console.log('  - Cargo.toml');
console.log('  - Cargo.lock');
console.log('  - tauri.conf.json');

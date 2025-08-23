#!/usr/bin/env node

/**
 * Script to sync version between package.json, Cargo.toml, and tauri.conf.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read package.json version
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const version = packageJson.version;

console.log(`Syncing version: ${version}`);

// Update Cargo.toml
const cargoTomlPath = path.join(__dirname, '..', 'src-tauri', 'Cargo.toml');
let cargoContent = fs.readFileSync(cargoTomlPath, 'utf8');
cargoContent = cargoContent.replace(
  /^version = ".*"$/m,
  `version = "${version}"`
);
fs.writeFileSync(cargoTomlPath, cargoContent);
console.log('✓ Updated Cargo.toml');

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

console.log(`All version files synced to ${version}`);

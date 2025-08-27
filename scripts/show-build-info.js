#!/usr/bin/env node

/**
 * Script to display current build information
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const buildInfoPath = path.join(__dirname, '..', 'src', 'build-info.json');

if (!fs.existsSync(buildInfoPath)) {
  console.log(
    '❌ Build info not found. Run "npm run sync-version" or "node scripts/generate-build-info.js" first.'
  );
  process.exit(1);
}

const buildInfo = JSON.parse(fs.readFileSync(buildInfoPath, 'utf8'));

console.log('📦 KiraPilot Build Information');
console.log('═'.repeat(40));
console.log(`Version:      ${buildInfo.version}`);
console.log(`Build Date:   ${new Date(buildInfo.buildDate).toLocaleString()}`);
console.log(`Environment:  ${buildInfo.environment}`);
console.log('');
console.log('🔧 Git Information');
console.log('─'.repeat(20));
console.log(`Branch:       ${buildInfo.git.branch}`);
console.log(`Hash:         ${buildInfo.git.hash}`);
console.log(`Short Hash:   ${buildInfo.git.shortHash}`);
if (buildInfo.git.tag) {
  console.log(`Tag:          ${buildInfo.git.tag}`);
}
console.log(`Dirty:        ${buildInfo.git.isDirty ? '⚠ Yes' : '✓ No'}`);
console.log('');
console.log('💻 System Information');
console.log('─'.repeat(22));
console.log(`Platform:     ${buildInfo.platform}`);
console.log(`Architecture: ${buildInfo.arch}`);
console.log(`Node Version: ${buildInfo.nodeVersion}`);

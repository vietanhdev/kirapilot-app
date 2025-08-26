#!/usr/bin/env node

import { execSync } from 'child_process';

/**
 * Cross-platform build script for KiraPilot
 * This script helps set up and build the application for multiple operating systems
 */

const RUST_TARGETS = {
  'macos-x64': 'x86_64-apple-darwin',
  'macos-arm64': 'aarch64-apple-darwin',
  'macos-universal': 'universal-apple-darwin',
  'windows-x64': 'x86_64-pc-windows-msvc',
  'windows-arm64': 'aarch64-pc-windows-msvc',
  'linux-x64': 'x86_64-unknown-linux-gnu',
  'linux-arm64': 'aarch64-unknown-linux-gnu',
};

function executeCommand(command, options = {}) {
  console.log(`🚀 Executing: ${command}`);
  try {
    const result = execSync(command, {
      stdio: 'inherit',
      ...options,
    });
    return result;
  } catch (error) {
    console.error(`❌ Command failed: ${command}`);
    console.error(error.message);
    process.exit(1);
  }
}

function installRustTargets() {
  console.log('📦 Installing Rust compilation targets...');

  Object.values(RUST_TARGETS).forEach(target => {
    try {
      executeCommand(`rustup target add ${target}`);
      console.log(`✅ Installed target: ${target}`);
    } catch (error) {
      console.warn(`⚠️  Failed to install target ${target}: ${error.message}`);
    }
  });
}

function buildForTarget(targetName) {
  const rustTarget = RUST_TARGETS[targetName];
  if (!rustTarget) {
    console.error(`❌ Unknown target: ${targetName}`);
    console.log('Available targets:', Object.keys(RUST_TARGETS).join(', '));
    process.exit(1);
  }

  console.log(`🔨 Building for ${targetName} (${rustTarget})...`);

  // Set CMAKE_OSX_DEPLOYMENT_TARGET for macOS builds
  const env = { ...process.env };
  if (targetName.startsWith('macos')) {
    env.CMAKE_OSX_DEPLOYMENT_TARGET = '10.15';
  }

  const command = `tauri build --target ${rustTarget}`;
  executeCommand(command, { env });

  console.log(`✅ Build completed for ${targetName}`);
}

function buildAll() {
  console.log('🌍 Building for all supported platforms...');

  // First, ensure frontend is built
  executeCommand('npm run build');

  // Then build for each platform
  const targets = ['macos-universal', 'windows-x64', 'linux-x64'];

  targets.forEach(target => {
    try {
      buildForTarget(target);
    } catch (error) {
      console.warn(`⚠️  Failed to build for ${target}: ${error.message}`);
    }
  });

  console.log('🎉 Cross-platform build completed!');
}

function showHelp() {
  console.log(`
🚀 KiraPilot Cross-Platform Build Script

Usage: node scripts/build-cross-platform.js [command] [target]

Commands:
  install-targets    Install all Rust compilation targets
  build [target]     Build for specific target
  build-all         Build for all supported platforms
  help              Show this help message

Available targets:
${Object.keys(RUST_TARGETS)
  .map(target => `  ${target.padEnd(20)} ${RUST_TARGETS[target]}`)
  .join('\n')}

Examples:
  node scripts/build-cross-platform.js install-targets
  node scripts/build-cross-platform.js build macos-universal
  node scripts/build-cross-platform.js build-all

Environment Variables:
  CMAKE_OSX_DEPLOYMENT_TARGET=10.15 (automatically set for macOS builds)
`);
}

// Main execution
const command = process.argv[2];
const target = process.argv[3];

switch (command) {
  case 'install-targets':
    installRustTargets();
    break;

  case 'build':
    if (!target) {
      console.error('❌ Please specify a target to build for');
      showHelp();
      process.exit(1);
    }
    buildForTarget(target);
    break;

  case 'build-all':
    buildAll();
    break;

  case 'help':
  case '--help':
  case '-h':
  default:
    showHelp();
    break;
}

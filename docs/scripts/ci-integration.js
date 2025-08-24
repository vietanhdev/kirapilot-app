#!/usr/bin/env node

/**
 * CI/CD Integration Script for API Documentation
 *
 * This script is designed to run in continuous integration environments
 * to ensure documentation stays up-to-date with code changes.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const CONFIG = {
  checkForChanges: process.env.CI_CHECK_CHANGES === 'true',
  failOnValidationErrors: process.env.CI_FAIL_ON_VALIDATION === 'true',
  generateOnChanges: process.env.CI_GENERATE_ON_CHANGES !== 'false',
};

/**
 * Main CI integration function
 */
async function runCIIntegration() {
  console.log('🔄 Running API documentation CI integration...');

  try {
    // Step 1: Check if source files have changed
    if (CONFIG.checkForChanges) {
      const hasChanges = await checkForSourceChanges();
      if (!hasChanges && !CONFIG.generateOnChanges) {
        console.log(
          '✅ No source changes detected, skipping documentation generation'
        );
        return;
      }
    }

    // Step 2: Generate API documentation
    console.log('📝 Generating API documentation...');
    const { main } = require('./generate-api-docs');
    await main();

    // Step 3: Run validation
    console.log('✅ Running code example validation...');
    const { validateCodeExamples } = require('./generators/code-validator');
    const validationResults = await validateCodeExamples({
      sourceDir: path.resolve(__dirname, '../../src'),
      tauriDir: path.resolve(__dirname, '../../src-tauri'),
      outputDir: path.resolve(__dirname, '../docs/api'),
      tempDir: path.resolve(__dirname, '../temp'),
    });

    // Step 4: Check validation results
    if (CONFIG.failOnValidationErrors && validationResults.errors.length > 0) {
      console.error(
        `❌ Validation failed with ${validationResults.errors.length} errors`
      );
      validationResults.errors.forEach(error => {
        console.error(`  - ${error.file}:${error.line} - ${error.error}`);
      });
      process.exit(1);
    }

    // Step 5: Check if documentation files were modified
    if (CONFIG.checkForChanges) {
      const docChanges = await checkForDocumentationChanges();
      if (docChanges.length > 0) {
        console.log('📄 Documentation files were updated:');
        docChanges.forEach(file => console.log(`  - ${file}`));

        // In CI, you might want to commit these changes or create a PR
        if (process.env.CI_AUTO_COMMIT === 'true') {
          await commitDocumentationChanges(docChanges);
        }
      }
    }

    console.log('✨ CI integration completed successfully!');
  } catch (error) {
    console.error('❌ CI integration failed:', error);
    process.exit(1);
  }
}

/**
 * Check if source files have changed since last documentation generation
 */
async function checkForSourceChanges() {
  try {
    // Get the timestamp of the last generated documentation
    const apiDir = path.resolve(__dirname, '../docs/api');
    const typescriptInterfacesFile = path.join(
      apiDir,
      'typescript-interfaces.md'
    );

    if (!fs.existsSync(typescriptInterfacesFile)) {
      console.log('📝 No existing documentation found, will generate');
      return true;
    }

    const docStats = fs.statSync(typescriptInterfacesFile);
    const docTimestamp = docStats.mtime;

    // Check if source files are newer than documentation
    const sourceFiles = [
      path.resolve(__dirname, '../../src/types/index.ts'),
      path.resolve(__dirname, '../../src-tauri/src/lib.rs'),
      path.resolve(__dirname, '../../src-tauri/src/database/entities'),
    ];

    for (const sourceFile of sourceFiles) {
      if (fs.existsSync(sourceFile)) {
        const sourceStats = fs.statSync(sourceFile);
        if (sourceStats.mtime > docTimestamp) {
          console.log(
            `📝 Source file ${sourceFile} is newer than documentation`
          );
          return true;
        }
      }
    }

    console.log('📄 Documentation is up-to-date with source files');
    return false;
  } catch (error) {
    console.warn('⚠️ Could not check for source changes:', error.message);
    return true; // Generate documentation if we can't check
  }
}

/**
 * Check for changes in generated documentation files
 */
async function checkForDocumentationChanges() {
  try {
    // Use git to check for changes in the API documentation directory
    const apiDir = path.resolve(__dirname, '../docs/api');
    const gitStatus = execSync('git status --porcelain docs/docs/api/', {
      encoding: 'utf8',
      cwd: path.resolve(__dirname, '../..'),
    });

    const changedFiles = gitStatus
      .split('\n')
      .filter(line => line.trim())
      .map(line => line.substring(3)); // Remove git status prefix

    return changedFiles;
  } catch (error) {
    console.warn(
      '⚠️ Could not check for documentation changes:',
      error.message
    );
    return [];
  }
}

/**
 * Commit documentation changes (for automated CI workflows)
 */
async function commitDocumentationChanges(changedFiles) {
  try {
    console.log('📝 Committing documentation changes...');

    // Add changed files
    execSync('git add docs/docs/api/', {
      cwd: path.resolve(__dirname, '../..'),
    });

    // Create commit
    const commitMessage = `docs: update API documentation\n\nAuto-generated documentation updates:\n${changedFiles.map(f => `- ${f}`).join('\n')}`;

    execSync(`git commit -m "${commitMessage}"`, {
      cwd: path.resolve(__dirname, '../..'),
    });

    console.log('✅ Documentation changes committed');
  } catch (error) {
    console.warn('⚠️ Could not commit documentation changes:', error.message);
  }
}

/**
 * Generate GitHub Actions workflow for documentation updates
 */
function generateGitHubWorkflow() {
  const workflow = `name: Update API Documentation

on:
  push:
    branches: [ main, develop ]
    paths:
      - 'src/types/**'
      - 'src-tauri/src/**'
      - 'docs/scripts/**'
  pull_request:
    branches: [ main ]
    paths:
      - 'src/types/**'
      - 'src-tauri/src/**'

jobs:
  update-docs:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
      with:
        token: \${{ secrets.GITHUB_TOKEN }}
        
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'
        cache-dependency-path: docs/package-lock.json
        
    - name: Install dependencies
      run: |
        cd docs
        npm ci
        
    - name: Generate API documentation
      run: |
        cd docs
        npm run docs:api
      env:
        CI_CHECK_CHANGES: 'true'
        CI_FAIL_ON_VALIDATION: 'true'
        CI_GENERATE_ON_CHANGES: 'true'
        
    - name: Check for documentation changes
      id: changes
      run: |
        if [[ -n "\$(git status --porcelain docs/docs/api/)" ]]; then
          echo "changes=true" >> $GITHUB_OUTPUT
        else
          echo "changes=false" >> $GITHUB_OUTPUT
        fi
        
    - name: Commit documentation updates
      if: steps.changes.outputs.changes == 'true' && github.event_name == 'push'
      run: |
        git config --local user.email "action@github.com"
        git config --local user.name "GitHub Action"
        git add docs/docs/api/
        git commit -m "docs: update API documentation [skip ci]"
        git push
        
    - name: Comment on PR
      if: steps.changes.outputs.changes == 'true' && github.event_name == 'pull_request'
      uses: actions/github-script@v7
      with:
        script: |
          github.rest.issues.createComment({
            issue_number: context.issue.number,
            owner: context.repo.owner,
            repo: context.repo.repo,
            body: '📝 This PR includes changes that will update the API documentation. The documentation will be automatically updated when this PR is merged.'
          })
`;

  const workflowPath = path.resolve(
    __dirname,
    '../../.github/workflows/update-api-docs.yml'
  );
  const workflowDir = path.dirname(workflowPath);

  if (!fs.existsSync(workflowDir)) {
    fs.mkdirSync(workflowDir, { recursive: true });
  }

  fs.writeFileSync(workflowPath, workflow);
  console.log(`✅ Generated GitHub Actions workflow: ${workflowPath}`);
}

// Run if called directly
if (require.main === module) {
  const command = process.argv[2];

  if (command === 'generate-workflow') {
    generateGitHubWorkflow();
  } else {
    runCIIntegration();
  }
}

module.exports = {
  runCIIntegration,
  checkForSourceChanges,
  generateGitHubWorkflow,
};

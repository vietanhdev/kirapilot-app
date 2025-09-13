#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function fixDuplicateKeys(filePath) {
  console.log(`Processing ${filePath}...`);

  const content = fs.readFileSync(filePath, 'utf8');

  // Parse the file to extract all key-value pairs
  const keyValuePairs = new Map();
  const lines = content.split('\n');

  // Track which lines to keep
  const linesToKeep = [];
  let inExportBlock = false;
  let skipNextLines = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip lines if we're in a multi-line value
    if (skipNextLines > 0) {
      skipNextLines--;
      continue;
    }

    // Check if we're starting the export block
    if (line.includes('export const')) {
      inExportBlock = true;
      linesToKeep.push(line);
      continue;
    }

    // If we're in the export block, check for key-value pairs
    if (inExportBlock) {
      // Match single-line key-value pairs
      const singleLineMatch = line.match(/^\s*'([^']+)':\s*(.+),?\s*$/);
      // Match multi-line key-value pairs (key on one line, value starts on next)
      const multiLineMatch = line.match(/^\s*'([^']+)':\s*$/);

      if (singleLineMatch) {
        const key = singleLineMatch[1];
        const value = singleLineMatch[2];

        if (keyValuePairs.has(key)) {
          console.log(`  Skipping duplicate key: ${key}`);
          continue; // Skip this duplicate
        }

        keyValuePairs.set(key, value);
        linesToKeep.push(line);
      } else if (multiLineMatch) {
        const key = multiLineMatch[1];

        if (keyValuePairs.has(key)) {
          console.log(`  Skipping duplicate key: ${key}`);
          // Skip this line and the next few lines until we find the end of the value
          let j = i + 1;
          while (
            j < lines.length &&
            !lines[j].includes(',') &&
            !lines[j].includes('}')
          ) {
            j++;
          }
          skipNextLines = j - i;
          continue;
        }

        keyValuePairs.set(key, 'multiline');
        linesToKeep.push(line);
      } else {
        // Keep non-key-value lines (comments, closing braces, etc.)
        linesToKeep.push(line);

        // Check if we're ending the export block
        if (line.includes('};')) {
          inExportBlock = false;
        }
      }
    } else {
      linesToKeep.push(line);
    }
  }

  const newContent = linesToKeep.join('\n');
  fs.writeFileSync(filePath, newContent, 'utf8');
  console.log(`  Fixed ${filePath} - kept ${keyValuePairs.size} unique keys`);
}

// Fix all locale files that have issues
const localeFiles = ['fr.ts', 'vi.ts', 'es.ts', 'de.ts'];

localeFiles.forEach(file => {
  const filePath = path.join(__dirname, '../src/i18n/locales', file);
  if (fs.existsSync(filePath)) {
    fixDuplicateKeys(filePath);
  }
});

console.log('Done fixing duplicate keys!');

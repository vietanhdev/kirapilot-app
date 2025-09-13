#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function removeDuplicateKeys(filePath) {
  console.log(`Processing ${filePath}...`);

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  const seenKeys = new Set();
  const filteredLines = [];
  let inObjectLiteral = false;
  let braceCount = 0;
  let duplicateCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Track if we're inside the object literal
    if (line.includes('export const')) {
      inObjectLiteral = true;
      filteredLines.push(line);
      continue;
    }

    if (inObjectLiteral) {
      // Count braces to know when we exit the object
      const openBraces = (line.match(/{/g) || []).length;
      const closeBraces = (line.match(/}/g) || []).length;
      braceCount += openBraces - closeBraces;

      if (braceCount <= 0 && line.includes('}')) {
        // End of object literal
        filteredLines.push(line);
        inObjectLiteral = false;
        continue;
      }

      // Check if this line contains a key-value pair
      const keyMatch = line.match(/^\s*'([^']+)':/);
      if (keyMatch) {
        const key = keyMatch[1];
        if (seenKeys.has(key)) {
          console.log(`  Removing duplicate key: ${key} (line ${i + 1})`);
          duplicateCount++;
          continue; // Skip this duplicate line
        }
        seenKeys.add(key);
      }
    }

    filteredLines.push(line);
  }

  const newContent = filteredLines.join('\n');
  fs.writeFileSync(filePath, newContent, 'utf8');
  console.log(`  Fixed ${filePath} - removed ${duplicateCount} duplicates`);
}

// Fix all locale files
const localeFiles = ['fr.ts', 'vi.ts', 'es.ts', 'de.ts'];

localeFiles.forEach(file => {
  const filePath = path.join(__dirname, '../src/i18n/locales', file);
  if (fs.existsSync(filePath)) {
    removeDuplicateKeys(filePath);
  }
});

console.log('Done fixing duplicate keys!');

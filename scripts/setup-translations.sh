#!/bin/bash

# KiraPilot Translation Setup Script
# This script helps set up the translation environment

echo "🌐 KiraPilot Translation Setup"
echo "=============================="

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

echo "✅ Node.js found: $(node --version)"

# Check if npm packages are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing npm packages..."
    npm install
fi

# Make scripts executable
chmod +x scripts/auto-fix-translations.js
chmod +x scripts/translation-utils.js
chmod +x scripts/i18n-manager.js

echo "✅ Scripts are now executable"

# Check current translation status
echo ""
echo "📊 Current Translation Status:"
node scripts/translation-utils.js report

echo ""
echo "🚀 Setup Complete!"
echo ""
echo "Available commands:"
echo "  npm run translations:fix    - Auto-fix all translations"
echo "  npm run translations:check  - Check translation status"
echo "  npm run translations:report - Generate detailed report"
echo ""
echo "Manual commands:"
echo "  node scripts/auto-fix-translations.js"
echo "  node scripts/translation-utils.js report"
echo "  node scripts/translation-utils.js test-gemini"
echo ""
echo "To enable AI translation:"
echo "  1. Get a Gemini API key from https://makersuite.google.com/app/apikey"
echo "  2. Set environment variable: export GEMINI_API_KEY=your_key_here"
echo "  3. Run: node scripts/auto-fix-translations.js"
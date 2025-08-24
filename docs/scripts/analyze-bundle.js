const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BUILD_DIR = path.join(__dirname, '../build');
const STATIC_DIR = path.join(BUILD_DIR, 'static');

function analyzeBundleSize() {
  console.log('📦 Analyzing bundle size...\n');

  if (!fs.existsSync(BUILD_DIR)) {
    console.error('❌ Build directory not found. Run "npm run build" first.');
    process.exit(1);
  }

  const stats = {
    totalSize: 0,
    jsSize: 0,
    cssSize: 0,
    imageSize: 0,
    otherSize: 0,
    files: {
      js: [],
      css: [],
      images: [],
      other: [],
    },
  };

  function analyzeDirectory(dir, relativePath = '') {
    const files = fs.readdirSync(dir);

    files.forEach(file => {
      const filePath = path.join(dir, file);
      const relativeFilePath = path.join(relativePath, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        analyzeDirectory(filePath, relativeFilePath);
      } else {
        const size = stat.size;
        const ext = path.extname(file).toLowerCase();

        stats.totalSize += size;

        const fileInfo = {
          name: relativeFilePath,
          size: size,
          sizeFormatted: formatBytes(size),
        };

        if (ext === '.js') {
          stats.jsSize += size;
          stats.files.js.push(fileInfo);
        } else if (ext === '.css') {
          stats.cssSize += size;
          stats.files.css.push(fileInfo);
        } else if (
          ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'].includes(ext)
        ) {
          stats.imageSize += size;
          stats.files.images.push(fileInfo);
        } else {
          stats.otherSize += size;
          stats.files.other.push(fileInfo);
        }
      }
    });
  }

  analyzeDirectory(STATIC_DIR);

  // Sort files by size (largest first)
  Object.keys(stats.files).forEach(type => {
    stats.files[type].sort((a, b) => b.size - a.size);
  });

  console.log('📊 Bundle Analysis Results:');
  console.log('═'.repeat(50));
  console.log(`Total Size: ${formatBytes(stats.totalSize)}`);
  console.log(
    `JavaScript: ${formatBytes(stats.jsSize)} (${((stats.jsSize / stats.totalSize) * 100).toFixed(1)}%)`
  );
  console.log(
    `CSS: ${formatBytes(stats.cssSize)} (${((stats.cssSize / stats.totalSize) * 100).toFixed(1)}%)`
  );
  console.log(
    `Images: ${formatBytes(stats.imageSize)} (${((stats.imageSize / stats.totalSize) * 100).toFixed(1)}%)`
  );
  console.log(
    `Other: ${formatBytes(stats.otherSize)} (${((stats.otherSize / stats.totalSize) * 100).toFixed(1)}%)`
  );
  console.log('');

  // Show largest files
  console.log('🔍 Largest Files:');
  console.log('─'.repeat(50));

  const allFiles = [
    ...stats.files.js,
    ...stats.files.css,
    ...stats.files.images,
    ...stats.files.other,
  ]
    .sort((a, b) => b.size - a.size)
    .slice(0, 10);

  allFiles.forEach((file, index) => {
    console.log(`${index + 1}. ${file.name} - ${file.sizeFormatted}`);
  });

  // Performance recommendations
  console.log('\n💡 Performance Recommendations:');
  console.log('─'.repeat(50));

  if (stats.jsSize > 1024 * 1024) {
    // > 1MB
    console.log(
      '⚠️  JavaScript bundle is large (>1MB). Consider code splitting.'
    );
  }

  if (stats.imageSize > 2 * 1024 * 1024) {
    // > 2MB
    console.log(
      '⚠️  Images are large (>2MB). Consider optimization and WebP format.'
    );
  }

  const largeJsFiles = stats.files.js.filter(f => f.size > 500 * 1024);
  if (largeJsFiles.length > 0) {
    console.log(
      `⚠️  Found ${largeJsFiles.length} large JavaScript files (>500KB).`
    );
  }

  if (stats.totalSize < 5 * 1024 * 1024) {
    console.log('✅ Total bundle size is reasonable (<5MB).');
  }

  // Save analysis to file
  const analysisPath = path.join(__dirname, '../temp/bundle-analysis.json');
  fs.mkdirSync(path.dirname(analysisPath), { recursive: true });
  fs.writeFileSync(analysisPath, JSON.stringify(stats, null, 2));

  console.log(`\n📄 Detailed analysis saved to: ${analysisPath}`);
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function checkBundleHealth() {
  console.log('🏥 Checking bundle health...\n');

  try {
    // Check for duplicate dependencies
    const packageLock = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../package-lock.json'), 'utf8')
    );
    const dependencies = Object.keys(packageLock.dependencies || {});

    console.log(`📦 Total dependencies: ${dependencies.length}`);

    // Check for common performance issues
    const heavyDeps = ['moment', 'lodash', 'jquery', 'bootstrap'];

    const foundHeavyDeps = dependencies.filter(dep =>
      heavyDeps.some(heavy => dep.includes(heavy))
    );

    if (foundHeavyDeps.length > 0) {
      console.log('⚠️  Heavy dependencies found:', foundHeavyDeps);
      console.log('   Consider lighter alternatives.');
    } else {
      console.log('✅ No heavy dependencies detected.');
    }
  } catch (error) {
    console.error('❌ Error checking dependencies:', error.message);
  }
}

if (require.main === module) {
  analyzeBundleSize();
  checkBundleHealth();
}

module.exports = { analyzeBundleSize, checkBundleHealth };

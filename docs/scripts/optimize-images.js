const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const INPUT_DIR = path.join(__dirname, '../static/img');
const OUTPUT_DIR = path.join(__dirname, '../static/img/optimized');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const OPTIMIZATION_CONFIG = {
  jpeg: {
    quality: 85,
    progressive: true,
    mozjpeg: true,
  },
  png: {
    quality: 90,
    compressionLevel: 9,
    progressive: true,
  },
  webp: {
    quality: 85,
    effort: 6,
  },
};

async function optimizeImage(inputPath, outputPath, format) {
  try {
    const image = sharp(inputPath);
    const metadata = await image.metadata();

    console.log(
      `Optimizing ${path.basename(inputPath)} (${metadata.width}x${metadata.height})`
    );

    let pipeline = image;

    // Generate multiple sizes for responsive images
    const sizes = [
      { suffix: '', width: metadata.width },
      { suffix: '@2x', width: Math.min(metadata.width * 2, 2048) },
      { suffix: '_mobile', width: Math.min(metadata.width, 768) },
      { suffix: '_tablet', width: Math.min(metadata.width, 1024) },
    ];

    for (const size of sizes) {
      const sizedOutputPath = outputPath.replace(
        /(\.[^.]+)$/,
        `${size.suffix}$1`
      );

      let sizedPipeline = sharp(inputPath).resize(size.width, null, {
        withoutEnlargement: true,
        fit: 'inside',
      });

      switch (format) {
        case 'jpeg':
        case 'jpg':
          await sizedPipeline
            .jpeg(OPTIMIZATION_CONFIG.jpeg)
            .toFile(sizedOutputPath);
          break;
        case 'png':
          await sizedPipeline
            .png(OPTIMIZATION_CONFIG.png)
            .toFile(sizedOutputPath);
          break;
        case 'webp':
          await sizedPipeline
            .webp(OPTIMIZATION_CONFIG.webp)
            .toFile(sizedOutputPath.replace(/\.[^.]+$/, '.webp'));
          break;
      }
    }

    // Generate WebP version for modern browsers
    if (format !== 'webp' && format !== 'svg') {
      const webpPath = outputPath.replace(/\.[^.]+$/, '.webp');
      await sharp(inputPath).webp(OPTIMIZATION_CONFIG.webp).toFile(webpPath);
    }

    console.log(`✓ Optimized ${path.basename(inputPath)}`);
  } catch (error) {
    console.error(
      `✗ Failed to optimize ${path.basename(inputPath)}:`,
      error.message
    );
  }
}

async function generatePlaceholders(inputPath, outputPath) {
  try {
    const placeholderPath = outputPath.replace(/(\.[^.]+)$/, '_placeholder$1');

    await sharp(inputPath)
      .resize(20, null, { withoutEnlargement: true })
      .blur(2)
      .jpeg({ quality: 20 })
      .toFile(placeholderPath);

    console.log(`✓ Generated placeholder for ${path.basename(inputPath)}`);
  } catch (error) {
    console.error(
      `✗ Failed to generate placeholder for ${path.basename(inputPath)}:`,
      error.message
    );
  }
}

async function optimizeAllImages() {
  console.log('🖼️  Starting image optimization...\n');

  const files = fs.readdirSync(INPUT_DIR);
  const imageFiles = files.filter(
    file => /\.(jpg|jpeg|png|webp)$/i.test(file) && !file.includes('optimized')
  );

  console.log(`Found ${imageFiles.length} images to optimize\n`);

  for (const file of imageFiles) {
    const inputPath = path.join(INPUT_DIR, file);
    const outputPath = path.join(OUTPUT_DIR, file);
    const extension = path.extname(file).toLowerCase().slice(1);

    await optimizeImage(inputPath, outputPath, extension);
    await generatePlaceholders(inputPath, outputPath);
  }

  // Generate image manifest for the app
  const manifest = {
    images: imageFiles.map(file => ({
      original: `/img/${file}`,
      optimized: `/img/optimized/${file}`,
      webp: `/img/optimized/${file.replace(/\.[^.]+$/, '.webp')}`,
      placeholder: `/img/optimized/${file.replace(/(\.[^.]+)$/, '_placeholder$1')}`,
      sizes: ['', '@2x', '_mobile', '_tablet'],
    })),
    generated: new Date().toISOString(),
  };

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );

  console.log(
    `\n✅ Optimization complete! Generated ${imageFiles.length * 4} optimized images`
  );
  console.log(
    `📄 Image manifest saved to ${path.join(OUTPUT_DIR, 'manifest.json')}`
  );
}

if (require.main === module) {
  optimizeAllImages().catch(console.error);
}

module.exports = { optimizeAllImages, optimizeImage };

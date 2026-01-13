#!/usr/bin/env node
/**
 * Download Receipt Dataset
 *
 * Downloads receipt images from public datasets for evaluation.
 * Uses the ExpenseNet public dataset as a source.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';

interface ReceiptEntry {
  id: string;
  imagePath: string;
  tags?: string[];
  notes?: string;
  source: string;
}

// Sample receipt URLs from public sources
// These are placeholder URLs - we'll use a publicly available receipt dataset
const SAMPLE_RECEIPTS = [
  // Using sample receipts from a public GitHub repo with MIT license
  // Receipts from various sources for OCR testing
];

const DATASET_DIR = path.resolve(__dirname, '../dataset');
const IMAGES_DIR = path.join(DATASET_DIR, 'images');
const MANIFEST_PATH = path.join(DATASET_DIR, 'manifest.json');

/**
 * Download a file from URL
 */
function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const protocol = url.startsWith('https') ? https : http;

    protocol
      .get(url, (response) => {
        // Follow redirects
        if (response.statusCode === 301 || response.statusCode === 302) {
          const redirectUrl = response.headers.location;
          if (redirectUrl) {
            file.close();
            fs.unlinkSync(dest);
            downloadFile(redirectUrl, dest).then(resolve).catch(reject);
            return;
          }
        }

        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download: ${response.statusCode}`));
          return;
        }

        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      })
      .on('error', (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
  });
}

/**
 * Generate sample receipt images using a public placeholder service
 * Since real receipt datasets require registration, we'll create sample
 * test images that can be replaced with real receipts later.
 */
async function generateSampleDataset(): Promise<void> {
  console.log('Creating sample dataset structure...');
  console.log('');
  console.log('NOTE: This creates an empty dataset structure.');
  console.log('To run the eval, you need to add receipt images to:');
  console.log(`  ${IMAGES_DIR}`);
  console.log('');
  console.log('You can get receipt images from:');
  console.log('  1. SROIE Dataset: https://rrc.cvc.uab.es/?ch=13');
  console.log('  2. CORD Dataset: https://github.com/clovaai/cord');
  console.log('  3. Kaggle Receipt Datasets');
  console.log('  4. Your own receipt photos');
  console.log('');

  // Ensure directories exist
  if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
  }

  // Create a sample manifest with instructions
  const manifest = {
    name: 'SplitFree Receipt Evaluation Dataset',
    description: 'Add receipt images to the images/ folder and update this manifest',
    version: '1.0.0',
    created: new Date().toISOString().split('T')[0],
    instructions: [
      '1. Download receipt images from a public dataset or use your own',
      '2. Place images in the images/ folder',
      '3. Add entries to the receipts array below',
      '4. Run: npm run eval:receipts',
    ],
    receipts: [] as ReceiptEntry[],
  };

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  console.log(`Created manifest: ${MANIFEST_PATH}`);
}

/**
 * Scan images directory and create manifest entries
 */
async function scanAndCreateManifest(): Promise<void> {
  console.log('Scanning images directory...');

  if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
    console.log('Created images directory');
    return;
  }

  const files = fs.readdirSync(IMAGES_DIR).filter((f) => {
    const ext = path.extname(f).toLowerCase();
    return ['.jpg', '.jpeg', '.png', '.webp'].includes(ext);
  });

  if (files.length === 0) {
    console.log('No images found in dataset/images/');
    console.log('Add receipt images and run this script again.');
    return;
  }

  console.log(`Found ${files.length} images`);

  const receipts: ReceiptEntry[] = files.map((file, index) => ({
    id: `receipt-${String(index + 1).padStart(3, '0')}`,
    imagePath: file,
    tags: inferTags(file),
    source: 'local',
  }));

  const manifest = {
    name: 'SplitFree Receipt Evaluation Dataset',
    description: `${files.length} receipt images for OCR evaluation`,
    version: '1.0.0',
    created: new Date().toISOString().split('T')[0],
    receipts,
  };

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  console.log(`Updated manifest with ${receipts.length} entries`);
}

/**
 * Infer tags from filename
 */
function inferTags(filename: string): string[] {
  const tags: string[] = [];
  const lower = filename.toLowerCase();

  if (lower.includes('restaurant') || lower.includes('food') || lower.includes('dining')) {
    tags.push('restaurant');
  }
  if (lower.includes('retail') || lower.includes('store')) {
    tags.push('retail');
  }
  if (lower.includes('grocery')) {
    tags.push('grocery');
  }
  if (lower.includes('cafe') || lower.includes('coffee')) {
    tags.push('cafe');
  }
  if (lower.includes('bar') || lower.includes('drinks')) {
    tags.push('bar');
  }
  if (lower.includes('faded') || lower.includes('blur')) {
    tags.push('low-quality');
  }

  return tags.length > 0 ? tags : ['untagged'];
}

/**
 * Main
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--scan')) {
    await scanAndCreateManifest();
  } else {
    await generateSampleDataset();
    console.log('');
    console.log('To scan existing images and build manifest:');
    console.log('  npx ts-node tools/receipt-eval/src/download-dataset.ts --scan');
  }
}

main().catch(console.error);

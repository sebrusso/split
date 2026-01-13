/**
 * Receipt Evaluation Runner
 *
 * Orchestrates the evaluation of receipt images using the OCR service.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  extractReceipt,
  validateOCRResult,
  setOCRMode,
  loadImageAsBase64,
  getMediaType,
  isApiKeyConfigured,
  getApiKeyPrefix,
} from './node-ocr-adapter';
import type {
  DatasetManifest,
  ReceiptEntry,
  EvalResult,
  EvalSummary,
  EvalOptions,
  EvalReport,
  ValidationResult,
} from './types';

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Load the dataset manifest
 */
export function loadManifest(datasetPath: string): DatasetManifest {
  const manifestPath = path.join(datasetPath, 'manifest.json');

  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Manifest not found: ${manifestPath}`);
  }

  const content = fs.readFileSync(manifestPath, 'utf-8');
  return JSON.parse(content) as DatasetManifest;
}

/**
 * Process a single receipt
 */
async function processReceipt(
  entry: ReceiptEntry,
  datasetPath: string,
  verbose: boolean
): Promise<EvalResult> {
  const imagePath = path.join(datasetPath, 'images', entry.imagePath);
  const imageName = path.basename(entry.imagePath);

  const startTime = Date.now();

  try {
    // Load image
    if (!fs.existsSync(imagePath)) {
      throw new Error(`Image not found: ${imagePath}`);
    }

    const imageBase64 = loadImageAsBase64(imagePath);
    const mediaType = getMediaType(imagePath);

    if (verbose) {
      console.log(`  Loading: ${imageName} (${mediaType})`);
    }

    // Run OCR
    const ocrResult = await extractReceipt(imageBase64, mediaType);
    const durationMs = Date.now() - startTime;

    // Validate result
    const validationRaw = validateOCRResult(ocrResult);
    const validation: ValidationResult = {
      isValid: validationRaw.isValid,
      warnings: validationRaw.warnings,
      errors: validationRaw.errors,
    };

    if (verbose) {
      console.log(
        `  Extracted ${ocrResult.items.length} items (confidence: ${(ocrResult.confidence * 100).toFixed(0)}%) in ${durationMs}ms`
      );
      if (validation.warnings.length > 0) {
        console.log(`  Warnings: ${validation.warnings.join(', ')}`);
      }
    }

    return {
      id: entry.id,
      imagePath,
      imageName,
      success: true,
      ocrResult,
      validation,
      durationMs,
      tags: entry.tags,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (verbose) {
      console.log(`  ERROR: ${errorMessage}`);
    }

    return {
      id: entry.id,
      imagePath,
      imageName,
      success: false,
      error: errorMessage,
      durationMs,
      tags: entry.tags,
    };
  }
}

/**
 * Calculate summary statistics from results
 */
function calculateSummary(results: EvalResult[]): EvalSummary {
  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  const totalItems = successful.reduce(
    (sum, r) => sum + (r.ocrResult?.items.length || 0),
    0
  );
  const totalConfidence = successful.reduce(
    (sum, r) => sum + (r.ocrResult?.confidence || 0),
    0
  );
  const totalDuration = results.reduce((sum, r) => sum + r.durationMs, 0);

  const withWarnings = successful.filter(
    (r) => r.validation && r.validation.warnings.length > 0
  ).length;
  const withErrors = successful.filter(
    (r) => r.validation && !r.validation.isValid
  ).length;

  return {
    total: results.length,
    successful: successful.length,
    failed: failed.length,
    successRate:
      results.length > 0 ? (successful.length / results.length) * 100 : 0,
    avgItems: successful.length > 0 ? totalItems / successful.length : 0,
    avgConfidence:
      successful.length > 0 ? totalConfidence / successful.length : 0,
    avgDurationMs: results.length > 0 ? totalDuration / results.length : 0,
    totalDurationMs: totalDuration,
    withWarnings,
    withErrors,
  };
}

/**
 * Run the evaluation
 */
export async function runEval(options: EvalOptions): Promise<EvalReport> {
  console.log('\n=== Receipt Scanning Evaluation ===\n');

  // Check API key
  if (!isApiKeyConfigured()) {
    throw new Error(
      'Gemini API key not configured. Set EXPO_PUBLIC_GEMINI_API_KEY in your .env file.'
    );
  }
  console.log(`API Key: ${getApiKeyPrefix()}`);

  // Set OCR mode
  setOCRMode(options.mode);
  console.log(`OCR Mode: ${options.mode}`);

  // Load manifest
  console.log(`\nLoading dataset from: ${options.datasetPath}`);
  const manifest = loadManifest(options.datasetPath);
  console.log(`Dataset: ${manifest.name}`);
  console.log(`Total receipts in dataset: ${manifest.receipts.length}`);

  // Select receipts to process
  let receipts = manifest.receipts;
  if (options.sample > 0 && options.sample < receipts.length) {
    // Shuffle and take sample
    receipts = [...receipts]
      .sort(() => Math.random() - 0.5)
      .slice(0, options.sample);
    console.log(`Sampling ${options.sample} receipts`);
  }

  console.log(`\nProcessing ${receipts.length} receipts...`);
  if (options.delayMs > 0) {
    console.log(`(${options.delayMs}ms delay between requests)`);
  }
  console.log('');

  // Process each receipt
  const results: EvalResult[] = [];
  for (let i = 0; i < receipts.length; i++) {
    const entry = receipts[i];
    console.log(`[${i + 1}/${receipts.length}] ${entry.id}`);

    const result = await processReceipt(entry, options.datasetPath, options.verbose);
    results.push(result);

    // Delay between requests to avoid rate limiting
    if (options.delayMs > 0 && i < receipts.length - 1) {
      await sleep(options.delayMs);
    }
  }

  // Calculate summary
  const summary = calculateSummary(results);

  console.log('\n=== Summary ===');
  console.log(`Total: ${summary.total}`);
  console.log(`Successful: ${summary.successful} (${summary.successRate.toFixed(1)}%)`);
  console.log(`Failed: ${summary.failed}`);
  console.log(`Avg Items: ${summary.avgItems.toFixed(1)}`);
  console.log(`Avg Confidence: ${(summary.avgConfidence * 100).toFixed(1)}%`);
  console.log(`Avg Duration: ${summary.avgDurationMs.toFixed(0)}ms`);
  console.log(`Total Duration: ${(summary.totalDurationMs / 1000).toFixed(1)}s`);
  if (summary.withWarnings > 0) {
    console.log(`With Warnings: ${summary.withWarnings}`);
  }
  if (summary.withErrors > 0) {
    console.log(`With Errors: ${summary.withErrors}`);
  }

  return {
    generatedAt: new Date().toISOString(),
    datasetName: manifest.name,
    options,
    summary,
    results,
  };
}

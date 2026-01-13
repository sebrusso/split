/**
 * Types for Receipt Evaluation Tool
 */

import type { OCRResult } from './node-ocr-adapter';

/**
 * Dataset manifest structure
 */
export interface DatasetManifest {
  name: string;
  description?: string;
  version?: string;
  created?: string;
  receipts: ReceiptEntry[];
}

/**
 * Individual receipt entry in the manifest
 */
export interface ReceiptEntry {
  id: string;
  imagePath: string; // Relative to dataset/images/
  tags?: string[]; // e.g., ['restaurant', 'retail', 'handwritten']
  notes?: string; // Any notes about this receipt
  source?: string; // Where the receipt came from
}

/**
 * Result of evaluating a single receipt
 */
export interface EvalResult {
  /** Receipt ID from manifest */
  id: string;
  /** Path to the image file */
  imagePath: string;
  /** Filename for display */
  imageName: string;
  /** Whether OCR succeeded */
  success: boolean;
  /** OCR result if successful */
  ocrResult?: OCRResult;
  /** Validation result */
  validation?: ValidationResult;
  /** Error message if failed */
  error?: string;
  /** Processing time in milliseconds */
  durationMs: number;
  /** Tags from manifest */
  tags?: string[];
}

/**
 * Validation result for an OCR result
 */
export interface ValidationResult {
  isValid: boolean;
  warnings: string[];
  errors: string[];
}

/**
 * Summary statistics for the evaluation
 */
export interface EvalSummary {
  /** Total receipts processed */
  total: number;
  /** Number of successful extractions */
  successful: number;
  /** Number of failed extractions */
  failed: number;
  /** Success rate as percentage */
  successRate: number;
  /** Average items detected per receipt */
  avgItems: number;
  /** Average confidence score */
  avgConfidence: number;
  /** Average processing time in ms */
  avgDurationMs: number;
  /** Total processing time in ms */
  totalDurationMs: number;
  /** Receipts with validation warnings */
  withWarnings: number;
  /** Receipts with validation errors */
  withErrors: number;
}

/**
 * CLI options for the eval tool
 */
export interface EvalOptions {
  /** Path to dataset directory */
  datasetPath: string;
  /** Output path for HTML report */
  outputPath: string;
  /** OCR mode to use */
  mode: 'single_pass' | 'two_pass';
  /** Number of receipts to sample (0 = all) */
  sample: number;
  /** Delay between API calls in ms */
  delayMs: number;
  /** Verbose output */
  verbose: boolean;
}

/**
 * Full evaluation report
 */
export interface EvalReport {
  /** Report generation timestamp */
  generatedAt: string;
  /** Dataset name */
  datasetName: string;
  /** Options used for this run */
  options: EvalOptions;
  /** Summary statistics */
  summary: EvalSummary;
  /** Individual results */
  results: EvalResult[];
}

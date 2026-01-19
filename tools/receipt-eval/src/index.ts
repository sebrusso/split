#!/usr/bin/env node
/**
 * Receipt Scanning Evaluation CLI
 *
 * Evaluates receipt scanning accuracy using the same OCR
 * infrastructure as the split it. app.
 *
 * Usage:
 *   npx ts-node tools/receipt-eval/src/index.ts
 *   npx ts-node tools/receipt-eval/src/index.ts --sample 10
 *   npx ts-node tools/receipt-eval/src/index.ts --mode two_pass
 */

import * as path from 'path';
import { runEval } from './runner';
import { saveReport } from './report-generator';
import type { EvalOptions } from './types';

/**
 * Parse command line arguments
 */
function parseArgs(): EvalOptions {
  const args = process.argv.slice(2);
  const options: EvalOptions = {
    datasetPath: path.resolve(__dirname, '../dataset'),
    outputPath: '',
    mode: 'single_pass',
    sample: 0,
    delayMs: 500, // Default delay to avoid rate limiting
    verbose: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--dataset':
      case '-d':
        options.datasetPath = path.resolve(args[++i]);
        break;

      case '--output':
      case '-o':
        options.outputPath = path.resolve(args[++i]);
        break;

      case '--mode':
      case '-m':
        const mode = args[++i];
        if (mode === 'single_pass' || mode === 'two_pass') {
          options.mode = mode;
        } else {
          console.error(`Invalid mode: ${mode}. Use 'single_pass' or 'two_pass'.`);
          process.exit(1);
        }
        break;

      case '--sample':
      case '-s':
        options.sample = parseInt(args[++i], 10);
        if (isNaN(options.sample) || options.sample < 0) {
          console.error('Sample must be a positive number');
          process.exit(1);
        }
        break;

      case '--delay':
        options.delayMs = parseInt(args[++i], 10);
        if (isNaN(options.delayMs) || options.delayMs < 0) {
          console.error('Delay must be a non-negative number');
          process.exit(1);
        }
        break;

      case '--verbose':
      case '-v':
        options.verbose = true;
        break;

      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;

      default:
        console.error(`Unknown option: ${arg}`);
        printHelp();
        process.exit(1);
    }
  }

  // Set default output path if not specified
  if (!options.outputPath) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    options.outputPath = path.resolve(
      __dirname,
      `../reports/report-${timestamp}.html`
    );
  }

  return options;
}

/**
 * Print help message
 */
function printHelp(): void {
  console.log(`
Receipt Scanning Evaluation Tool

USAGE:
  npx ts-node tools/receipt-eval/src/index.ts [OPTIONS]

OPTIONS:
  -d, --dataset <path>   Path to dataset directory (default: ./dataset)
  -o, --output <path>    Output HTML report path (default: ./reports/report-<timestamp>.html)
  -m, --mode <mode>      OCR mode: 'single_pass' or 'two_pass' (default: single_pass)
  -s, --sample <n>       Only process n random receipts (default: all)
      --delay <ms>       Delay between API calls in ms (default: 500)
  -v, --verbose          Show detailed progress
  -h, --help             Show this help message

EXAMPLES:
  # Run eval on all receipts in default dataset
  npx ts-node tools/receipt-eval/src/index.ts

  # Sample 10 receipts for quick testing
  npx ts-node tools/receipt-eval/src/index.ts --sample 10 --verbose

  # Use two-pass OCR mode
  npx ts-node tools/receipt-eval/src/index.ts --mode two_pass

  # Custom dataset and output
  npx ts-node tools/receipt-eval/src/index.ts -d ./my-receipts -o ./results.html
`);
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  try {
    const options = parseArgs();

    // Run evaluation
    const report = await runEval(options);

    // Save report
    console.log(`\nSaving report to: ${options.outputPath}`);
    saveReport(report, options.outputPath);

    console.log('\nDone! Open the HTML report in your browser to view results.');

    // Open report in browser on macOS
    if (process.platform === 'darwin') {
      const { exec } = await import('child_process');
      exec(`open "${options.outputPath}"`);
    }
  } catch (error) {
    console.error('\nError:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();

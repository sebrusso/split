/**
 * HTML Report Generator
 *
 * Generates a self-contained HTML report with side-by-side
 * receipt image and OCR output viewer.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { EvalReport, EvalResult, EvalSummary } from './types';
import type { OCRResult, OCRExtractedItem } from './node-ocr-adapter';
import { getMediaType } from './node-ocr-adapter';

/**
 * Embed an image as a base64 data URL
 */
function embedImage(imagePath: string): string {
  if (!fs.existsSync(imagePath)) {
    return '';
  }
  const buffer = fs.readFileSync(imagePath);
  const base64 = buffer.toString('base64');
  const mimeType = getMediaType(imagePath);
  return `data:${mimeType};base64,${base64}`;
}

/**
 * Format currency amount
 */
function formatCurrency(amount: number | undefined): string {
  if (amount === undefined || amount === null) return '-';
  return `$${amount.toFixed(2)}`;
}

/**
 * Format items table
 */
function formatItemsTable(items: OCRExtractedItem[]): string {
  if (items.length === 0) {
    return '<p class="no-items">No items detected</p>';
  }

  const rows = items
    .map((item, i) => {
      const qtyStr = item.quantity > 1 ? `${item.quantity}` : '1';
      const unitStr = item.unitPrice !== undefined ? formatCurrency(item.unitPrice) : '-';
      const totalStr = formatCurrency(item.totalPrice);
      const flags: string[] = [];
      if (item.isLikelyShared) flags.push('shared');
      if (item.isModifier) flags.push('modifier');
      if (item.isServiceCharge) flags.push('service');
      const flagsStr = flags.length > 0 ? ` <span class="item-flags">(${flags.join(', ')})</span>` : '';

      return `
        <tr>
          <td class="item-num">${i + 1}.</td>
          <td class="item-desc">${escapeHtml(item.description)}${flagsStr}</td>
          <td class="item-qty">${qtyStr}</td>
          <td class="item-unit">${unitStr}</td>
          <td class="item-total">${totalStr}</td>
        </tr>
      `;
    })
    .join('');

  return `
    <table class="items-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Description</th>
          <th>Qty</th>
          <th>Unit</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

/**
 * Format OCR result for display
 */
function formatOCROutput(result: EvalResult): string {
  if (!result.success || !result.ocrResult) {
    return `
      <div class="ocr-error">
        <h4>OCR Failed</h4>
        <p class="error-message">${escapeHtml(result.error || 'Unknown error')}</p>
      </div>
    `;
  }

  const ocr = result.ocrResult;
  const meta = ocr.metadata;

  // Validation status
  let validationHtml = '';
  if (result.validation) {
    if (result.validation.isValid && result.validation.warnings.length === 0) {
      validationHtml = '<div class="validation success">All checks passed</div>';
    } else {
      const items: string[] = [];
      result.validation.errors.forEach((e) => {
        items.push(`<span class="error-item">${escapeHtml(e)}</span>`);
      });
      result.validation.warnings.forEach((w) => {
        items.push(`<span class="warning-item">${escapeHtml(w)}</span>`);
      });
      validationHtml = `<div class="validation warnings">${items.join('<br>')}</div>`;
    }
  }

  // Service charges
  let serviceChargesHtml = '';
  if (meta.serviceCharges && meta.serviceCharges.length > 0) {
    const charges = meta.serviceCharges
      .map((sc) => `${escapeHtml(sc.description)}: ${formatCurrency(sc.amount)}`)
      .join('<br>');
    serviceChargesHtml = `
      <div class="totals-row">
        <span class="totals-label">Service Charges:</span>
        <span class="totals-value">${charges}</span>
      </div>
    `;
  }

  // Discounts
  let discountsHtml = '';
  if (meta.discounts && meta.discounts.length > 0) {
    const discounts = meta.discounts
      .map((d) => `${escapeHtml(d.description)}: ${formatCurrency(d.amount)}`)
      .join('<br>');
    discountsHtml = `
      <div class="totals-row discount">
        <span class="totals-label">Discounts:</span>
        <span class="totals-value">${discounts}</span>
      </div>
    `;
  }

  return `
    <div class="ocr-output">
      <div class="merchant-info">
        <h3 class="merchant-name">${meta.merchantName ? escapeHtml(meta.merchantName) : 'Unknown Merchant'}</h3>
        ${meta.merchantAddress ? `<p class="merchant-address">${escapeHtml(meta.merchantAddress)}</p>` : ''}
        ${meta.date ? `<p class="receipt-date">${escapeHtml(meta.date)}</p>` : ''}
      </div>

      <div class="items-section">
        <h4>Items (${ocr.items.length})</h4>
        ${formatItemsTable(ocr.items)}
      </div>

      <div class="totals-section">
        <div class="totals-row">
          <span class="totals-label">Subtotal:</span>
          <span class="totals-value">${formatCurrency(meta.subtotal)}</span>
        </div>
        ${serviceChargesHtml}
        ${discountsHtml}
        <div class="totals-row">
          <span class="totals-label">Tax:</span>
          <span class="totals-value">${formatCurrency(meta.tax)}</span>
        </div>
        <div class="totals-row">
          <span class="totals-label">Tip:</span>
          <span class="totals-value">${formatCurrency(meta.tip)}</span>
        </div>
        <div class="totals-row total">
          <span class="totals-label">Total:</span>
          <span class="totals-value">${formatCurrency(meta.total)}</span>
        </div>
      </div>

      <div class="meta-section">
        <div class="confidence">
          <span class="confidence-label">Confidence:</span>
          <span class="confidence-value ${getConfidenceClass(ocr.confidence)}">${(ocr.confidence * 100).toFixed(0)}%</span>
        </div>
        <div class="duration">
          <span class="duration-label">Duration:</span>
          <span class="duration-value">${result.durationMs}ms</span>
        </div>
      </div>

      ${validationHtml}
    </div>
  `;
}

/**
 * Get CSS class based on confidence score
 */
function getConfidenceClass(confidence: number): string {
  if (confidence >= 0.8) return 'high';
  if (confidence >= 0.6) return 'medium';
  return 'low';
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Format summary section
 */
function formatSummary(summary: EvalSummary): string {
  return `
    <div class="summary-grid">
      <div class="summary-card">
        <div class="summary-value">${summary.total}</div>
        <div class="summary-label">Total Receipts</div>
      </div>
      <div class="summary-card success">
        <div class="summary-value">${summary.successful}</div>
        <div class="summary-label">Successful</div>
      </div>
      <div class="summary-card ${summary.failed > 0 ? 'error' : ''}">
        <div class="summary-value">${summary.failed}</div>
        <div class="summary-label">Failed</div>
      </div>
      <div class="summary-card">
        <div class="summary-value">${summary.successRate.toFixed(1)}%</div>
        <div class="summary-label">Success Rate</div>
      </div>
      <div class="summary-card">
        <div class="summary-value">${summary.avgItems.toFixed(1)}</div>
        <div class="summary-label">Avg Items</div>
      </div>
      <div class="summary-card">
        <div class="summary-value">${(summary.avgConfidence * 100).toFixed(0)}%</div>
        <div class="summary-label">Avg Confidence</div>
      </div>
      <div class="summary-card">
        <div class="summary-value">${summary.avgDurationMs.toFixed(0)}ms</div>
        <div class="summary-label">Avg Duration</div>
      </div>
      <div class="summary-card">
        <div class="summary-value">${(summary.totalDurationMs / 1000).toFixed(1)}s</div>
        <div class="summary-label">Total Time</div>
      </div>
    </div>
  `;
}

/**
 * Generate a single receipt card
 */
function generateReceiptCard(result: EvalResult): string {
  const imageDataUrl = embedImage(result.imagePath);
  const statusClass = result.success ? 'success' : 'error';
  const tagsHtml =
    result.tags && result.tags.length > 0
      ? `<div class="tags">${result.tags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>`
      : '';

  return `
    <article class="receipt-card ${statusClass}">
      <header class="receipt-header">
        <h3>${escapeHtml(result.id)}</h3>
        <span class="status-badge ${statusClass}">${result.success ? 'Success' : 'Failed'}</span>
      </header>
      ${tagsHtml}
      <div class="receipt-content">
        <div class="image-panel">
          ${imageDataUrl ? `<img src="${imageDataUrl}" alt="Receipt ${result.id}" loading="lazy">` : '<div class="no-image">Image not found</div>'}
        </div>
        <div class="output-panel">
          ${formatOCROutput(result)}
        </div>
      </div>
    </article>
  `;
}

/**
 * CSS styles for the report
 */
const CSS_STYLES = `
  :root {
    --bg-color: #f5f5f5;
    --card-bg: #ffffff;
    --text-color: #1f2937;
    --text-secondary: #6b7280;
    --border-color: #e5e7eb;
    --success-color: #10b981;
    --success-bg: #d1fae5;
    --warning-color: #f59e0b;
    --warning-bg: #fef3c7;
    --error-color: #ef4444;
    --error-bg: #fee2e2;
    --primary-color: #3b82f6;
  }

  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    background-color: var(--bg-color);
    color: var(--text-color);
    line-height: 1.5;
    padding: 24px;
  }

  h1, h2, h3, h4 {
    font-weight: 600;
  }

  header.page-header {
    text-align: center;
    margin-bottom: 32px;
  }

  header.page-header h1 {
    font-size: 28px;
    margin-bottom: 8px;
  }

  header.page-header .meta {
    color: var(--text-secondary);
    font-size: 14px;
  }

  /* Summary Section */
  .summary-section {
    margin-bottom: 32px;
  }

  .summary-section h2 {
    font-size: 20px;
    margin-bottom: 16px;
  }

  .summary-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 16px;
  }

  .summary-card {
    background: var(--card-bg);
    border-radius: 8px;
    padding: 16px;
    text-align: center;
    border: 1px solid var(--border-color);
  }

  .summary-card.success {
    border-color: var(--success-color);
    background: var(--success-bg);
  }

  .summary-card.error {
    border-color: var(--error-color);
    background: var(--error-bg);
  }

  .summary-value {
    font-size: 24px;
    font-weight: 700;
    margin-bottom: 4px;
  }

  .summary-label {
    font-size: 12px;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  /* Receipt Cards */
  .receipts-section h2 {
    font-size: 20px;
    margin-bottom: 16px;
  }

  .receipt-card {
    background: var(--card-bg);
    border-radius: 12px;
    margin-bottom: 24px;
    border: 1px solid var(--border-color);
    overflow: hidden;
  }

  .receipt-card.error {
    border-color: var(--error-color);
  }

  .receipt-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: var(--bg-color);
    border-bottom: 1px solid var(--border-color);
  }

  .receipt-header h3 {
    font-size: 16px;
  }

  .status-badge {
    font-size: 12px;
    padding: 4px 8px;
    border-radius: 4px;
    font-weight: 500;
  }

  .status-badge.success {
    background: var(--success-bg);
    color: var(--success-color);
  }

  .status-badge.error {
    background: var(--error-bg);
    color: var(--error-color);
  }

  .tags {
    padding: 8px 16px;
    background: var(--bg-color);
    border-bottom: 1px solid var(--border-color);
  }

  .tag {
    display: inline-block;
    font-size: 11px;
    padding: 2px 8px;
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    margin-right: 4px;
    color: var(--text-secondary);
  }

  .receipt-content {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0;
  }

  @media (max-width: 768px) {
    .receipt-content {
      grid-template-columns: 1fr;
    }
  }

  .image-panel {
    padding: 16px;
    background: #fafafa;
    border-right: 1px solid var(--border-color);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    max-height: 600px;
    overflow: auto;
  }

  .image-panel img {
    max-width: 100%;
    height: auto;
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  }

  .no-image {
    color: var(--text-secondary);
    padding: 40px;
    text-align: center;
  }

  .output-panel {
    padding: 16px;
    overflow: auto;
    max-height: 600px;
  }

  /* OCR Output Styles */
  .ocr-output {
    font-size: 14px;
  }

  .ocr-error {
    text-align: center;
    padding: 40px;
  }

  .ocr-error h4 {
    color: var(--error-color);
    margin-bottom: 8px;
  }

  .error-message {
    color: var(--text-secondary);
    font-family: monospace;
    font-size: 12px;
    background: var(--error-bg);
    padding: 8px;
    border-radius: 4px;
  }

  .merchant-info {
    margin-bottom: 16px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--border-color);
  }

  .merchant-name {
    font-size: 18px;
    margin-bottom: 4px;
  }

  .merchant-address, .receipt-date {
    color: var(--text-secondary);
    font-size: 13px;
  }

  .items-section {
    margin-bottom: 16px;
  }

  .items-section h4 {
    font-size: 14px;
    margin-bottom: 8px;
    color: var(--text-secondary);
  }

  .items-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }

  .items-table th {
    text-align: left;
    padding: 8px 4px;
    border-bottom: 2px solid var(--border-color);
    font-weight: 600;
    color: var(--text-secondary);
    font-size: 11px;
    text-transform: uppercase;
  }

  .items-table td {
    padding: 8px 4px;
    border-bottom: 1px solid var(--border-color);
    vertical-align: top;
  }

  .item-num {
    width: 30px;
    color: var(--text-secondary);
  }

  .item-desc {
    max-width: 200px;
  }

  .item-flags {
    font-size: 11px;
    color: var(--primary-color);
    font-style: italic;
  }

  .item-qty, .item-unit, .item-total {
    text-align: right;
    white-space: nowrap;
  }

  .no-items {
    color: var(--text-secondary);
    font-style: italic;
    padding: 16px 0;
  }

  .totals-section {
    margin-bottom: 16px;
    padding: 12px;
    background: var(--bg-color);
    border-radius: 6px;
  }

  .totals-row {
    display: flex;
    justify-content: space-between;
    padding: 4px 0;
    font-size: 13px;
  }

  .totals-row.total {
    border-top: 2px solid var(--border-color);
    margin-top: 8px;
    padding-top: 8px;
    font-weight: 700;
    font-size: 15px;
  }

  .totals-row.discount .totals-value {
    color: var(--success-color);
  }

  .meta-section {
    display: flex;
    gap: 16px;
    margin-bottom: 12px;
    font-size: 13px;
  }

  .confidence, .duration {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .confidence-label, .duration-label {
    color: var(--text-secondary);
  }

  .confidence-value {
    font-weight: 600;
    padding: 2px 6px;
    border-radius: 4px;
  }

  .confidence-value.high {
    background: var(--success-bg);
    color: var(--success-color);
  }

  .confidence-value.medium {
    background: var(--warning-bg);
    color: var(--warning-color);
  }

  .confidence-value.low {
    background: var(--error-bg);
    color: var(--error-color);
  }

  .validation {
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 12px;
  }

  .validation.success {
    background: var(--success-bg);
    color: var(--success-color);
  }

  .validation.warnings {
    background: var(--warning-bg);
  }

  .error-item {
    color: var(--error-color);
  }

  .warning-item {
    color: var(--warning-color);
  }

  footer {
    text-align: center;
    margin-top: 32px;
    padding-top: 16px;
    border-top: 1px solid var(--border-color);
    color: var(--text-secondary);
    font-size: 12px;
  }
`;

/**
 * Generate the full HTML report
 */
export function generateReport(report: EvalReport): string {
  const receiptCards = report.results.map(generateReceiptCard).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Receipt OCR Evaluation Report</title>
  <style>
${CSS_STYLES}
  </style>
</head>
<body>
  <header class="page-header">
    <h1>Receipt OCR Evaluation Report</h1>
    <p class="meta">
      Dataset: ${escapeHtml(report.datasetName)} |
      Generated: ${new Date(report.generatedAt).toLocaleString()} |
      Mode: ${report.options.mode}
    </p>
  </header>

  <section class="summary-section">
    <h2>Summary</h2>
    ${formatSummary(report.summary)}
  </section>

  <section class="receipts-section">
    <h2>Receipt Results</h2>
    ${receiptCards}
  </section>

  <footer>
    <p>Generated by split it. Receipt Eval Tool</p>
  </footer>
</body>
</html>`;
}

/**
 * Save the report to a file
 */
export function saveReport(report: EvalReport, outputPath: string): void {
  const html = generateReport(report);
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(outputPath, html, 'utf-8');
}

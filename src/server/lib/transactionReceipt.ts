import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from 'pdf-lib';
import type { Transaction, TxStatus, TxType } from './transactionStore.js';

const BRAND_GOLD = rgb(0.78, 0.62, 0.25);
const BRAND_GOLD_LIGHT = rgb(0.93, 0.81, 0.51);
const INK = rgb(0.09, 0.11, 0.15);
const MUTED = rgb(0.38, 0.41, 0.47);
const PALE = rgb(0.95, 0.94, 0.91);
const WHITE = rgb(1, 1, 1);

const TYPE_LABELS: Record<TxType, string> = {
  deposit: 'Deposit',
  withdrawal: 'Withdrawal',
  transfer: 'Transfer',
  crypto_buy: 'Digital asset purchase',
  crypto_sell: 'Digital asset sale',
  wire_transfer: 'Bank transfer',
  fee: 'Fee',
  refund: 'Refund',
  manual_credit: 'Account credit',
  manual_debit: 'Account debit',
};

const STATUS_LABELS: Record<TxStatus, string> = {
  pending: 'Pending',
  completed: 'Completed',
  failed: 'Failed',
  rejected: 'Rejected',
  flagged: 'Under review',
  frozen: 'Restricted',
};

const CRYPTO_CURRENCIES = new Set(['BTC', 'ETH', 'USDT', 'BNB', 'SOL']);

export interface TransactionReceiptView {
  reference: string;
  type: string;
  status: string;
  occurredAt: string;
  amount: string;
  currency: string;
  description: string;
}

export interface TransactionReceiptOptions {
  /** Used only by generated design artifacts, never by the customer endpoint. */
  preview?: boolean;
  logoBytes?: Uint8Array;
}

function cleanText(value: string, maximumLength: number): string {
  const withoutControls = Array.from(value, character => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127 ? ' ' : character;
  }).join('');
  return withoutControls.replace(/\s+/g, ' ').trim().slice(0, maximumLength);
}

function formatAmount(amount: number, currency: string): string {
  if (!Number.isFinite(amount)) throw new Error('Transaction amount must be finite.');
  if (CRYPTO_CURRENCIES.has(currency)) {
    return `${new Intl.NumberFormat('en-GB', { maximumFractionDigits: 8 }).format(amount)} ${currency}`;
  }
  try {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency,
      currencyDisplay: 'code',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${new Intl.NumberFormat('en-GB', { maximumFractionDigits: 8 }).format(amount)} ${currency}`;
  }
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('Transaction timestamp is invalid.');
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'long',
    timeStyle: 'medium',
    timeZone: 'UTC',
  }).format(date) + ' UTC';
}

/**
 * Convert the persisted transaction to an intentionally narrow receipt view.
 * No customer identity, bank, card, routing, wallet, blockchain, IP, note, or
 * administrator fields can cross this whitelist.
 */
export function buildTransactionReceiptView(transaction: Transaction): TransactionReceiptView {
  const reference = cleanText(transaction.reference, 80);
  if (!/^CGC[A-Z0-9-]+$/i.test(reference)) throw new Error('Transaction reference is invalid.');
  const currency = cleanText(transaction.currency, 10).toUpperCase();
  return {
    reference,
    type: TYPE_LABELS[transaction.type] ?? 'Transaction',
    status: STATUS_LABELS[transaction.status] ?? cleanText(transaction.status, 40),
    occurredAt: formatTimestamp(transaction.createdAt),
    amount: formatAmount(transaction.amount, currency),
    currency,
    description: cleanText(transaction.description || TYPE_LABELS[transaction.type] || 'Transaction', 240),
  };
}

function logoCandidates(): string[] {
  const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
  return [
    path.resolve(process.cwd(), 'public/assets/brand/city-gate-capital-horizontal.png'),
    path.resolve(process.cwd(), 'dist/client/assets/brand/city-gate-capital-horizontal.png'),
    path.resolve(moduleDirectory, '../../../public/assets/brand/city-gate-capital-horizontal.png'),
  ];
}

async function loadApprovedLogo(): Promise<Uint8Array> {
  for (const candidate of logoCandidates()) {
    try {
      const data = await fs.readFile(candidate);
      if (data.byteLength > 0) return data;
    } catch { /* try the next packaged location */ }
  }
  throw new Error('Approved City Gate Capital receipt logo is unavailable.');
}

function wrapText(text: string, font: PDFFont, fontSize: number, maximumWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, fontSize) <= maximumWidth) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    current = word;
  }
  if (current) lines.push(current);
  return lines.slice(0, 3);
}

function drawLabelValue(
  page: PDFPage,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number,
  regular: PDFFont,
  bold: PDFFont,
): void {
  page.drawText(label.toUpperCase(), { x, y, size: 8.5, font: bold, color: MUTED });
  const lines = wrapText(value, regular, 11.5, width);
  lines.forEach((line, index) => page.drawText(line, {
    x,
    y: y - 19 - (index * 15),
    size: 11.5,
    font: regular,
    color: INK,
  }));
}

function drawLogo(page: PDFPage, logo: PDFImage): void {
  const maximumWidth = 155;
  const maximumHeight = 54;
  const scale = Math.min(maximumWidth / logo.width, maximumHeight / logo.height);
  const width = logo.width * scale;
  const height = logo.height * scale;
  page.drawImage(logo, { x: 50, y: 769 - height / 2, width, height });
}

export function transactionReceiptFilename(transaction: Pick<Transaction, 'reference'>): string {
  const safeReference = transaction.reference.replace(/[^A-Za-z0-9-]/g, '').slice(0, 80) || 'transaction';
  return `City-Gate-Capital-${safeReference}-receipt.pdf`;
}

/** Generate a customer-safe PDF from the canonical persisted transaction. */
export async function generateTransactionReceiptPdf(
  transaction: Transaction,
  options: TransactionReceiptOptions = {},
): Promise<Buffer> {
  const view = buildTransactionReceiptView(transaction);
  const pdf = await PDFDocument.create();
  pdf.setTitle(`City Gate Capital transaction receipt ${view.reference}`);
  pdf.setAuthor('City Gate Capital');
  pdf.setSubject(`${view.type} | ${view.status} | ${view.reference}`);
  pdf.setKeywords(['City Gate Capital', 'transaction receipt', view.reference, view.status]);
  pdf.setCreator('City Gate Capital receipt service');
  pdf.setProducer('City Gate Capital receipt service');
  pdf.setCreationDate(new Date(transaction.createdAt));
  pdf.setModificationDate(new Date(transaction.updatedAt || transaction.createdAt));

  const page = pdf.addPage([595.28, 841.89]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo = await pdf.embedPng(options.logoBytes ?? await loadApprovedLogo());

  page.drawRectangle({ x: 0, y: 734, width: 595.28, height: 107.89, color: INK });
  page.drawRectangle({ x: 0, y: 731, width: 595.28, height: 3, color: BRAND_GOLD });
  drawLogo(page, logo);
  page.drawText('TRANSACTION RECEIPT', { x: 392, y: 787, size: 10, font: bold, color: BRAND_GOLD_LIGHT });
  page.drawText(view.reference, { x: 392, y: 767, size: 9, font: regular, color: WHITE });

  page.drawText(view.type, { x: 50, y: 671, size: 27, font: bold, color: INK });
  page.drawText('Transaction confirmation', { x: 50, y: 648, size: 11, font: regular, color: MUTED });

  const statusWidth = bold.widthOfTextAtSize(view.status, 10) + 27;
  page.drawRectangle({ x: 495 - statusWidth, y: 652, width: statusWidth, height: 25, color: PALE, borderColor: BRAND_GOLD, borderWidth: 0.7 });
  page.drawCircle({ x: 508 - statusWidth, y: 664.5, size: 3.5, color: BRAND_GOLD });
  page.drawText(view.status, { x: 518 - statusWidth, y: 660.5, size: 10, font: bold, color: INK });

  page.drawRectangle({ x: 50, y: 536, width: 495, height: 82, color: PALE, borderColor: rgb(0.86, 0.83, 0.75), borderWidth: 0.5 });
  page.drawText('AMOUNT', { x: 70, y: 589, size: 8.5, font: bold, color: MUTED });
  page.drawText(view.amount, { x: 70, y: 558, size: 23, font: bold, color: INK });
  page.drawLine({ start: { x: 350, y: 551 }, end: { x: 350, y: 603 }, thickness: 0.6, color: rgb(0.81, 0.79, 0.73) });
  page.drawText('CURRENCY', { x: 375, y: 589, size: 8.5, font: bold, color: MUTED });
  page.drawText(view.currency, { x: 375, y: 558, size: 18, font: bold, color: INK });

  page.drawText('TRANSACTION DETAILS', { x: 50, y: 491, size: 9.5, font: bold, color: BRAND_GOLD });
  page.drawLine({ start: { x: 50, y: 480 }, end: { x: 545, y: 480 }, thickness: 0.8, color: BRAND_GOLD });
  drawLabelValue(page, 'Reference', view.reference, 50, 449, 210, regular, bold);
  drawLabelValue(page, 'Status', view.status, 315, 449, 210, regular, bold);
  drawLabelValue(page, 'Date and time', view.occurredAt, 50, 379, 210, regular, bold);
  drawLabelValue(page, 'Transaction type', view.type, 315, 379, 210, regular, bold);
  drawLabelValue(page, 'Description', view.description, 50, 309, 475, regular, bold);

  page.drawRectangle({ x: 50, y: 176, width: 495, height: 52, color: rgb(0.975, 0.972, 0.96) });
  page.drawText('Privacy notice', { x: 66, y: 207, size: 9, font: bold, color: INK });
  page.drawText('Sensitive account, card, bank and wallet identifiers are intentionally omitted from this receipt.', {
    x: 66,
    y: 190,
    size: 8.5,
    font: regular,
    color: MUTED,
  });

  if (options.preview) {
    page.drawText('DESIGN PREVIEW - NOT A FINANCIAL RECORD', {
      x: 158,
      y: 143,
      size: 9,
      font: bold,
      color: BRAND_GOLD,
    });
  }

  page.drawLine({ start: { x: 50, y: 112 }, end: { x: 545, y: 112 }, thickness: 0.7, color: rgb(0.81, 0.79, 0.73) });
  page.drawText('City Gate Capital', { x: 50, y: 91, size: 9.5, font: bold, color: INK });
  page.drawText('Keep this receipt for your records.', { x: 50, y: 75, size: 8.5, font: regular, color: MUTED });
  page.drawText(`Receipt reference: ${view.reference}`, { x: 375, y: 83, size: 7.5, font: regular, color: MUTED });

  const bytes = await pdf.save({ useObjectStreams: false, addDefaultPage: false });
  return Buffer.from(bytes);
}

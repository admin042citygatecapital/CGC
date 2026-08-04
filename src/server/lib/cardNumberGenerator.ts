/**
 * cardNumberGenerator.ts — synthetic Luhn-valid virtual card number
 * generation. Shared by users/cards/generate/POST.ts (self-service) and
 * admin/cards/issue/POST.ts (admin-issued). This is a simulated
 * virtual-card product with no real card-network integration anywhere in
 * this codebase — these numbers are not real, issuable PANs.
 */
import crypto from 'node:crypto';
import type { CardNetwork } from './cardStore.js';

function luhnChecksum(numWithoutCheck: string): string {
  let sum = 0;
  let double = true;
  for (let i = numWithoutCheck.length - 1; i >= 0; i--) {
    let d = Number(numWithoutCheck[i]);
    if (double) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
    double = !double;
  }
  const check = (10 - (sum % 10)) % 10;
  return numWithoutCheck + String(check);
}

export function generateCardNumber(network: CardNetwork): string {
  const prefix = network === 'mastercard'
    ? String(51 + crypto.randomInt(0, 5)) // 51-55
    : '4';
  const bodyLength = 15 - prefix.length; // total 16 digits including check digit
  let body = '';
  for (let i = 0; i < bodyLength; i++) body += String(crypto.randomInt(0, 10));
  return luhnChecksum(prefix + body);
}

export function generateExpiry(yearsFromNow = 4): string {
  const now = new Date();
  return `${String(now.getMonth() + 1).padStart(2, '0')}/${String((now.getFullYear() + yearsFromNow) % 100).padStart(2, '0')}`;
}

export function generateCvv(): string {
  return String(crypto.randomInt(0, 1000)).padStart(3, '0');
}

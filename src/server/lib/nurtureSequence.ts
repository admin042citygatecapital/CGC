/**
 * Pre-deployment nurture sequence.
 *
 * Commercial banking, insurance, yield, customer-count, fee, and coverage
 * claims are intentionally excluded until they have evidence and legal
 * approval for the selected launch jurisdiction.
 */

export interface NurtureEmail {
  step: number;
  subject: string;
  preheader: string;
  delayHours: number;
  bodyText: string;
  bodyHtml: string;
  ctaLabel: string;
  ctaUrl: string;
}

const BASE_URL = 'https://citygate.capital';
const GOLD = '#C9A84C';
const BG = '#0A0A0A';
const CARD = '#111111';
const TEXT = '#FFFFFF';
const MUTED = '#A3A3A3';

function emailShell(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>City Gate Capital</title>
</head>
<body style="margin:0;padding:0;background:${BG};font-family:Inter,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td style="padding:0 0 28px;" align="center">
          <a href="${BASE_URL}" style="color:${TEXT};font-weight:700;font-size:18px;text-decoration:none;">City Gate Capital</a>
        </td></tr>
        <tr><td style="background:${CARD};border-radius:16px;border:1px solid rgba(201,168,76,0.15);padding:40px 36px;">
          ${content}
        </td></tr>
        <tr><td style="padding:24px 0 0;text-align:center;">
          <p style="color:${MUTED};font-size:11px;margin:0 0 6px;">City Gate Capital · Service availability depends on eligibility and approved providers</p>
          <p style="color:${MUTED};font-size:11px;margin:0;">
            <a href="${BASE_URL}/unsubscribe?email={{email}}" style="color:${MUTED};text-decoration:underline;">Unsubscribe</a>
            &nbsp;·&nbsp;
            <a href="${BASE_URL}" style="color:${MUTED};text-decoration:none;">citygate.capital</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function ctaButton(label: string, url: string): string {
  return `<table cellpadding="0" cellspacing="0" style="margin:28px 0 0;">
    <tr><td style="background:${GOLD};border-radius:10px;padding:14px 28px;text-align:center;">
      <a href="${url}" style="color:#000;font-weight:700;font-size:14px;text-decoration:none;display:inline-block;">${label} →</a>
    </td></tr>
  </table>`;
}

function h1(text: string): string {
  return `<h1 style="color:${TEXT};font-size:24px;font-weight:700;margin:0 0 16px;line-height:1.3;">${text}</h1>`;
}

function p(text: string): string {
  return `<p style="color:${MUTED};font-size:15px;line-height:1.7;margin:0 0 14px;">${text}</p>`;
}

function highlight(text: string): string {
  return `<span style="color:${GOLD};font-weight:600;">${text}</span>`;
}

export const NURTURE_SEQUENCE: NurtureEmail[] = [
  {
    step: 1,
    subject: 'Welcome to City Gate Capital',
    preheader: 'A clear guide to your connected financial experience.',
    delayHours: 0,
    ctaLabel: 'Explore the Platform',
    ctaUrl: `${BASE_URL}/digital-banking`,
    bodyText: `Welcome to City Gate Capital.

Your profile gives you access to account, wallet, card, transfer, analytics, and security information. Financial services activate only after eligibility review and approved-provider availability.

Explore the platform: ${BASE_URL}/digital-banking`,
    bodyHtml: emailShell(`
      ${h1(`Welcome to ${highlight('City Gate Capital')}`)}
      ${p('Your profile gives you access to connected account, wallet, card, transfer, analytics, and security information.')}
      ${p('Financial services activate only after identity verification, eligibility review, and the availability of approved banking, payment, card, or custody providers for the relevant product.')}
      ${ctaButton('Explore the Platform', `${BASE_URL}/digital-banking`)}
    `),
  },
];

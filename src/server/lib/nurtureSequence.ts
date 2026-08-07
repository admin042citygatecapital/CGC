/**
 * nurtureSequence.ts
 * Defines the 5-email lead nurturing sequence for City Gate Capital.
 *
 * Each email is sent at a configurable delay after the previous one.
 * The sequence is designed to move a subscriber from awareness → consideration → conversion.
 */

export interface NurtureEmail {
  step: number;          // 1-indexed
  subject: string;
  preheader: string;     // Preview text shown in inbox
  /** Delay in hours after the previous step (or after signup for step 1) */
  delayHours: number;
  /** Plain-text body — used as fallback and for logging */
  bodyText: string;
  /** HTML body — full branded email */
  bodyHtml: string;
  /** CTA button label */
  ctaLabel: string;
  /** CTA URL */
  ctaUrl: string;
}

const BASE_URL = 'https://citygate.capital';

const GOLD   = '#C9A84C';
const BG     = '#0A0A0A';
const CARD   = '#111111';
const TEXT   = '#FFFFFF';
const MUTED  = '#888888';

function emailShell(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>City Gate Capital</title>
</head>
<body style="margin:0;padding:0;background:${BG};font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr><td style="padding:0 0 28px 0;" align="center">
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td style="background:linear-gradient(135deg,${GOLD},#F0D080);width:36px;height:36px;border-radius:8px;text-align:center;vertical-align:middle;">
                <span style="color:#000;font-weight:900;font-size:14px;line-height:36px;">CGC</span>
              </td>
              <td style="padding-left:10px;vertical-align:middle;">
                <span style="color:${TEXT};font-weight:700;font-size:16px;">City Gate Capital</span>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Card -->
        <tr><td style="background:${CARD};border-radius:16px;border:1px solid rgba(201,168,76,0.15);padding:40px 36px;">
          ${content}
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:24px 0 0 0;text-align:center;">
          <p style="color:${MUTED};font-size:11px;margin:0 0 6px 0;">
            City Gate Capital Ltd · Regulated in 40+ jurisdictions · FDIC Insured
          </p>
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
  return `<table cellpadding="0" cellspacing="0" style="margin:28px 0 0 0;">
    <tr>
      <td style="background:linear-gradient(135deg,${GOLD},#F0D080);border-radius:10px;padding:14px 28px;text-align:center;">
        <a href="${url}" style="color:#000;font-weight:700;font-size:14px;text-decoration:none;display:inline-block;">${label} →</a>
      </td>
    </tr>
  </table>`;
}

function h1(text: string): string {
  return `<h1 style="color:${TEXT};font-size:24px;font-weight:700;margin:0 0 16px 0;line-height:1.3;">${text}</h1>`;
}

function p(text: string): string {
  return `<p style="color:${MUTED};font-size:15px;line-height:1.7;margin:0 0 14px 0;">${text}</p>`;
}

function highlight(text: string): string {
  return `<span style="color:${GOLD};font-weight:600;">${text}</span>`;
}

export const NURTURE_SEQUENCE: NurtureEmail[] = [
  // ── Step 1: Welcome (sent immediately) ──────────────────────────────────
  {
    step: 1,
    subject: 'Welcome to City Gate Capital — your premium banking starts here',
    preheader: 'Here\'s what to expect from us every week.',
    delayHours: 0,
    ctaLabel: 'Explore the Platform',
    ctaUrl: `${BASE_URL}/digital-banking`,
    bodyText: `Welcome to City Gate Capital!

You're now part of a community of 2M+ global citizens who bank smarter.

Every week you'll receive:
• Crypto & FX market insights
• Exclusive rate alerts
• Tips to maximise your money globally
• Early access to new features

Ready to get started? Open your free account in under 5 minutes.

→ ${BASE_URL}/accounts`,
    bodyHtml: emailShell(`
      ${h1(`Welcome to ${highlight('City Gate Capital')}`)}
      ${p(`You're now part of a community of 2M+ global citizens who bank smarter. We're glad you're here.`)}
      ${p(`Every week you'll receive:`)}
      <ul style="color:${MUTED};font-size:15px;line-height:2;margin:0 0 14px 0;padding-left:20px;">
        <li>Crypto &amp; FX market insights</li>
        <li>Exclusive rate alerts before they go public</li>
        <li>Tips to maximise your money globally</li>
        <li>Early access to new features</li>
      </ul>
      ${p(`Ready to see what premium banking feels like? Open your free account in under 5 minutes — no credit check, no branch visit.`)}
      ${ctaButton('Explore the Platform', `${BASE_URL}/digital-banking`)}
    `),
  },

  // ── Step 2: Education — Multi-currency wallets (24h) ────────────────────
  {
    step: 2,
    subject: 'How to hold 50+ currencies without paying conversion fees',
    preheader: 'Most banks charge 3–5% on every currency conversion. Here\'s the smarter way.',
    delayHours: 24,
    ctaLabel: 'See the Wallet',
    ctaUrl: `${BASE_URL}/wallet`,
    bodyText: `Did you know most banks charge 3–5% on every currency conversion?

On a $10,000 transfer, that's $300–$500 gone — every time.

City Gate Capital's multi-currency wallet lets you:
• Hold 50+ fiat currencies at real mid-market rates
• Convert instantly with zero hidden fees
• Send internationally from $0.99

→ ${BASE_URL}/wallet`,
    bodyHtml: emailShell(`
      ${h1(`Stop paying ${highlight('3–5% conversion fees')}`)}
      ${p(`Most banks quietly charge 3–5% on every currency conversion. On a $10,000 transfer, that's $300–$500 gone — every single time.`)}
      ${p(`City Gate Capital's multi-currency wallet gives you:`)}
      <table cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 14px 0;">
        ${['Hold 50+ fiat currencies at real mid-market rates', 'Convert instantly with zero hidden markup', 'Send internationally from just $0.99', 'Crypto-to-fiat in seconds'].map(item => `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
            <span style="color:${GOLD};margin-right:10px;">✓</span>
            <span style="color:${MUTED};font-size:14px;">${item}</span>
          </td>
        </tr>`).join('')}
      </table>
      ${p(`Your money should work as hard as you do — across every border.`)}
      ${ctaButton('See the Wallet', `${BASE_URL}/wallet`)}
    `),
  },

  // ── Step 3: Social proof — Transfers (72h) ──────────────────────────────
  {
    step: 3,
    subject: 'Carlos saves $180/month on remittances. Here\'s how.',
    preheader: 'Real stories from City Gate Capital customers around the world.',
    delayHours: 72,
    ctaLabel: 'Calculate Your Savings',
    ctaUrl: `${BASE_URL}/transfers`,
    bodyText: `Carlos is an expat in Dubai who sends money home to Mexico every month.

Before City Gate Capital: $180 in fees per transfer.
After: $1.49.

That's $178.51 saved — every single month.

Our international transfer network covers 180+ countries with real mid-market exchange rates and fees starting at $0.99.

Calculate your savings → ${BASE_URL}/transfers`,
    bodyHtml: emailShell(`
      ${h1(`"I save ${highlight('$178 every month')} on transfers"`)}
      <table cellpadding="0" cellspacing="0" style="width:100%;background:rgba(201,168,76,0.06);border:1px solid rgba(201,168,76,0.15);border-radius:12px;margin:0 0 20px 0;">
        <tr><td style="padding:20px 24px;">
          <p style="color:${TEXT};font-size:15px;font-style:italic;margin:0 0 12px 0;">"I send money home to Mexico every month. The fees are a fraction of what Western Union charged me. I genuinely can't believe I waited this long."</p>
          <p style="color:${GOLD};font-size:13px;font-weight:600;margin:0;">— Carlos M., Expat in Dubai</p>
        </td></tr>
      </table>
      ${p(`Carlos's story isn't unique. Millions of people overpay on international transfers every month because they don't know there's a better way.`)}
      <table cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 20px 0;">
        <tr>
          <td style="width:50%;padding:12px;background:rgba(255,255,255,0.03);border-radius:10px;text-align:center;">
            <p style="color:${MUTED};font-size:11px;margin:0 0 4px 0;text-transform:uppercase;letter-spacing:0.1em;">Traditional Bank</p>
            <p style="color:#ef4444;font-size:22px;font-weight:700;margin:0;">$180</p>
            <p style="color:${MUTED};font-size:11px;margin:4px 0 0 0;">per $1,000 transfer</p>
          </td>
          <td style="width:4px;"></td>
          <td style="width:50%;padding:12px;background:rgba(201,168,76,0.08);border-radius:10px;text-align:center;border:1px solid rgba(201,168,76,0.2);">
            <p style="color:${MUTED};font-size:11px;margin:0 0 4px 0;text-transform:uppercase;letter-spacing:0.1em;">City Gate Capital</p>
            <p style="color:${GOLD};font-size:22px;font-weight:700;margin:0;">$1.49</p>
            <p style="color:${MUTED};font-size:11px;margin:4px 0 0 0;">per $1,000 transfer</p>
          </td>
        </tr>
      </table>
      ${ctaButton('Calculate Your Savings', `${BASE_URL}/transfers`)}
    `),
  },

  // ── Step 4: Feature spotlight — Accounts & plans (5 days) ───────────────
  {
    step: 4,
    subject: 'Which City Gate account is right for you?',
    preheader: 'Personal, Savings (5.2% APY), or Business — here\'s how to choose.',
    delayHours: 120,
    ctaLabel: 'Compare Accounts',
    ctaUrl: `${BASE_URL}/accounts`,
    bodyText: `We offer three account types designed for different needs:

Personal Checking — Free
• Unlimited transactions
• Visa debit card
• Mobile banking

High-Yield Savings — 5.2% APY
• 10x the national average
• FDIC insured
• No minimum balance

Business — $29/month
• Multi-user access
• API integrations
• Dedicated support

All accounts open in under 5 minutes. No credit check.

→ ${BASE_URL}/accounts`,
    bodyHtml: emailShell(`
      ${h1(`Which account is ${highlight('right for you?')}`)}
      ${p(`We designed three accounts for different stages of life. Here's a quick breakdown:`)}
      <table cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 20px 0;border-collapse:separate;border-spacing:0 8px;">
        ${[
          { name: 'Personal', price: 'Free', color: '#627EEA', features: ['Unlimited transactions', 'Visa debit card', 'Mobile banking app', 'Multi-currency wallet'] },
          { name: 'Savings', price: '5.2% APY', color: GOLD, features: ['10× the national average', 'FDIC insured up to $250K', 'No minimum balance', 'Auto-save rules'] },
          { name: 'Business', price: '$29/mo', color: '#10B981', features: ['Multi-user access', 'API integrations', 'Dedicated support', 'Expense management'] },
        ].map(acct => `
        <tr><td style="background:rgba(255,255,255,0.03);border-radius:10px;padding:16px 20px;border-left:3px solid ${acct.color};">
          <table cellpadding="0" cellspacing="0" style="width:100%;">
            <tr>
              <td><span style="color:${TEXT};font-weight:700;font-size:15px;">${acct.name}</span></td>
              <td align="right"><span style="color:${acct.color};font-weight:700;font-size:14px;">${acct.price}</span></td>
            </tr>
          </table>
          <p style="color:${MUTED};font-size:13px;margin:8px 0 0 0;">${acct.features.join(' · ')}</p>
        </td></tr>`).join('')}
      </table>
      ${p(`All accounts open in under 5 minutes. No credit check. No branch visit. No paperwork.`)}
      ${ctaButton('Compare Accounts', `${BASE_URL}/accounts`)}
    `),
  },

  // ── Step 5: Conversion push — Urgency + offer (10 days) ─────────────────
  {
    step: 5,
    subject: 'Your account is waiting — open it in 5 minutes',
    preheader: 'Join 2M+ customers who already bank smarter. Takes less time than a coffee run.',
    delayHours: 240,
    ctaLabel: 'Open My Free Account',
    ctaUrl: `${BASE_URL}/accounts`,
    bodyText: `You've been exploring City Gate Capital for a little while now.

Here's the truth: the hardest part is just getting started.

Opening your account takes under 5 minutes:
1. Enter your email and create a password
2. Verify your identity (AI-powered, instant)
3. Fund your account — even $1 to start

That's it. No branch visit. No paperwork. No credit check.

2,000,000+ customers in 180+ countries already bank with us.

Ready? → ${BASE_URL}/accounts`,
    bodyHtml: emailShell(`
      ${h1(`Your account is ${highlight('waiting for you')}`)}
      ${p(`You've been exploring City Gate Capital — and we think you're ready to take the next step.`)}
      ${p(`Opening your account takes less time than a coffee run:`)}
      <table cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 20px 0;">
        ${[
          ['1', 'Enter your email & create a password', '30 seconds'],
          ['2', 'Verify your identity (AI-powered, instant)', '2 minutes'],
          ['3', 'Fund your account — even $1 to start', '1 minute'],
        ].map(([num, step, time]) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:rgba(201,168,76,0.15);border-radius:50%;width:28px;height:28px;text-align:center;vertical-align:middle;">
                  <span style="color:${GOLD};font-weight:700;font-size:13px;">${num}</span>
                </td>
                <td style="padding-left:12px;vertical-align:middle;">
                  <span style="color:${TEXT};font-size:14px;">${step}</span>
                </td>
                <td style="padding-left:12px;vertical-align:middle;" align="right">
                  <span style="color:${MUTED};font-size:12px;">${time}</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>`).join('')}
      </table>
      <table cellpadding="0" cellspacing="0" style="width:100%;background:rgba(201,168,76,0.06);border:1px solid rgba(201,168,76,0.15);border-radius:12px;margin:0 0 20px 0;">
        <tr><td style="padding:16px 20px;text-align:center;">
          <p style="color:${GOLD};font-size:22px;font-weight:700;margin:0 0 4px 0;">2,000,000+</p>
          <p style="color:${MUTED};font-size:13px;margin:0;">customers in 180+ countries already bank smarter</p>
        </td></tr>
      </table>
      ${ctaButton('Open My Free Account', `${BASE_URL}/accounts`)}
      ${p(`No credit check. No branch visit. No paperwork. Just better banking.`)}
    `),
  },
];

import { loadEmailBranding, type EmailBrandingConfig } from './emailBrandingStore.js';

export interface BrandedEmailOptions {
  title: string;
  bodyHtml: string;
  preheader?: string;
  testLabel?: string;
}

export function escapeEmailHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function websiteButton(label?: string, url?: string, branding: EmailBrandingConfig = loadEmailBranding()): string {
  const href = escapeEmailHtml(url || branding.websiteUrl);
  const text = escapeEmailHtml(label || branding.websiteButtonLabel);
  return `<a href="${href}" style="display:inline-block;background:${branding.primaryColor};color:#080808;font-weight:700;padding:14px 28px;border-radius:9px;text-decoration:none;font-size:14px;">${text}</a>`;
}

export function renderBrandedEmail(
  options: BrandedEmailOptions,
  branding: EmailBrandingConfig = loadEmailBranding(),
): string {
  const brand = escapeEmailHtml(branding.brandName);
  const logo = escapeEmailHtml(branding.logoUrl);
  const website = escapeEmailHtml(branding.websiteUrl);
  const support = escapeEmailHtml(branding.supportEmail);
  const phone = escapeEmailHtml(branding.supportPhone);
  const address = escapeEmailHtml(branding.postalAddress);
  const footer = escapeEmailHtml(branding.footerMessage);
  const title = escapeEmailHtml(options.title);
  const preheader = escapeEmailHtml(options.preheader || options.title);

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#080808;font-family:Arial,Helvetica,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#080808;">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#111111;border:1px solid #2b2517;border-radius:16px;overflow:hidden;">
      <tr><td align="center" style="padding:28px 32px 22px;background:#050505;border-bottom:1px solid #2b2517;">
        <a href="${website}" style="text-decoration:none;display:inline-block;" aria-label="Visit ${brand}">
          <img src="${logo}" width="360" alt="${brand}" style="display:block;width:100%;max-width:360px;height:auto;border:0;outline:none;" />
        </a>
      </td></tr>
      <tr><td style="padding:36px 40px;color:#e8e8e8;">
        <h1 style="color:#ffffff;font-size:24px;line-height:1.3;margin:0 0 22px;">${title}</h1>
        <div style="color:#c9c9c9;font-size:15px;line-height:1.75;">${options.bodyHtml}</div>
        <div style="text-align:center;margin:32px 0 8px;">${websiteButton(branding.websiteButtonLabel, branding.websiteUrl, branding)}</div>
        <p style="text-align:center;margin:12px 0 0;font-size:12px;color:#888888;">Or visit <a href="${website}" style="color:${branding.primaryColor};text-decoration:none;">${website}</a></p>
        ${options.testLabel ? `<p style="margin:28px 0 0;padding:10px 12px;border-radius:8px;background:#191919;color:#888;font-size:11px;text-align:center;">${escapeEmailHtml(options.testLabel)}</p>` : ''}
      </td></tr>
      <tr><td style="padding:24px 40px;background:#0b0b0b;border-top:1px solid #242424;text-align:center;">
        <p style="margin:0 0 10px;color:#a8a8a8;font-size:12px;line-height:1.6;">${footer}</p>
        <p style="margin:0;color:#707070;font-size:11px;line-height:1.7;">${brand} &bull; ${address}<br/>
          <a href="mailto:${support}" style="color:${branding.primaryColor};text-decoration:none;">${support}</a>${phone ? ` &bull; ${phone}` : ''}
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

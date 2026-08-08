import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PREVIEW_NOTICE,
  resolvePreviewNoticeSettings,
} from '../lib/previewNotice';

describe('preview notice settings', () => {
  it('keeps the notice enabled when the server is in preview mode', () => {
    const notice = resolvePreviewNoticeSettings({
      previewNoticeText: 'This product preview uses demonstration balances and live transactions are unavailable.',
      previewNoticePosition: 'top',
      previewNoticeTone: 'neutral',
      previewNoticeCompact: true,
    }, true);

    expect(notice).toEqual({
      enabled: true,
      text: 'This product preview uses demonstration balances and live transactions are unavailable.',
      position: 'top',
      tone: 'neutral',
      compact: true,
    });
  });

  it('only disables the notice when the server is in live mode', () => {
    expect(resolvePreviewNoticeSettings({}, false).enabled).toBe(false);
  });

  it('falls back to the accurate default for invalid stored content', () => {
    const notice = resolvePreviewNoticeSettings({
      previewNoticeText: 'Too short',
      previewNoticePosition: 'sideways',
      previewNoticeTone: 'invisible',
    }, true);

    expect(notice.text).toBe(DEFAULT_PREVIEW_NOTICE);
    expect(notice.position).toBe('bottom');
    expect(notice.tone).toBe('amber');
  });
});

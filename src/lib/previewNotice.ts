export const DEFAULT_PREVIEW_NOTICE =
  'Product preview — City Gate Capital is not operating as a bank in this environment. Balances and trading are demonstrations; deposits, custody, insurance, and live financial transactions are unavailable.';

export type PreviewNoticePosition = 'top' | 'bottom';
export type PreviewNoticeTone = 'amber' | 'neutral';

export interface PreviewNoticeSettings {
  enabled: boolean;
  text: string;
  position: PreviewNoticePosition;
  tone: PreviewNoticeTone;
  compact: boolean;
}

type PreviewNoticeSource = {
  previewNoticeText?: unknown;
  previewNoticePosition?: unknown;
  previewNoticeTone?: unknown;
  previewNoticeCompact?: unknown;
};

export function resolvePreviewNoticeSettings(
  source: PreviewNoticeSource | null | undefined,
  previewMode: boolean,
): PreviewNoticeSettings {
  const candidate = typeof source?.previewNoticeText === 'string'
    ? source.previewNoticeText.trim()
    : '';

  return {
    // The deployment mode, not an editable CMS flag, controls whether the
    // safeguard is visible. This prevents an accidental preview-mode removal.
    enabled: previewMode,
    text: candidate.length >= 40 && candidate.length <= 600
      ? candidate
      : DEFAULT_PREVIEW_NOTICE,
    position: source?.previewNoticePosition === 'top' ? 'top' : 'bottom',
    tone: source?.previewNoticeTone === 'neutral' ? 'neutral' : 'amber',
    compact: source?.previewNoticeCompact === true,
  };
}

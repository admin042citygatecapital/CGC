export const DEFAULT_BUSINESS_ADDRESS =
  'Citygate, 51 Mosley Street, Manchester, M2 3HQ, United Kingdom';

const RETIRED_PLACEHOLDER_ADDRESSES = new Set([
  '1 canada square, canary wharf, london',
  '1 canada square, london',
]);

export interface BusinessLocation {
  address: string;
  mapEmbedUrl: string;
  directionsUrl: string;
}

type BusinessLocationSource = {
  footerAddress?: unknown;
  businessAddressPublished?: unknown;
  businessAddressPublicationEvidence?: unknown;
};

export function normalizeBusinessAddress(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_BUSINESS_ADDRESS;
  const normalized = value
    .replace(/[\r\n]+/g, ', ')
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/(?:,\s*){2,}/g, ', ')
    .trim()
    .replace(/^,|,$/g, '')
    .trim();

  if (!normalized || RETIRED_PLACEHOLDER_ADDRESSES.has(normalized.toLowerCase())) {
    return DEFAULT_BUSINESS_ADDRESS;
  }
  return normalized.slice(0, 300);
}

export function resolveBusinessLocation(
  source: BusinessLocationSource | null | undefined,
): BusinessLocation {
  const address = normalizeBusinessAddress(source?.footerAddress);
  const encodedAddress = encodeURIComponent(address);
  return {
    address,
    mapEmbedUrl: `https://www.google.com/maps?q=${encodedAddress}&output=embed`,
    directionsUrl: `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`,
  };
}

export function resolvePublicBusinessLocation(
  source: BusinessLocationSource | null | undefined,
): BusinessLocation | null {
  const evidence = typeof source?.businessAddressPublicationEvidence === 'string'
    ? source.businessAddressPublicationEvidence.trim()
    : '';
  if (source?.businessAddressPublished !== true || evidence.length < 10) return null;
  return resolveBusinessLocation(source);
}

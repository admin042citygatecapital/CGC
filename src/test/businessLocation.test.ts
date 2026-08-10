import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BUSINESS_ADDRESS,
  normalizeBusinessAddress,
  resolveBusinessLocation,
  resolvePublicBusinessLocation,
} from '../lib/businessLocation';

describe('business location settings', () => {
  it('uses the Manchester address when no saved address exists', () => {
    expect(resolveBusinessLocation({}).address).toBe(DEFAULT_BUSINESS_ADDRESS);
  });

  it('migrates the retired London placeholder to the Manchester address', () => {
    expect(normalizeBusinessAddress('1 Canada Square, Canary Wharf, London'))
      .toBe(DEFAULT_BUSINESS_ADDRESS);
  });

  it('normalizes a multiline admin address and builds fixed-domain Google Maps URLs', () => {
    const location = resolveBusinessLocation({
      footerAddress: 'Citygate\n51 Mosley Street\nManchester\nM2 3HQ\nUnited Kingdom',
    });

    expect(location.address).toBe(DEFAULT_BUSINESS_ADDRESS);
    expect(location.mapEmbedUrl).toBe(
      'https://www.google.com/maps?q=Citygate%2C%2051%20Mosley%20Street%2C%20Manchester%2C%20M2%203HQ%2C%20United%20Kingdom&output=embed',
    );
    expect(location.directionsUrl).toContain('https://www.google.com/maps/dir/?api=1&destination=');
  });

  it('never treats address text as an executable map URL', () => {
    const location = resolveBusinessLocation({ footerAddress: 'javascript:alert(1)' });
    expect(location.mapEmbedUrl.startsWith('https://www.google.com/maps?')).toBe(true);
    expect(location.mapEmbedUrl).toContain('javascript%3Aalert(1)');
  });

  it('keeps an unverified address out of the public projection', () => {
    expect(resolvePublicBusinessLocation({ footerAddress: DEFAULT_BUSINESS_ADDRESS })).toBeNull();
    expect(resolvePublicBusinessLocation({
      footerAddress: DEFAULT_BUSINESS_ADDRESS,
      businessAddressPublished: true,
      businessAddressPublicationEvidence: 'Lease and permanent signage confirmed by an authorised administrator.',
    })?.address).toBe(DEFAULT_BUSINESS_ADDRESS);
  });
});

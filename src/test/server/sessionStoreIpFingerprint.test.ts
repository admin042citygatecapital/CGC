import { describe, expect, it } from 'vitest';
import { sameSessionClientIp } from '../../server/lib/sessionStore.js';

describe('sameSessionClientIp — admin session IP fingerprint', () => {
  it('treats the same IPv6 /64 as equal despite a rotated interface identifier', () => {
    // Real rotating SLAAC/privacy addresses from one client: same /64, different low 64 bits.
    expect(sameSessionClientIp(
      '2605:59c0:e7c:bd10:8573:1512:ef78:251a',
      '2605:59c0:e7c:bd10:602e:14e4:9aed:bc84',
    )).toBe(true);
  });

  it('treats a different IPv6 /64 as not equal', () => {
    expect(sameSessionClientIp('2605:59c0:e7c:bd10::1', '2605:59c0:e7c:bd11::1')).toBe(false);
  });

  it('requires an exact IPv4 host match', () => {
    expect(sameSessionClientIp('203.0.113.7', '203.0.113.7')).toBe(true);
    expect(sameSessionClientIp('203.0.113.7', '203.0.113.8')).toBe(false);
  });

  it('treats an IPv4-mapped IPv6 address as equal to the plain IPv4', () => {
    expect(sameSessionClientIp('::ffff:203.0.113.7', '203.0.113.7')).toBe(true);
  });

  it('does not equate an IPv4 host with an unrelated IPv6 /64', () => {
    expect(sameSessionClientIp('203.0.113.7', '2605:59c0:e7c:bd10::1')).toBe(false);
  });

  it('returns false for unparseable input', () => {
    expect(sameSessionClientIp('not-an-ip', 'also-not-an-ip')).toBe(false);
  });
});

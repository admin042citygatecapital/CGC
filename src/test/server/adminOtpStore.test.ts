import { describe, expect, it, vi } from 'vitest';
import {
  getChallengeEmail,
  issueOtp,
  validateOtpChallenge,
  verifyOtp,
} from '../../server/lib/otpStore.js';

describe('admin email OTP challenge', () => {
  it('is single-use and bound to the issuing device fingerprint', async () => {
    const email = `admin-${Date.now()}@example.test`;
    const issued = await issueOtp({ adminId: 'admin-single-use', email, credentialVersion: 1 }, '192.0.2.10', 'test-browser');
    expect(issued).toMatchObject({ ok: true });
    expect(await getChallengeEmail(issued.challengeId!)).toBe(email);
    expect(await verifyOtp(issued.challengeId!, issued.otp!, { ip: '192.0.2.10', ua: 'test-browser' })).toMatchObject({
      ok: true,
      adminId: 'admin-single-use',
      email,
      credentialVersion: 1,
    });
    expect((await verifyOtp(issued.challengeId!, issued.otp!, { ip: '192.0.2.10', ua: 'test-browser' })).ok).toBe(false);
  });

  it('invalidates a challenge used from a different device', async () => {
    const email = `admin-device-${Date.now()}@example.test`;
    const issued = await issueOtp({ adminId: 'admin-device', email, credentialVersion: 1 }, '192.0.2.20', 'trusted-browser');
    const mismatch = await verifyOtp(issued.challengeId!, issued.otp!, { ip: '192.0.2.21', ua: 'other-browser' });
    expect(mismatch).toMatchObject({ ok: false, locked: true });
    expect(await getChallengeEmail(issued.challengeId!)).toBeNull();
  });

  it('validates a challenge without consuming it before a resend', async () => {
    const email = `admin-resend-${Date.now()}@example.test`;
    const issued = await issueOtp({ adminId: 'admin-resend', email, credentialVersion: 1 }, '192.0.2.30', 'resend-browser');

    expect(await validateOtpChallenge(issued.challengeId!, {
      ip: '192.0.2.30',
      ua: 'resend-browser',
    })).toMatchObject({ ok: true, adminId: 'admin-resend', email, credentialVersion: 1 });

    expect(await verifyOtp(issued.challengeId!, issued.otp!, {
      ip: '192.0.2.30',
      ua: 'resend-browser',
    })).toMatchObject({ ok: true, adminId: 'admin-resend', email, credentialVersion: 1 });
  });

  it('lets the same device replace an expired challenge without exposing its code', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-08-24T12:00:00.000Z'));
      const email = 'admin-expired-resend@example.test';
      const issued = await issueOtp({ adminId: 'admin-expired', email, credentialVersion: 1 }, '192.0.2.40', 'expired-browser');

      vi.advanceTimersByTime(61_000);

      expect(await validateOtpChallenge(
        issued.challengeId!,
        { ip: '192.0.2.40', ua: 'expired-browser' },
        { allowExpired: true },
      )).toMatchObject({
        ok: true,
        expired: true,
        adminId: 'admin-expired',
        email,
        credentialVersion: 1,
      });
    } finally {
      vi.useRealTimers();
    }
  });
});

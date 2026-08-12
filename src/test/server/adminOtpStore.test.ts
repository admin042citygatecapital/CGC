import { describe, expect, it } from 'vitest';
import { getChallengeEmail, issueOtp, verifyOtp } from '../../server/lib/otpStore.js';

describe('admin email OTP challenge', () => {
  it('is single-use and bound to the issuing device fingerprint', () => {
    const email = `admin-${Date.now()}@example.test`;
    const issued = issueOtp(email, '192.0.2.10', 'test-browser');
    expect(issued).toMatchObject({ ok: true });
    expect(getChallengeEmail(issued.challengeId!)).toBe(email);
    expect(verifyOtp(issued.challengeId!, issued.otp!, { ip: '192.0.2.10', ua: 'test-browser' })).toEqual({ ok: true });
    expect(verifyOtp(issued.challengeId!, issued.otp!, { ip: '192.0.2.10', ua: 'test-browser' }).ok).toBe(false);
  });

  it('invalidates a challenge used from a different device', () => {
    const email = `admin-device-${Date.now()}@example.test`;
    const issued = issueOtp(email, '192.0.2.20', 'trusted-browser');
    const mismatch = verifyOtp(issued.challengeId!, issued.otp!, { ip: '192.0.2.21', ua: 'other-browser' });
    expect(mismatch).toMatchObject({ ok: false, locked: true });
    expect(getChallengeEmail(issued.challengeId!)).toBeNull();
  });
});

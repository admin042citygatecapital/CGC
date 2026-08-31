import { describe, expect, it } from 'vitest';
import { safeApiErrorDetails } from '../../server/lib/apiErrorLog.js';

describe('safeApiErrorDetails', () => {
  it('keeps only safe error classification metadata', () => {
    const secretHash = '$argon2id$must-never-appear';
    const error = Object.assign(new Error(`query failed params: ${secretHash}`), {
      name: 'DrizzleQueryError',
      query: 'update users set password_hash = $1',
      params: [secretHash],
      cause: Object.assign(new Error(`driver failure ${secretHash}`), { code: '22007' }),
    });

    const details = safeApiErrorDetails(error);
    const serialized = JSON.stringify(details);

    expect(details).toEqual({ type: 'DrizzleQueryError', code: '22007' });
    expect(serialized).not.toContain(secretHash);
    expect(serialized).not.toContain('password_hash');
    expect(serialized).not.toContain('params');
    expect(serialized).not.toContain('driver failure');
  });

  it('rejects unsafe attacker-controlled names and codes', () => {
    expect(safeApiErrorDetails({
      name: 'Error password=secret',
      code: 'token\nsecret',
    })).toEqual({ type: 'Error' });
    expect(safeApiErrorDetails('secret string')).toEqual({ type: 'NonErrorThrow' });
  });
});

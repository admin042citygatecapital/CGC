import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';

const accessLogMocks = vi.hoisted(() => ({
  appendAccessEntry: vi.fn(),
  detectThreat: vi.fn(() => ({ threat: 'none' as const, note: '' })),
}));

vi.mock('../../server/lib/accessLog.js', () => accessLogMocks);

import { httpLogger, redactHttpLogUrl } from '../../server/lib/httpLogger.js';

function makeResponse(): Response & EventEmitter {
  const response = new EventEmitter();
  Object.assign(response, {
    statusCode: 200,
    getHeader: vi.fn(() => '123'),
  });
  return response as Response & EventEmitter;
}

describe('HTTP access-log URL redaction', () => {
  beforeEach(() => {
    accessLogMocks.appendAccessEntry.mockClear();
    accessLogMocks.detectThreat.mockClear();
    accessLogMocks.detectThreat.mockReturnValue({ threat: 'none', note: '' });
  });

  it('redacts verification and reset credentials while preserving benign query values', () => {
    expect(redactHttpLogUrl(
      '/api/users/verify-email?token=verification-secret&locale=en&passwordResetCode=654321',
    )).toBe(
      '/api/users/verify-email?token=[REDACTED]&locale=en&passwordResetCode=[REDACTED]',
    );

    expect(redactHttpLogUrl(
      '/reset-password?reset%54oken=reset-secret&returnTo=%2Fdashboard',
    )).toBe(
      '/reset-password?reset%54oken=[REDACTED]&returnTo=%2Fdashboard',
    );
  });

  it('redacts token-like values in absolute referrers and URL fragments', () => {
    expect(redactHttpLogUrl(
      'https://citygate.capital/reset-password?verification_code=112233&campaign=welcome#access_token=access-secret&tab=security',
    )).toBe(
      'https://citygate.capital/reset-password?verification_code=[REDACTED]&campaign=welcome#access_token=[REDACTED]&tab=security',
    );
  });

  it('leaves ordinary navigation and market query values unchanged', () => {
    const url = '/markets?symbol=BTC%2FUSD&limit=25&location=Manchester&postcode=M2';
    expect(redactHttpLogUrl(url)).toBe(url);
  });

  it('persists redacted URLs without changing the raw threat-detection input', () => {
    const originalUrl = '/api/users/verify-email?token=verification-secret&locale=en';
    const referer = 'https://citygate.capital/reset-password?resetToken=reset-secret&campaign=welcome';
    const request = {
      method: 'GET',
      path: '/api/users/verify-email',
      originalUrl,
      headers: {
        referer,
        'user-agent': 'test-agent',
      },
      body: undefined,
      ip: '::ffff:127.0.0.1',
      socket: {},
    } as Request;
    const response = makeResponse();
    const next = vi.fn() as NextFunction;

    httpLogger(request, response, next);
    response.emit('finish');

    expect(next).toHaveBeenCalledOnce();
    expect(accessLogMocks.detectThreat).toHaveBeenCalledWith(
      'GET',
      originalUrl,
      'test-agent',
      '',
    );
    expect(accessLogMocks.appendAccessEntry).toHaveBeenCalledWith(expect.objectContaining({
      url: '/api/users/verify-email?token=[REDACTED]&locale=en',
      referer: 'https://citygate.capital/reset-password?resetToken=[REDACTED]&campaign=welcome',
      status: 200,
      bytes: 123,
    }));
    expect(request.originalUrl).toBe(originalUrl);
    expect(request.headers.referer).toBe(referer);
  });
});

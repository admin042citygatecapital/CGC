import { describe, expect, it } from 'vitest';
import { customerCountSummary } from '../../lib/adminCustomerLoading';

describe('administrator customer loading state', () => {
  it('never presents a temporary zero while customer records are loading', () => {
    expect(customerCountSummary({ loading: true, error: null, total: 0 })).toBe('Loading customer records…');
  });

  it('distinguishes a failed request from an authoritative empty result', () => {
    expect(customerCountSummary({ loading: false, error: 'request failed', total: 0 })).toBe('Customer records unavailable');
    expect(customerCountSummary({ loading: false, error: null, total: 0 })).toBe('0 total customers');
  });

  it('reports the authoritative count after a successful response', () => {
    expect(customerCountSummary({ loading: false, error: null, total: 1 })).toBe('1 total customer');
    expect(customerCountSummary({ loading: false, error: null, total: 7 })).toBe('7 total customers');
  });
});

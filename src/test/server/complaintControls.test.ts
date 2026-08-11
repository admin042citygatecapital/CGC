import { describe, expect, it } from 'vitest';
import { assertComplaintTransition, ComplaintError } from '../../server/lib/complaintStore.js';

describe('complaint lifecycle controls', () => {
  it('requires meaningful resolution notes before resolution', () => {
    expect(() => assertComplaintTransition('investigating', 'resolved', 'too short')).toThrow(ComplaintError);
    expect(() => assertComplaintTransition('investigating', 'resolved', 'Customer remediation completed.')).not.toThrow();
  });

  it('rejects transitions that bypass the controlled lifecycle', () => {
    expect(() => assertComplaintTransition('open', 'closed', 'Customer remediation completed.')).toThrow(/cannot transition/);
    expect(() => assertComplaintTransition('closed', 'investigating')).not.toThrow();
  });
});

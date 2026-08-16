import { describe, expect, it } from 'vitest';
import { buildRegistrationWorkflow } from '../../server/lib/registrationWorkflow';

const baseUser = { status: 'pending_kyc' as const, emailVerified: true, kycStatus: 'not_submitted' as const, amlStatus: 'not_screened' as const };

describe('registration workflow', () => {
  it('keeps evidence collection as the next server-directed step', () => {
    const workflow = buildRegistrationWorkflow(baseUser, { status: 'draft' }, 0, null);
    expect(workflow.currentStep).toBe('evidence');
    expect(workflow.nextHref).toBe('/onboarding');
    expect(workflow.queuePosition).toBeNull();
  });

  it('shows a submitted customer in the review queue', () => {
    const workflow = buildRegistrationWorkflow({ ...baseUser, kycStatus: 'submitted' }, { status: 'submitted' }, 1, 4);
    expect(workflow.status).toBe('queued');
    expect(workflow.currentStep).toBe('review');
    expect(workflow.queuePosition).toBe(4);
    expect(workflow.canContinue).toBe(false);
  });

  it('returns a needs-information case to the customer without keeping it in the review queue', () => {
    const workflow = buildRegistrationWorkflow({ ...baseUser, kycStatus: 'submitted' }, { status: 'needs_info' }, 1, 2);
    expect(workflow.status).toBe('in_progress');
    expect(workflow.currentStep).toBe('evidence');
    expect(workflow.nextHref).toBe('/onboarding');
    expect(workflow.queuePosition).toBeNull();
  });

  it('does not treat compliance approval as final registration activation', () => {
    const workflow = buildRegistrationWorkflow({ ...baseUser, status: 'pending_approval', kycStatus: 'approved', amlStatus: 'cleared' }, { status: 'approved' }, 2, 1);
    expect(workflow.status).toBe('awaiting_final_approval');
    expect(workflow.currentStep).toBe('approval');
    expect(workflow.steps.at(-1)?.status).toBe('current');
  });

  it('only completes after the customer status is active', () => {
    const workflow = buildRegistrationWorkflow({ ...baseUser, status: 'active', kycStatus: 'approved', amlStatus: 'cleared' }, { status: 'approved' }, 2, null);
    expect(workflow.status).toBe('complete');
    expect(workflow.nextHref).toBe('/dashboard');
    expect(workflow.steps.every((step) => step.status === 'complete')).toBe(true);
  });

  it('directs an unverified customer to the sign-in verification step', () => {
    const workflow = buildRegistrationWorkflow({ ...baseUser, emailVerified: false }, null, 0, null);
    expect(workflow.currentStep).toBe('email');
    expect(workflow.nextHref).toBe('/login');
    expect(workflow.canContinue).toBe(true);
  });

  it.each(['rejected', 'expired'] as const)('closes a %s workflow without a continuation action', (status) => {
    const workflow = buildRegistrationWorkflow(baseUser, { status }, 1, 3);
    expect(workflow.status).toBe('closed');
    expect(workflow.nextHref).toBeNull();
    expect(workflow.canContinue).toBe(false);
    expect(workflow.queuePosition).toBeNull();
  });
});

import type { UserRecord } from './userStore.js';
import type { OnboardingStatus } from './onboardingStore.js';

export type RegistrationStepStatus = 'complete' | 'current' | 'waiting' | 'blocked';

export type RegistrationWorkflowStep = {
  key: 'profile' | 'email' | 'evidence' | 'submission' | 'review' | 'approval';
  label: string;
  status: RegistrationStepStatus;
  href?: string;
};

type CaseSummary = { status: OnboardingStatus } | null;

export function buildRegistrationWorkflow(
  user: Pick<UserRecord, 'status' | 'emailVerified' | 'kycStatus' | 'amlStatus'>,
  onboardingCase: CaseSummary,
  evidenceCount: number,
  queuePosition: number | null,
) {
  const caseStatus = onboardingCase?.status ?? 'draft';
  const terminal = user.status === 'rejected' || caseStatus === 'rejected' || caseStatus === 'expired';
  const needsInformation = caseStatus === 'needs_info';
  const submitted = ['submitted', 'under_review', 'needs_info', 'approved'].includes(caseStatus);
  const reviewed = caseStatus === 'approved' && user.kycStatus === 'approved';
  const complete = user.status === 'active';

  const steps: RegistrationWorkflowStep[] = [
    { key: 'profile', label: 'Profile created', status: 'complete' },
    { key: 'email', label: 'Email verified', status: user.emailVerified ? 'complete' : terminal ? 'blocked' : 'current', href: '/login' },
    { key: 'evidence', label: 'Verification reference', status: needsInformation ? 'current' : evidenceCount > 0 ? 'complete' : terminal ? 'blocked' : user.emailVerified ? 'current' : 'waiting', href: '/onboarding' },
    { key: 'submission', label: 'Application submitted', status: submitted ? 'complete' : terminal ? 'blocked' : evidenceCount > 0 ? 'current' : 'waiting', href: '/onboarding' },
    { key: 'review', label: 'Compliance review', status: reviewed ? 'complete' : terminal ? 'blocked' : submitted && !needsInformation ? 'current' : 'waiting' },
    { key: 'approval', label: 'Registration decision', status: complete ? 'complete' : terminal ? 'blocked' : reviewed ? 'current' : 'waiting' },
  ];

  const current = steps.find((step) => step.status === 'current');
  return {
    status: terminal ? 'closed' : complete ? 'complete' : reviewed ? 'awaiting_final_approval' : submitted && !needsInformation ? 'queued' : 'in_progress',
    queuePosition: submitted && !needsInformation && !complete && !terminal ? queuePosition : null,
    currentStep: current?.key ?? (complete ? 'approval' : 'profile'),
    nextHref: current?.href ?? (complete ? '/dashboard' : null),
    canContinue: Boolean(current?.href),
    steps,
  } as const;
}

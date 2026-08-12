import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export interface InternalSponsorDraft {
  controlKey:
    | 'consumer_kyc_policy'
    | 'signed_webhooks'
    | 'complaints_resolution'
    | 'authoritative_ledger'
    | 'privileged_access'
    | 'restore_test';
  title: string;
  owner: string;
  sourceFile: string;
  reference: string;
  sha256: string;
  notes: string;
}

const SOURCES = [
  {
    controlKey: 'consumer_kyc_policy' as const,
    title: 'Customer onboarding and provider-verification control plane',
    owner: 'Compliance',
    sourceFile: 'docs/ONBOARDING-CONTROL-PLANE.md',
  },
  {
    controlKey: 'signed_webhooks' as const,
    title: 'Signed onboarding-provider webhook controls',
    owner: 'Security',
    sourceFile: 'docs/ONBOARDING-CONTROL-PLANE.md',
  },
  {
    controlKey: 'complaints_resolution' as const,
    title: 'Complaints handling and escalation procedure',
    owner: 'Compliance',
    sourceFile: 'docs/COMPLAINTS-PROCEDURE.md',
  },
  {
    controlKey: 'authoritative_ledger' as const,
    title: 'Ledger-of-record boundary and external dependency register',
    owner: 'Finance',
    sourceFile: 'docs/PRODUCTION-READINESS-GAP-ANALYSIS.md',
  },
  {
    controlKey: 'privileged_access' as const,
    title: 'Privileged administration and separation-of-duties control inventory',
    owner: 'Security',
    sourceFile: 'docs/PROJECT-COMPLETION-REGISTER.md',
  },
  {
    controlKey: 'restore_test' as const,
    title: 'Backup and isolated-restore test runbook',
    owner: 'Security',
    sourceFile: 'docs/BACKUP-RECOVERY.md',
  },
] as const;

export function buildInternalSponsorDrafts(root = process.cwd()): InternalSponsorDraft[] {
  return SOURCES.map(source => {
    const content = fs.readFileSync(path.resolve(root, source.sourceFile));
    const sha256 = crypto.createHash('sha256').update(content).digest('hex');
    return {
      ...source,
      reference: `repo:${source.sourceFile}:${sha256.slice(0, 16)}`,
      sha256,
      notes: source.controlKey === 'authoritative_ledger'
        ? 'Draft boundary and gap evidence only. A contracted authoritative ledger, sponsor approval, reconciliation design and operating evidence remain outstanding.'
        : source.controlKey === 'privileged_access'
          ? 'Draft technical control inventory only. Independent access review, periodic recertification, sponsor approval and operating evidence remain outstanding.'
          : source.controlKey === 'restore_test'
            ? 'Draft recovery design only. A completed isolated restore, measured RPO/RTO, control-owner approval and sponsor acceptance remain outstanding.'
            : 'Draft internal engineering evidence only. Sponsor, counsel, control-owner approval and operating evidence remain outstanding.',
    };
  });
}

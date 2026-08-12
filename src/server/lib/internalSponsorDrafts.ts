import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export interface InternalSponsorDraft {
  controlKey: 'consumer_kyc_policy' | 'signed_webhooks' | 'complaints_resolution';
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
] as const;

export function buildInternalSponsorDrafts(root = process.cwd()): InternalSponsorDraft[] {
  return SOURCES.map(source => {
    const content = fs.readFileSync(path.resolve(root, source.sourceFile));
    const sha256 = crypto.createHash('sha256').update(content).digest('hex');
    return {
      ...source,
      reference: `repo:${source.sourceFile}:${sha256.slice(0, 16)}`,
      sha256,
      notes: 'Draft internal engineering evidence only. Sponsor, counsel, control-owner approval and operating evidence remain outstanding.',
    };
  });
}


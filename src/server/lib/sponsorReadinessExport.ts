import { strToU8, Zip, ZipDeflate } from 'fflate';
import type { buildSponsorReadinessSnapshot } from './sponsorReadinessStore.js';
import { OPERATIONAL_PROCEDURES } from './operationalProcedures.js';

type Snapshot = ReturnType<typeof buildSponsorReadinessSnapshot>;
const FIXED_MTIME = new Date('2026-01-01T00:00:00.000Z');

function csvCell(value: unknown): string {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
function csv(rows: unknown[][]): string { return rows.map(row => row.map(csvCell).join(',')).join('\n') + '\n'; }
function heading(snapshot: Snapshot, title: string): string {
  return `# ${title}\n\n> ${snapshot.summary.sponsorSubmissionReady ? 'SPONSOR SUBMISSION READY' : 'DRAFT — NOT APPROVED FOR LAUNCH'}\n\n`;
}

export function buildSponsorPackFiles(snapshot: Snapshot): Record<string, string> {
  const p = snapshot.productProfile;
  const gaps = snapshot.gaps.length
    ? snapshot.gaps.map((gap, index) => `${index + 1}. **${gap.title}** — ${gap.status}; owner: ${gap.ownerRole}`).join('\n')
    : 'No outstanding required controls at export time.';
  const phaseLines = p.phases.map(phase => `## Phase ${phase.phase}: ${phase.name}\n\n${phase.scope}`).join('\n\n');
  const manifest = snapshot.evidence.map(item => ({
    id: item.id, controlKey: item.controlKey, title: item.title,
    status: item.effectiveStatus, referenceType: item.referenceType,
    reference: item.reference, sha256: item.sha256, owner: item.owner,
    revision: item.revision, submittedRevision: item.submittedRevision, reviewedRevision: item.reviewedRevision,
    issuedAt: item.issuedAt?.toISOString() ?? null, expiresAt: item.expiresAt?.toISOString() ?? null,
  }));
  const externalEvidenceRows = snapshot.externalEvidenceRequirements.map(item => [
    item.controlKey,
    snapshot.controls.find(control => control.key === item.controlKey)?.title ?? item.controlKey,
    item.status,
    item.responsibleFunction,
    item.requestedFrom,
    item.nextAction,
    item.prerequisite,
    item.authority,
    item.minimumAcceptance,
    item.insufficientEvidence,
  ]);
  const externalRequestSections = snapshot.externalEvidenceRequirements.map((item, index) =>
    `## ${index + 1}. ${snapshot.controls.find(control => control.key === item.controlKey)?.title ?? item.controlKey}\n\n` +
    `- **Control key:** \`${item.controlKey}\`\n` +
    `- **Current status:** ${item.status}\n` +
    `- **Responsible function:** ${item.responsibleFunction}\n` +
    `- **Request from:** ${item.requestedFrom}\n` +
    `- **Prerequisite:** ${item.prerequisite}\n` +
    `- **Next action:** ${item.nextAction}\n` +
    `- **Minimum acceptance:** ${item.minimumAcceptance}\n` +
    `- **Reject as insufficient:** ${item.insufficientEvidence}\n`,
  ).join('\n');
  return {
    'README.md': heading(snapshot, 'City Gate Capital UK Sponsor Readiness Pack') +
      `Package: ${snapshot.package.id} v${snapshot.package.version}\n\nThis pack contains evidence metadata and hashes only. It contains no credentials, identity documents, customer data, source documents or live-provider adapters. Evidence approval cannot enable financial operations.\n`,
    '01-executive-proposition.md': heading(snapshot, 'Executive Proposition') +
      `City Gate Capital proposes a sponsor-led UK programme for individuals and businesses across ${p.currencies.join(', ')}. FX and payments will be executed by contracted providers, with the sponsor/core ledger authoritative. The legal entity is unverified pending approved ownership evidence. Cards and crypto are excluded.\n`,
    '02-phased-product-scope.md': heading(snapshot, 'Phased Product Scope') + phaseLines + '\n',
    '03-flow-of-funds.md': heading(snapshot, 'Provider-Authoritative Flows') +
      `## Onboarding\n\nCustomer → City Gate orchestration → KYC/KYB and screening provider → sponsor account decision.\n\n` +
      `## Safeguarded funding\n\nCustomer bank → sponsor-designated safeguarded account → sponsor/core ledger → read-only City Gate display.\n\n` +
      `## FX and payout\n\nCity Gate request → provider quote → customer confirmation → screening → provider conversion/execution → signed webhook → ledger posting → daily reconciliation.\n\n` +
      `## Reversals\n\nProvider reversal/return → signed event → ledger corrective entry → customer notification → reconciliation closure. No City Gate database balance is authoritative.\n`,
    '04-responsibility-matrix.csv': csv([
      ['Capability', 'Sponsor/Core', 'City Gate Capital', 'Specialist provider'],
      ['Regulatory permissions', 'Accountable/authoritative', 'Operate within approved programme', 'Support contracted scope'],
      ['Safeguarding', 'Approve and control structure', 'Reconcile and escalate', 'Supply statements/events'],
      ['KYC/KYB and screening', 'Approve policy/risk appetite', 'Orchestrate and review exceptions', 'Execute checks'],
      ['FX and payments', 'Approve corridors and controls', 'Present and orchestrate', 'Quote, screen and execute'],
      ['Ledger and reconciliation', 'Authoritative record', 'Sub-ledger/reconciliation operations', 'Provide immutable identifiers'],
    ]),
    '05-control-evidence-register.csv': csv([
      ['Control key', 'Category', 'Phase', 'Required', 'Owner role', 'Status', 'Evidence ID revisions'],
      ...snapshot.controls.map(control => [control.key, control.category, control.phase, control.required, control.ownerRole, control.status, control.evidence.map(item => `${item.id}@v${item.revision}`).join(';')]),
    ]),
    '06-provider-integration-spec.md': heading(snapshot, 'Provider Integration Specification') +
      `All provider commands require idempotency and correlation identifiers. All state-changing webhooks require signature, timestamp and event-ID verification with replay protection. Payment states include pending, accepted, rejected, failed and reversed. Provider payment, posting-batch and reconciliation identifiers must remain traceable end-to-end. Daily reconciliation must compare provider statements, safeguarded accounts and the City Gate sub-ledger, with breaks escalated under approved thresholds. Live adapters are not implemented in this package.\n`,
    '07-sponsor-rfp.md': heading(snapshot, 'Sponsor RFP Questionnaire') +
      `1. Which permissions, agency model and customer disclosures apply?\n2. Which safeguarding structure and reconciliation timetable are required?\n3. Which UK, SEPA and international corridors are supported and individually approvable?\n4. Which KYC/KYB, sanctions, monitoring and case-management providers are mandated?\n5. What are the authoritative ledger, webhook, idempotency and reversal requirements?\n6. What reporting, audit, capital, complaints and wind-down obligations apply?\n7. What security testing, incident notification, resilience and recovery evidence is required?\n`,
    '08-gaps-and-dependencies.md': heading(snapshot, 'Current Gaps and Dependencies') + gaps + '\n',
    '30-external-evidence-acquisition-register.csv': csv([
      ['Control key', 'Required evidence', 'Current status', 'Responsible function', 'Request from', 'Next action', 'Prerequisite', 'Authoritative source', 'Minimum acceptance', 'Insufficient evidence'],
      ...externalEvidenceRows,
    ]),
    '31-external-evidence-request-pack.md': heading(snapshot, 'External Evidence Request Pack') +
      `Use this routing pack to obtain authoritative evidence; it is not evidence and cannot be approved in place of a source document. Send source documents only through an approved restricted repository. Do not email credentials, identity documents or customer data, and do not upload original documents to the sponsor-readiness workspace. After authenticity review, record only the controlled reference, SHA-256 hash, owner, dates and non-sensitive notes.\n\n` +
      externalRequestSections,
    ...OPERATIONAL_PROCEDURES,
    'evidence-manifest.json': JSON.stringify({
      packageId: snapshot.package.id,
      packageVersion: snapshot.package.version,
      status: snapshot.summary.sponsorSubmissionReady ? 'sponsor-submission-ready' : 'draft-not-approved-for-launch',
      generatedFromMetadataOnly: true,
      originalDocumentsIncluded: false,
      credentialsIncluded: false,
      financialOperationsLocked: true,
      externalEvidenceRequirements: snapshot.externalEvidenceRequirements.map(item => ({
        controlKey: item.controlKey,
        status: item.status,
        responsibleFunction: item.responsibleFunction,
        requestedFrom: item.requestedFrom,
        nextAction: item.nextAction,
        prerequisite: item.prerequisite,
        authority: item.authority,
        minimumAcceptance: item.minimumAcceptance,
        insufficientEvidence: item.insufficientEvidence,
      })),
      evidence: manifest,
    }, null, 2) + '\n',
  };
}

export function buildSponsorPackZip(snapshot: Snapshot): Uint8Array {
  const files = buildSponsorPackFiles(snapshot);
  const chunks: Uint8Array[] = [];
  let archiveError: Error | null = null;
  const archive = new Zip((error, data) => {
    if (error) archiveError = error;
    else if (data.length) chunks.push(data);
  });
  for (const name of Object.keys(files).sort()) {
    const entry = new ZipDeflate(name, { level: 6 });
    entry.mtime = FIXED_MTIME;
    archive.add(entry);
    entry.push(strToU8(files[name]), true);
  }
  archive.end();
  if (archiveError) throw archiveError;
  const length = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result;
}

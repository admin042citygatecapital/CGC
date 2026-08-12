import { closeConnection } from '../src/server/db/db.js';
import { buildInternalSponsorDrafts } from '../src/server/lib/internalSponsorDrafts.js';
import { getSponsorReadiness, saveSponsorEvidence } from '../src/server/lib/sponsorReadinessStore.js';

async function run() {
  const drafts = buildInternalSponsorDrafts();
  if (!process.argv.includes('--apply')) {
    console.log(JSON.stringify({ mode: 'dry-run', count: drafts.length, drafts }));
    return;
  }
  const actorId = String(process.env.SPONSOR_DRAFT_ACTOR_ID ?? '').trim();
  const actorEmail = String(process.env.SPONSOR_DRAFT_ACTOR_EMAIL ?? '').trim().toLowerCase();
  if (actorId.length < 3 || !actorEmail.includes('@')) throw new Error('SPONSOR_DRAFT_ACTOR_ID and SPONSOR_DRAFT_ACTOR_EMAIL are required.');
  const actor = { id: actorId, email: actorEmail, role: 'SUPER_ADMIN' as const };
  const snapshot = await getSponsorReadiness(actor);
  const existingControls = new Set(snapshot.evidence.map(item => item.controlKey));
  const created: string[] = [];
  const skipped: string[] = [];
  for (const draft of drafts) {
    if (existingControls.has(draft.controlKey)) {
      skipped.push(draft.controlKey);
      continue;
    }
    await saveSponsorEvidence({
      controlKey: draft.controlKey,
      title: draft.title,
      referenceType: 'internal',
      reference: draft.reference,
      sha256: draft.sha256,
      owner: draft.owner,
      notes: draft.notes,
    }, actor);
    created.push(draft.controlKey);
  }
  console.log(JSON.stringify({ mode: 'apply', created, skipped }));
}

run().catch(error => {
  console.error(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
  process.exitCode = 1;
}).finally(() => closeConnection());


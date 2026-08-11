import type { Request, Response } from 'express';
import { reviewBeneficialOwner, saveBeneficialOwner, submitBeneficialOwner } from '../../../../lib/legalEntityVerificationStore.js';
import { sponsorActor } from '../../../../lib/sponsorReadinessHttp.js';

export default async function handler(req: Request, res: Response) {
  try {
    const actor = sponsorActor(req); const action = String(req.body?.action ?? 'save');
    if (action === 'save') return res.json({ ok: true, data: await saveBeneficialOwner(req.body, actor) });
    const id = String(req.body?.id ?? ''); if (!id) return res.status(400).json({ error: 'Owner record id is required.' });
    if (action === 'submit') return res.json({ ok: true, data: await submitBeneficialOwner(id, actor) });
    if (action === 'review') {
      const decision = String(req.body?.decision ?? '');
      if (!['verified','rejected'].includes(decision)) return res.status(400).json({ error: 'Decision must be verified or rejected.' });
      return res.json({ ok: true, data: await reviewBeneficialOwner(id, decision as 'verified'|'rejected', String(req.body?.note ?? ''), actor) });
    }
    return res.status(400).json({ error: 'Unknown action.' });
  } catch (error) { const typed = error as Error & { status?: number; code?: string }; return res.status(typed.status ?? 500).json({ error: typed.message, code: typed.code }); }
}

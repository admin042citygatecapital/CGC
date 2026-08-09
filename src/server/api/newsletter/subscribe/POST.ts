import type { Request, Response } from 'express';
import { addSubscriber, findSubscriberByEmail } from '../../../lib/subscriberStore.js';
import { createOperationsItem } from '../../../lib/operationsInboxStore.js';
import { requireIntakeEnabled } from '../../../lib/operationalControls.js';

const VALID_SOURCES = new Set<string>([
  'footer', 'homepage_hero', 'accounts_page', 'contact_page', 'unknown',
]);

export default async function handler(req: Request, res: Response) {
  try {
    if (!requireIntakeEnabled(res, 'newsletterSignupEnabled')) return;
    const { email, name, source } = req.body as {
      email?: string;
      name?: string;
      source?: string;
    };

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email is required' });
    }

    const safeSource = VALID_SOURCES.has(source ?? '') ? source! : 'unknown';

    // Re-subscribe if previously unsubscribed
    const existing = await findSubscriberByEmail(email);
    if (existing?.status === 'active') {
      return res.status(200).json({ ok: true, alreadySubscribed: true });
    }

    const subscriber = await addSubscriber(
      email.trim().toLowerCase(),
      name ? String(name).slice(0, 100).trim() : undefined,
      safeSource,
    );

    createOperationsItem({
      source: 'newsletter_signup', referenceId: subscriber.id, title: 'Newsletter signup',
      summary: `New newsletter subscriber from ${safeSource}.`, requesterName: subscriber.name,
      requesterEmail: subscriber.email, priority: 'low', metadata: { source: safeSource },
    });

    return res.status(201).json({ ok: true, id: subscriber.id });
  } catch (err) {
    console.error('newsletter.subscribe.error', err);
    return res.status(500).json({ error: 'Failed to subscribe' });
  }
}

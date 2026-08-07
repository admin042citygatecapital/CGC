import type { Request, Response } from 'express';
import fs from 'node:fs';
import type { AnalyticsEvent } from '../event/POST.js';

const DATA_FILE = '/private/analytics/events.jsonl';

function readEvents(): AnalyticsEvent[] {
  if (!fs.existsSync(DATA_FILE)) return [];
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  const events: AnalyticsEvent[] = [];
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (t) { try { events.push(JSON.parse(t) as AnalyticsEvent); } catch { /* skip */ } }
  }
  return events;
}

interface VariantStats {
  variant: string;
  impressions: number;
  conversions: number;
  conversionRate: number;
  /** Lift vs control (percentage points), null for control itself */
  liftVsControl: number | null;
  /** Rough confidence: 'low' <50 impressions, 'medium' <200, 'high' >=200 */
  confidence: 'low' | 'medium' | 'high';
}

interface ExperimentResult {
  experimentId: string;
  totalImpressions: number;
  totalConversions: number;
  variants: VariantStats[];
  /** Variant with highest conversion rate */
  winner: string | null;
}

export default function handler(req: Request, res: Response) {
  try {
    const days = Math.min(Number(req.query.days ?? 30), 365);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const all = readEvents().filter(e => new Date(e.timestamp) >= since);
    const abEvents = all.filter(e => e.type === 'ab_impression' || e.type === 'ab_conversion');

    // Group by experiment → variant → { impressions, conversions }
    const experiments = new Map<string, Map<string, { impressions: number; conversions: number }>>();

    for (const event of abEvents) {
      const expId = String(event.meta?.experiment ?? 'unknown');
      const variant = String(event.meta?.variant ?? 'unknown');

      if (!experiments.has(expId)) experiments.set(expId, new Map());
      const variantMap = experiments.get(expId)!;
      if (!variantMap.has(variant)) variantMap.set(variant, { impressions: 0, conversions: 0 });

      const stats = variantMap.get(variant)!;
      if (event.type === 'ab_impression') stats.impressions++;
      if (event.type === 'ab_conversion') stats.conversions++;
    }

    const results: ExperimentResult[] = [];

    for (const [experimentId, variantMap] of experiments.entries()) {
      const variantEntries = Array.from(variantMap.entries());

      // Control is the first variant alphabetically that contains 'control',
      // or the first variant if none does.
      const controlEntry = variantEntries.find(([v]) => v === 'control') ?? variantEntries[0];
      const controlRate = controlEntry
        ? (controlEntry[1].conversions / Math.max(controlEntry[1].impressions, 1))
        : 0;

      const variants: VariantStats[] = variantEntries.map(([variant, { impressions, conversions }]): VariantStats => {
        const rate = conversions / Math.max(impressions, 1);
        const isControl = variant === (controlEntry?.[0] ?? '');
        return {
          variant,
          impressions,
          conversions,
          conversionRate: Math.round(rate * 10000) / 100, // e.g. 12.34
          liftVsControl: isControl ? null : Math.round((rate - controlRate) * 10000) / 100,
          confidence: (impressions >= 200 ? 'high' : impressions >= 50 ? 'medium' : 'low') as 'low' | 'medium' | 'high',
        };
      }).sort((a, b) => b.impressions - a.impressions);

      const totalImpressions = variants.reduce((s, v) => s + v.impressions, 0);
      const totalConversions = variants.reduce((s, v) => s + v.conversions, 0);

      // Winner: highest conversion rate among variants with >=50 impressions
      const eligible = variants.filter(v => v.impressions >= 50);
      const winner = eligible.length > 1
        ? eligible.reduce((best, v) => v.conversionRate > best.conversionRate ? v : best).variant
        : null;

      results.push({ experimentId, totalImpressions, totalConversions, variants, winner });
    }

    // Sort by total impressions desc
    results.sort((a, b) => b.totalImpressions - a.totalImpressions);

    res.json({ period: { days, since: since.toISOString() }, experiments: results });
  } catch (err) {
    console.error('analytics.ab-results.error', err);
    res.status(500).json({ error: 'Failed to load A/B results' });
  }
}

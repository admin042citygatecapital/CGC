import type { Request, Response } from 'express';
import {
  MAX_REPORT_DAYS,
  parseReportDays,
  readEventsFile,
  reportWindowStartUtc,
} from '../reportShared.js';

/** Minimum impressions before a variant may be crowned a leader. */
const MIN_IMPRESSIONS_FOR_WINNER = 50;

interface VariantStats {
  variant: string;
  impressions: number;
  conversions: number;
  conversionRate: number;
  /** Lift vs control (percentage points), null for control itself */
  liftVsControl: number | null;
  /**
   * Sample-size tier based on impressions only: 'low' <50, 'medium' <200,
   * 'high' >=200. This is a traffic-volume label, NOT statistical confidence —
   * it says nothing about whether the observed difference is significant.
   */
  sampleTier: 'low' | 'medium' | 'high';
}

interface ExperimentResult {
  experimentId: string;
  totalImpressions: number;
  totalConversions: number;
  variants: VariantStats[];
  /**
   * Variant with the highest conversion rate among variants with at least
   * MIN_IMPRESSIONS_FOR_WINNER impressions, provided there are at least two
   * eligible variants and no tie for the top rate. Null otherwise — a
   * single-variant, low-traffic, or tied experiment has no leader.
   */
  winner: string | null;
}

export default function handler(req: Request, res: Response) {
  try {
    const days = parseReportDays(req);
    if (days === null) {
      return res.status(400).json({ error: `days must be an integer between 1 and ${MAX_REPORT_DAYS}` });
    }
    const since = reportWindowStartUtc(days);

    const { events: all, malformedLines } = readEventsFile();
    const filtered = all.filter(e => new Date(e.timestamp) >= since);
    const abEvents = filtered.filter(e => e.type === 'ab_impression' || e.type === 'ab_conversion');

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

      // Control is the variant named 'control', or the first variant seen if
      // none is named that.
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
          sampleTier: (impressions >= 200 ? 'high' : impressions >= 50 ? 'medium' : 'low') as 'low' | 'medium' | 'high',
        };
      }).sort((a, b) => b.impressions - a.impressions);

      const totalImpressions = variants.reduce((s, v) => s + v.impressions, 0);
      const totalConversions = variants.reduce((s, v) => s + v.conversions, 0);

      // Leader: highest conversion rate among sufficiently sampled variants,
      // with at least two of them. A tie for the top rate means no leader —
      // the data does not distinguish the variants.
      const eligible = variants.filter(v => v.impressions >= MIN_IMPRESSIONS_FOR_WINNER);
      let winner: string | null = null;
      if (eligible.length > 1) {
        const topRate = Math.max(...eligible.map(v => v.conversionRate));
        const leaders = eligible.filter(v => v.conversionRate === topRate);
        if (leaders.length === 1) winner = leaders[0].variant;
      }

      results.push({ experimentId, totalImpressions, totalConversions, variants, winner });
    }

    // Sort by total impressions desc
    results.sort((a, b) => b.totalImpressions - a.totalImpressions);

    res.json({
      period: { days, since: since.toISOString(), timezone: 'UTC' },
      experiments: results,
      dataQuality: { malformedLines },
    });
  } catch (err) {
    console.error('analytics.ab-results.error', err);
    res.status(500).json({ error: 'Failed to load A/B results' });
  }
}
import type { Request, Response } from 'express';
import { getQueryClient } from '../../../db/db.js';
import { loadBeneficiaries } from '../beneficiaries/GET.js';

const HELP = [
  { id: 'transfers', title: 'Sending and tracking transfers', keywords: 'transfer recipient beneficiary status reference', href: '/dashboard/support' },
  { id: 'cards', title: 'Managing card security controls', keywords: 'card freeze limit security replace', href: '/dashboard/support' },
  { id: 'statements', title: 'Finding statements and transaction documents', keywords: 'statement document export csv pdf transaction', href: '/dashboard/statements' },
  { id: 'security', title: 'Protecting your account and devices', keywords: 'security password device session two factor login', href: '/dashboard/security' },
];

export default async function handler(req: Request, res: Response) {
  const customer = req.customerUser;
  if (!customer) return res.status(401).json({ error: 'Authentication required' });
  const query = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 80) : '';
  if (query.length < 2) return res.json({ query, results: [] });
  try {
    const sql = getQueryClient();
    const pattern = `%${query}%`;
    const [transactions, conversations, statementPeriods] = await Promise.all([
      sql`SELECT id,reference,description,amount,currency,status,created_at FROM transactions WHERE user_id=${customer.id} AND (reference ILIKE ${pattern} OR description ILIKE ${pattern}) ORDER BY created_at DESC LIMIT 10`,
      sql`SELECT id,subject,status,updated_at FROM support_conversations WHERE user_id=${customer.id} AND subject ILIKE ${pattern} ORDER BY updated_at DESC LIMIT 5`,
      sql`SELECT to_char(date_trunc('month',created_at),'YYYY-MM') AS period, COUNT(*)::int AS transaction_count, string_agg(DISTINCT currency, ', ' ORDER BY currency) AS currencies FROM transactions WHERE user_id=${customer.id} GROUP BY date_trunc('month',created_at) ORDER BY date_trunc('month',created_at) DESC LIMIT 24`,
    ]);
    const normalized = query.toLowerCase();
    const beneficiaries = loadBeneficiaries(customer.beneficiaries).filter(item => [item.name,item.bankName,item.currency,item.country].some(value => value.toLowerCase().includes(normalized))).slice(0, 8);
    const help = HELP.filter(item => `${item.title} ${item.keywords}`.toLowerCase().includes(normalized)).slice(0, 5);
    const statements = statementPeriods.flatMap(row => {
      const period = String(row.period);
      const [year, month] = period.split('-').map(Number);
      const label = Number.isInteger(year) && Number.isInteger(month)
        ? new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
        : period;
      const searchable = `${label} statement document report ${row.currencies ?? ''}`.toLowerCase();
      return searchable.includes(normalized) ? [{
        type: 'statement', id: period, title: `${label} statement`,
        description: `${row.transaction_count} transactions · ${row.currencies || 'Account activity'}`,
        href: `/dashboard/statements?period=${encodeURIComponent(period)}`,
      }] : [];
    });
    const results = [
      ...transactions.map(row => ({ type: 'transaction', id: row.id, title: row.description, description: `${row.reference} · ${row.currency} ${Number(row.amount).toLocaleString()} · ${row.status}`, href: `/dashboard/statements?transaction=${encodeURIComponent(row.id)}`, occurredAt: row.created_at })),
      ...statements,
      ...beneficiaries.map(item => ({ type: 'beneficiary', id: item.id, title: item.name, description: `${item.bankName || 'Recipient'} · ${item.currency} · ${item.verificationState}`, href: '/dashboard/beneficiaries' })),
      ...conversations.map(row => ({ type: 'support', id: row.id, title: row.subject, description: `Support case · ${row.status}`, href: '/dashboard/support', occurredAt: row.updated_at })),
      ...help.map(item => ({ type: 'help', id: item.id, title: item.title, description: 'Help article', href: item.href })),
    ].slice(0, 25);
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ query, results });
  } catch (error) {
    console.error('customer.search.error', { customerId: customer.id, errorType: error instanceof Error ? error.name : 'UnknownError' });
    return res.status(500).json({ error: 'Search is temporarily unavailable.' });
  }
}

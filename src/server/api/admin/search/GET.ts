import type { Request, Response } from 'express';
import { getQueryClient } from '../../../db/db.js';
import { escapeLikePattern } from '../../../lib/inputValidator.js';

export default async function handler(req: Request, res: Response) {
  const query = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 80) : '';
  if (query.length < 2) return res.json({ query, results: [] });
  try {
    const sql = getQueryClient();
    const pattern = `%${escapeLikePattern(query)}%`;
    const [customers, transactions, cards, accounts, support] = await Promise.all([
      sql`SELECT id,name,email,status,kyc_status FROM users WHERE name ILIKE ${pattern} OR email ILIKE ${pattern} OR id ILIKE ${pattern} ORDER BY updated_at DESC LIMIT 6`,
      sql`SELECT id,reference,description,user_name,user_email,status,type FROM transactions WHERE reference ILIKE ${pattern} OR description ILIKE ${pattern} OR user_name ILIKE ${pattern} OR user_email ILIKE ${pattern} ORDER BY created_at DESC LIMIT 8`,
      sql`SELECT id,cardholder_name,last4,status,type FROM cards WHERE cardholder_name ILIKE ${pattern} OR last4 ILIKE ${pattern} OR id ILIKE ${pattern} ORDER BY updated_at DESC LIMIT 6`,
      sql`SELECT a.id,a.label,a.account_type,a.status,a.primary_currency,u.name,u.email FROM customer_accounts a JOIN users u ON u.id=a.user_id WHERE a.label ILIKE ${pattern} OR a.id ILIKE ${pattern} OR u.name ILIKE ${pattern} OR u.email ILIKE ${pattern} ORDER BY a.updated_at DESC LIMIT 6`,
      sql`SELECT id,subject,user_name,user_email,status,priority FROM support_conversations WHERE subject ILIKE ${pattern} OR user_name ILIKE ${pattern} OR user_email ILIKE ${pattern} ORDER BY updated_at DESC LIMIT 6`,
    ]);
    const results = [
      ...customers.map(row => ({ type:'customer',id:row.id,label:row.name,description:`${row.email} · ${row.status} · KYC ${row.kyc_status}`,href:`/admin/users?customer=${encodeURIComponent(row.id)}` })),
      ...transactions.map(row => ({ type:String(row.type).includes('transfer')?'transfer':'transaction',id:row.id,label:row.description,description:`${row.reference} · ${row.user_name} · ${row.status}`,href:`/admin/transactions?transaction=${encodeURIComponent(row.id)}` })),
      ...cards.map(row => ({ type:'card',id:row.id,label:`${row.cardholder_name} · •••• ${row.last4}`,description:`${row.type} card · ${row.status}`,href:`/admin/cards?card=${encodeURIComponent(row.id)}` })),
      ...accounts.map(row => ({ type:'account',id:row.id,label:row.label,description:`${row.name} · ${row.primary_currency} · ${row.status}`,href:`/admin/accounts?account=${encodeURIComponent(row.id)}` })),
      ...support.map(row => ({ type:'support',id:row.id,label:row.subject,description:`${row.user_name} · ${row.priority} · ${row.status}`,href:`/admin/support?case=${encodeURIComponent(row.id)}` })),
    ];
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ query, results });
  } catch (error) {
    console.error('admin.search.error', { errorType: error instanceof Error ? error.name : 'UnknownError' });
    return res.status(500).json({ error: 'Search is temporarily unavailable.' });
  }
}

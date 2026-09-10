/**
 * Supabase Client Configuration — City Gate Capital.
 *
 * This client uses the Service Role Key, granting it full administrative access
 * to the database, bypassing Row Level Security (RLS). This is intended for
 * server-side operations and administrative tasks.
 */

import { createClient } from '@supabase/supabase-js';
import { getSecret } from '#runtime/secrets';

const supabaseUrl = String(
  getSecret('SUPABASE_URL') ||
  process.env.SUPABASE_URL ||
  ''
).trim();

const supabaseServiceKey = String(
  getSecret('SUPABASE_SERVICE_ROLE_KEY') ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  ''
).trim();

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('Supabase configuration missing: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set.');
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

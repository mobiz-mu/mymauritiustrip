import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Service-role client. BYPASSES RLS. Never import this into client components.
// Use only for trusted server jobs (cron, webhooks, admin-only operations
// that must read across tenants). Most code should use lib/supabase/server.ts.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

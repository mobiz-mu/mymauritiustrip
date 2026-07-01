import { requireRole } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { LogoutButton } from '@/components/LogoutButton';

export const dynamic = 'force-dynamic';

const STATUS: Record<string, string> = {
  pending_review: 'bg-blue-100 text-blue-800',
  published: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  hidden: 'bg-amber-100 text-amber-800',
  suspended: 'bg-red-100 text-red-800',
  draft: 'bg-slate-100 text-slate-700',
};

export default async function AdminListings() {
  await requireRole('admin');
  const supabase = await createClient();

  // Pending first, then everything else.
  const { data: pending } = await supabase
    .from('listings')
    .select('id, title, status, created_at')
    .eq('status', 'pending_review')
    .order('created_at', { ascending: true });

  const { data: others } = await supabase
    .from('listings')
    .select('id, title, status, created_at')
    .neq('status', 'pending_review')
    .order('created_at', { ascending: false })
    .limit(50);

  const render = (l: { id: string; title: string; status: string }) => (
    <a
      key={l.id}
      href={`/admin/listings/${l.id}`}
      className="flex items-center justify-between rounded-xl ring-1 ring-slate-200 px-4 py-3 hover:bg-slate-50"
    >
      <span className="font-medium">{l.title}</span>
      <span className={`rounded-full px-2.5 py-0.5 text-xs ${STATUS[l.status] ?? 'bg-slate-100'}`}>{l.status}</span>
    </a>
  );

  return (
    <main className="mx-auto max-w-3xl px-6 py-12 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Listings</h1>
        <LogoutButton />
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-slate-500">Pending review</h2>
        {(!pending || pending.length === 0) && <p className="text-slate-500 text-sm">Nothing pending.</p>}
        {pending?.map(render)}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-slate-500">All listings</h2>
        {others?.map(render)}
      </section>
    </main>
  );
}

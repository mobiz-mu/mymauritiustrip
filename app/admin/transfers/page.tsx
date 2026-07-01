import { requireRole } from '@/lib/auth/guards';
import { LogoutButton } from '@/components/LogoutButton';

export const dynamic = 'force-dynamic';

export default async function AdminTransfersHub() {
  await requireRole('admin');
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Taxi & Transfers (DMC)</h1>
        <LogoutButton />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <a href="/admin/transfers/packages" className="rounded-xl ring-1 ring-slate-200 p-5 hover:bg-slate-50">
          <p className="font-medium">Packages</p>
          <p className="text-sm text-slate-500">Create and manage ready-made transfer / tour packages and prices.</p>
        </a>
        <a href="/admin/transfers/requests" className="rounded-xl ring-1 ring-slate-200 p-5 hover:bg-slate-50">
          <p className="font-medium">Requests & assignments</p>
          <p className="text-sm text-slate-500">Review DMC requests, quote, and assign a verified driver/provider.</p>
        </a>
      </div>
      <p className="mt-6 text-xs text-slate-400">
        Provider contact details are never shared with clients. All communication stays on
        MyMauritiusTrip.com.
      </p>
    </main>
  );
}

'use client';

import { logoutAction } from '@/app/(auth)/actions';

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <button className="rounded-lg ring-1 ring-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">
        Log out
      </button>
    </form>
  );
}

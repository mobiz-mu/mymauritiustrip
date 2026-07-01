import type { ReactNode } from 'react';
import SiteHeader from './SiteHeader';
import PublicFooter from './PublicFooter';

export default function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteHeader />
      <div className="flex-1">{children}</div>
      <PublicFooter />
    </div>
  );
}

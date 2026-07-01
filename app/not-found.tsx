// Trivial, fully static 404. Having an explicit not-found page keeps the build's
// static error-page generation fast and unambiguous (no dynamic APIs, no data).
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold text-ocean">Page not found</h1>
      <p className="text-slate-500">The page you’re looking for doesn’t exist or has moved.</p>
      <a href="/" className="rounded-lg bg-ocean px-4 py-2 text-sm font-semibold text-white">
        Back to home
      </a>
    </main>
  );
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <a href="/" className="text-xl font-semibold text-ocean">
            MyMauritiusTrip<span className="text-turquoise">.com</span>
          </a>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          {children}
        </div>
      </div>
    </div>
  );
}

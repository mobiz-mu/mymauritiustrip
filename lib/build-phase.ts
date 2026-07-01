import 'server-only';

// True ONLY during `next build` — Next sets NEXT_PHASE=phase-production-build
// for the build process (it is 'phase-production-server' at runtime). We use
// this to short-circuit every Supabase read so that NO network work happens
// while Next collects page data / runs its is-page-static checks. Those checks
// can import and evaluate even force-dynamic pages; without this guard a build
// without DB egress stalls at "Collecting page data". At real request time the
// guard is false, so behaviour is unchanged.
export function isBuildPhase(): boolean {
  return process.env.NEXT_PHASE === 'phase-production-build';
}

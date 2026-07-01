import type { IconKey } from '@/lib/home/content';

// Clean, simple line-icons centred in a 24x24 box. Sizing is enforced with
// explicit width/height attributes (not only CSS) so they can never render
// oversized, even if a utility class is purged.
const PATHS: Record<IconKey, string> = {
  villa: 'M4 11l8-6 8 6M6 10v9h12v-9M10 19v-4h4v4',
  car: 'M5 11l1.4-4A2 2 0 018.3 6h7.4a2 2 0 011.9 1.3L19 11M5 11h14v5H5zM5 16v2M19 16v2M8 13.5h.01M16 13.5h.01',
  taxi: 'M5 11l1.4-4A2 2 0 018.3 6h7.4a2 2 0 011.9 1.3L19 11M5 11h14v5H5zM5 16v2M19 16v2M9.5 6V4.5h5V6',
  boat: 'M4 16c1.3.9 2.7.9 4 0s2.7-.9 4 0 2.7.9 4 0 2.7-.9 4 0M6 13l6-1.5L18 13M12 5v6',
  dining: 'M7 4v6m-2-6v6m2 0v10M17 4c-1.2 0-2 1.8-2 4s.8 4 2 4v6',
  compass: 'M12 21a9 9 0 100-18 9 9 0 000 18zM15 9l-1.8 4.2L9 15l1.8-4.2L15 9z',
  plane: 'M11 13L4 11.5l.8-1.6 5 .4 3.4-4.6a1.6 1.6 0 012.5 2l-3 4.3.4 5-1.6.8L11 13z',
  heart: 'M12 19s-6-3.8-6-8a3.4 3.4 0 016-2.2A3.4 3.4 0 0118 11c0 4.2-6 8-6 8z',
  shield: 'M12 4l6 2.5V11c0 3.4-2.5 5.6-6 7.5C8.5 16.6 6 14.4 6 11V6.5L12 4zM9.5 11l1.8 1.8L15 9',
  wallet: 'M5 7h12a2 2 0 012 2v7a2 2 0 01-2 2H5a2 2 0 01-2-2V7zm0 0V6a1.5 1.5 0 011.5-1.5H16M16.5 12.5h.01',
  chat: 'M5 5h14v9H9l-4 3V5zM8.5 9h7M8.5 11.5h4',
  lock: 'M7 10V8a5 5 0 0110 0v2M5.5 10h13v9h-13zM12 14v2.5',
  star: 'M12 4l2.2 4.5 4.8.7-3.5 3.4.8 4.8L12 15.6 7.7 17.4l.8-4.8-3.5-3.4 4.8-.7L12 4z',
  route: 'M6.5 18a1.8 1.8 0 100-3.6 1.8 1.8 0 000 3.6zM17.5 9a1.8 1.8 0 100-3.6 1.8 1.8 0 000 3.6zM8.3 16h6.2a2.7 2.7 0 002.7-2.7V9M6.5 14.2V9a2.4 2.4 0 012.4-2.4h2',
  sun: 'M12 5V3.5M12 20.5V19M19 12h1.5M3.5 12H5M16.9 7.1l1-1M6.1 17.9l1-1M16.9 16.9l1 1M6.1 6.1l1 1M12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7z',
};

export function Icon({ name, size = 20, className }: { name: IconKey; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

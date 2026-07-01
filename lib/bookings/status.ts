export const BOOKING_STATUS_LABEL: Record<string, string> = {
  pending: 'Pending provider response',
  provider_accepted: 'Accepted',
  confirmed: 'Confirmed',
  date_suggested: 'New date suggested',
  provider_rejected: 'Declined by provider',
  client_arrived: 'Guest arrived',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const BOOKING_STATUS_CLASS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  provider_accepted: 'bg-green-100 text-green-800',
  confirmed: 'bg-green-100 text-green-800',
  date_suggested: 'bg-blue-100 text-blue-800',
  provider_rejected: 'bg-red-100 text-red-800',
  client_arrived: 'bg-turquoise/15 text-turquoise',
  completed: 'bg-slate-200 text-slate-700',
  cancelled: 'bg-red-100 text-red-800',
};

export function statusBadge(status: string): string {
  return BOOKING_STATUS_CLASS[status] ?? 'bg-slate-100 text-slate-700';
}
export function statusLabel(status: string): string {
  return BOOKING_STATUS_LABEL[status] ?? status;
}

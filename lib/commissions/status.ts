export const INVOICE_STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  sent: 'Sent',
  pending: 'Awaiting payment',
  submitted: 'Proof under review',
  paid: 'Paid',
  overdue: 'Overdue',
  cancelled: 'Cancelled',
  disputed: 'Disputed',
};

export const INVOICE_STATUS_CLASS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  sent: 'bg-slate-100 text-slate-700',
  pending: 'bg-amber-100 text-amber-800',
  submitted: 'bg-blue-100 text-blue-800',
  paid: 'bg-green-100 text-green-800',
  overdue: 'bg-red-100 text-red-800',
  cancelled: 'bg-slate-200 text-slate-600',
  disputed: 'bg-red-100 text-red-800',
};

export function invoiceBadge(status: string, isOverdue?: boolean): string {
  if (isOverdue && (status === 'pending')) return INVOICE_STATUS_CLASS.overdue;
  return INVOICE_STATUS_CLASS[status] ?? 'bg-slate-100 text-slate-700';
}
export function invoiceLabel(status: string, isOverdue?: boolean): string {
  if (isOverdue && status === 'pending') return 'Overdue';
  return INVOICE_STATUS_LABEL[status] ?? status;
}

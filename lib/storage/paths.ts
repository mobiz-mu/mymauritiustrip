export const BUCKETS = {
  businessDocuments: 'business-documents',
  paymentProofs: 'payment-proofs',
  commissionProofs: 'commission-proofs',
  providerContracts: 'provider-contracts',
} as const;

// Allowed upload types/size for verification artifacts.
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB
export const CONTRACT_MAX_BYTES = 10 * 1024 * 1024; // 10 MB, PDF only
export const CONTRACT_ALLOWED_TYPES = ['application/pdf'];
export const ALLOWED_UPLOAD_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
];

export function sanitizeFilename(name: string): string {
  const dot = name.lastIndexOf('.');
  const base = (dot >= 0 ? name.slice(0, dot) : name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  const ext = dot >= 0 ? name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '') : '';
  return ext ? `${base || 'file'}.${ext}` : base || 'file';
}

// Object path inside a bucket: <business_id>/<timestamp>-<safe-name>
export function buildObjectPath(businessId: string, filename: string): string {
  return `${businessId}/${Date.now()}-${sanitizeFilename(filename)}`;
}

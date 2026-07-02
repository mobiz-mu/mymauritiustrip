'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/guards';
import {
  BUCKETS,
  MAX_UPLOAD_BYTES,
  ALLOWED_UPLOAD_TYPES,
  CONTRACT_MAX_BYTES,
  buildObjectPath,
} from '@/lib/storage/paths';

export type Result = { error?: string; success?: string };
// useActionState starts with `null`, so action reducers must accept it.
type PrevState = Result | null;

async function getOwnBusiness() {
  const profile = await requireRole('provider');
  const supabase = await createClient();
  const { data: business } = await supabase
    .from('businesses')
    .select('id, status')
    .eq('owner_id', profile.id)
    .single();
  return { supabase, business };
}

function validateFile(file: File | null): string | null {
  if (!file || file.size === 0) return 'Please choose a file.';
  if (file.size > MAX_UPLOAD_BYTES) return 'File too large (max 10 MB).';
  if (!ALLOWED_UPLOAD_TYPES.includes(file.type)) {
    return 'Unsupported file type. Use JPG, PNG, WEBP, or PDF.';
  }
  return null;
}

// ---- Upload the Rs 499 payment proof ----
export async function uploadPaymentProof(_prev: PrevState, formData: FormData): Promise<Result> {
  const { supabase, business } = await getOwnBusiness();
  if (!business) return { error: 'No business found for your account.' };
  if (business.status === 'verified') return { error: 'Your business is already verified.' };

  const file = formData.get('file') as File | null;
  const method = (formData.get('method') as string) || 'bank_transfer';
  const fileErr = validateFile(file);
  if (fileErr) return { error: fileErr };

  const path = buildObjectPath(business.id, file!.name);
  const { error: upErr } = await supabase.storage
    .from(BUCKETS.paymentProofs)
    .upload(path, file!, { upsert: false, contentType: file!.type });
  if (upErr) return { error: `Upload failed: ${upErr.message}` };

  // Record starts as 'submitted' — only admin can mark it verified (DB-enforced).
  const { error: insErr } = await supabase.from('business_verification_payments').insert({
    business_id: business.id,
    amount_mur: 499,
    method,
    proof_path: path,
    status: 'submitted',
  });
  if (insErr) return { error: insErr.message };

  revalidatePath('/provider/verification');
  return { success: 'Payment proof uploaded.' };
}

// ---- Upload a required business document ----
export async function uploadDocument(_prev: PrevState, formData: FormData): Promise<Result> {
  const { supabase, business } = await getOwnBusiness();
  if (!business) return { error: 'No business found for your account.' };

  const file = formData.get('file') as File | null;
  const docType = (formData.get('doc_type') as string) || 'other';
  const fileErr = validateFile(file);
  if (fileErr) return { error: fileErr };

  const path = buildObjectPath(business.id, file!.name);
  const { error: upErr } = await supabase.storage
    .from(BUCKETS.businessDocuments)
    .upload(path, file!, { upsert: false, contentType: file!.type });
  if (upErr) return { error: `Upload failed: ${upErr.message}` };

  // Status starts 'pending' — only admin can approve/reject (DB-enforced).
  const { error: insErr } = await supabase.from('business_documents').insert({
    business_id: business.id,
    doc_type: docType,
    storage_path: path,
    status: 'pending',
  });
  if (insErr) return { error: insErr.message };

  revalidatePath('/provider/verification');
  return { success: 'Document uploaded.' };
}

// ---- Submit the verification request (moves business to under_review) ----
export async function submitVerification(_prev: PrevState, _formData: FormData): Promise<Result> {
  await requireRole('provider');
  const supabase = await createClient();
  const { error } = await supabase.rpc('submit_verification_request');
  if (error) return { error: error.message };
  revalidatePath('/provider/verification');
  return { success: 'Submitted for review. We will update your status shortly.' };
}

// ---- Upload the signed provider contract (PDF only) ----
export async function uploadContract(_prev: PrevState, formData: FormData): Promise<Result> {
  const { supabase, business } = await getOwnBusiness();
  if (!business) return { error: 'No business found for your account.' };

  const file = formData.get('file') as File | null;
  if (!file || file.size === 0) return { error: 'Please choose your signed contract PDF.' };
  if (file.type !== 'application/pdf') return { error: 'The contract must be a PDF file.' };
  if (file.size > CONTRACT_MAX_BYTES) return { error: 'File too large (max 10 MB).' };

  const path = buildObjectPath(business.id, file.name);
  const { error: upErr } = await supabase.storage
    .from(BUCKETS.providerContracts)
    .upload(path, file, { upsert: false, contentType: 'application/pdf' });
  if (upErr) return { error: `Upload failed: ${upErr.message}` };

  const { error: insErr } = await supabase.from('provider_contracts').insert({
    business_id: business.id,
    storage_path: path,
    original_filename: file.name.slice(0, 200),
    mime_type: 'application/pdf',
    size_bytes: file.size,
    status: 'pending',
  });
  if (insErr) return { error: insErr.message };

  revalidatePath('/provider/verification');
  revalidatePath('/provider');
  return { success: 'Signed contract uploaded. Pending admin review.' };
}

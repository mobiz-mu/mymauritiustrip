'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/guards';

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

export async function createPackage(formData: FormData) {
  const profile = await requireRole('admin');
  const supabase = await createClient();

  const title = (formData.get('title') as string)?.trim();
  const price = Number(formData.get('base_price_mur'));
  if (!title || !Number.isFinite(price) || price <= 0) {
    redirect('/admin/transfers/packages?error=' + encodeURIComponent('Title and a valid price are required.'));
  }

  const slug = `${slugify(title)}-${Date.now().toString(36)}`;
  const vehicle = (formData.get('vehicle_type') as string) || null;
  const minP = formData.get('min_passengers');
  const maxP = formData.get('max_passengers');

  const { data, error } = await supabase
    .from('transfer_packages')
    .insert({
      slug,
      title,
      pickup_label: (formData.get('pickup_label') as string) || null,
      dropoff_label: (formData.get('dropoff_label') as string) || null,
      duration: (formData.get('duration') as string) || null,
      vehicle_type: vehicle,
      min_passengers: minP ? Number(minP) : null,
      max_passengers: maxP ? Number(maxP) : null,
      base_price_mur: price,
      notes: (formData.get('notes') as string) || null,
      is_active: formData.get('is_active') === 'on',
      created_by: profile.id,
    })
    .select('id')
    .single();

  if (error) {
    redirect('/admin/transfers/packages?error=' + encodeURIComponent(error.message));
  }

  await supabase.rpc('admin_audit', {
    p_action: 'package_created',
    p_entity: 'transfer_package',
    p_entity_id: data!.id,
    p_metadata: null,
  });

  revalidatePath('/admin/transfers/packages');
  redirect('/admin/transfers/packages?ok=' + encodeURIComponent('Package created.'));
}

export async function togglePackage(formData: FormData) {
  await requireRole('admin');
  const supabase = await createClient();
  const id = formData.get('id') as string;
  const next = formData.get('next') === 'true';
  const { error } = await supabase.from('transfer_packages').update({ is_active: next }).eq('id', id);
  if (!error) {
    await supabase.rpc('admin_audit', {
      p_action: next ? 'package_activated' : 'package_deactivated',
      p_entity: 'transfer_package',
      p_entity_id: id,
      p_metadata: null,
    });
  }
  revalidatePath('/admin/transfers/packages');
  redirect('/admin/transfers/packages');
}

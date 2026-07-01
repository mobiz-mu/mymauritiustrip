'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveMedia, deleteMedia, setCover, type MediaInput } from './actions';

type Media = {
  id: string;
  type: 'image' | 'video';
  status: string;
  is_cover: boolean;
  thumbnail_url: string | null;
  url: string;
  caption: string | null;
};

const MAX_IMAGE = 10 * 1024 * 1024;
const MAX_VIDEO = 100 * 1024 * 1024;

export default function MediaManager({
  listingId,
  media,
}: {
  listingId: string;
  media: Media[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [alt, setAlt] = useState('');

  const images = media.filter((m) => m.type === 'image');
  const videos = media.filter((m) => m.type === 'video');

  async function handleFile(file: File) {
    setMsg(null);
    const type: 'image' | 'video' = file.type.startsWith('video') ? 'video' : 'image';

    if (type === 'image' && file.size > MAX_IMAGE) return setMsg('Image exceeds 10 MB.');
    if (type === 'video' && file.size > MAX_VIDEO) return setMsg('Video exceeds 100 MB.');
    if (type === 'image' && images.length >= 12) return setMsg('Maximum 12 photos.');
    if (type === 'video' && videos.length >= 3) return setMsg('Maximum 3 videos.');

    setBusy(true);
    try {
      // 1) Get a signed upload from our server (authorizes + checks limits).
      const signRes = await fetch('/api/cloudinary/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId, resourceType: type }),
      });
      const sign = await signRes.json();
      if (!signRes.ok) throw new Error(sign.error ?? 'Could not authorize upload.');

      // 2) Upload the file straight to Cloudinary.
      const form = new FormData();
      form.append('file', file);
      form.append('api_key', sign.apiKey);
      form.append('timestamp', String(sign.timestamp));
      form.append('folder', sign.folder);
      form.append('signature', sign.signature);

      const upRes = await fetch(`https://api.cloudinary.com/v1_1/${sign.cloudName}/${type}/upload`, {
        method: 'POST',
        body: form,
      });
      const up = await upRes.json();
      if (!upRes.ok) throw new Error(up.error?.message ?? 'Cloudinary upload failed.');

      // 3) Save metadata in our DB (status pending).
      const payload: MediaInput = {
        listingId,
        type,
        public_id: up.public_id,
        secure_url: up.secure_url,
        width: up.width,
        height: up.height,
        bytes: up.bytes,
        format: up.format,
        duration: up.duration,
        alt_text: alt || undefined,
        caption: caption || undefined,
      };
      const result = await saveMedia(payload);
      if (result.error) throw new Error(result.error);

      setCaption('');
      setAlt('');
      router.refresh();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
        No contact details in captions or alt text. Uploaded media is reviewed by admin before it
        appears publicly.
      </div>

      <div className="rounded-xl ring-1 ring-slate-200 p-4 space-y-3">
        <p className="text-sm font-medium">
          Upload media <span className="text-slate-400">({images.length}/12 photos · {videos.length}/3 videos)</span>
        </p>
        <div className="grid grid-cols-2 gap-2">
          <input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Caption (optional)" className="rounded border border-slate-300 px-2 py-1.5 text-sm" />
          <input value={alt} onChange={(e) => setAlt(e.target.value)} placeholder="Alt text (optional)" className="rounded border border-slate-300 px-2 py-1.5 text-sm" />
        </div>
        <input
          type="file"
          accept="image/*,video/*"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = '';
          }}
          className="block text-sm"
        />
        {busy && <p className="text-xs text-slate-500">Uploading…</p>}
        {msg && <p className="text-xs text-red-600">{msg}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {media.map((m) => (
          <div key={m.id} className="rounded-lg ring-1 ring-slate-200 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={m.thumbnail_url ?? m.url} alt={m.caption ?? ''} className="h-28 w-full object-cover" />
            <div className="p-2 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-slate-100 px-2 py-0.5">{m.status}</span>
                {m.is_cover && <span className="text-gold">★ cover</span>}
              </div>
              <div className="flex gap-2">
                {m.type === 'image' && !m.is_cover && (
                  <form action={setCover}>
                    <input type="hidden" name="media_id" value={m.id} />
                    <input type="hidden" name="listing_id" value={listingId} />
                    <button className="text-ocean">Set cover</button>
                  </form>
                )}
                <form action={deleteMedia}>
                  <input type="hidden" name="media_id" value={m.id} />
                  <input type="hidden" name="listing_id" value={listingId} />
                  <button className="text-red-600">Delete</button>
                </form>
              </div>
            </div>
          </div>
        ))}
        {media.length === 0 && <p className="text-sm text-slate-500">No media uploaded yet.</p>}
      </div>
    </div>
  );
}

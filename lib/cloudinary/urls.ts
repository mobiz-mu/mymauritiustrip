// Builds optimized Cloudinary delivery URLs from a public_id. The original
// upload is never served directly — every variant uses f_auto,q_auto and a
// bounded size. Safe on client and server (uses the public cloud name).

const CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? '';

function build(resource: 'image' | 'video', publicId: string, transform: string, ext?: string): string {
  if (!CLOUD || !publicId) return '';
  const tail = ext ? `${publicId}.${ext}` : publicId;
  return `https://res.cloudinary.com/${CLOUD}/${resource}/upload/${transform}/${tail}`;
}

export const imageVariants = (publicId: string) => ({
  thumb: build('image', publicId, 'c_fill,w_320,h_240,q_auto,f_auto'),
  card: build('image', publicId, 'c_fill,w_640,h_480,q_auto,f_auto'),
  gallery: build('image', publicId, 'c_fill,w_1024,h_768,q_auto,f_auto'),
  full: build('image', publicId, 'c_limit,w_1920,q_auto,f_auto'),
});

// Video poster (still frame at 0s) plus an optimized playable URL.
export const videoVariants = (publicId: string) => ({
  poster: build('video', publicId, 'so_0,c_fill,w_640,h_480,q_auto', 'jpg'),
  preview: build('video', publicId, 'q_auto,f_auto'),
});

export type MediaType = 'image' | 'video';

export function bestThumb(publicId: string, type: MediaType): string {
  return type === 'video' ? videoVariants(publicId).poster : imageVariants(publicId).thumb;
}

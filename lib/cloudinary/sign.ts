import 'server-only';
import crypto from 'crypto';

// Cloudinary signed direct-upload: the browser uploads the file straight to
// Cloudinary (so big files never pass through our server), using a signature we
// compute here with the API secret. The secret never leaves the server.
export function signCloudinaryParams(params: Record<string, string | number>): string {
  const secret = process.env.CLOUDINARY_API_SECRET;
  if (!secret) throw new Error('CLOUDINARY_API_SECRET is not set');

  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');

  return crypto.createHash('sha1').update(toSign + secret).digest('hex');
}

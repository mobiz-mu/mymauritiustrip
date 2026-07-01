/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
    ],
  },
  experimental: {
    // Verification proofs/documents are uploaded through server actions.
    serverActions: { bodySizeLimit: '10mb' },
  },
};
export default nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Vercel Blob serves media from this host; allow it for next/image if used.
    remotePatterns: [
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
    ],
  },
};

export default nextConfig;

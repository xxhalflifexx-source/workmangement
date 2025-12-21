/** @type {import('next').NextConfig} */
const nextConfig = {
  // Note: We can't use static export because we have API routes
  // Mobile app will connect to the deployed server URL
  images: {
    unoptimized: false,
  },
};

export default nextConfig;




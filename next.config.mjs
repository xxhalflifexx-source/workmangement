/** @type {import('next').NextConfig} */
const nextConfig = {
  // For Capacitor mobile apps, we'll use output: 'export' for static pages
  // but API routes will still work when deployed to server
  // Mobile apps will connect to the deployed API
  output: process.env.BUILD_MOBILE === 'true' ? 'export' : undefined,
  images: {
    unoptimized: process.env.BUILD_MOBILE === 'true',
  },
  // Disable static optimization for mobile builds to allow dynamic routes
  trailingSlash: true,
};

export default nextConfig;




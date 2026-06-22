/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // allow large video uploads through API routes
    serverActions: { bodySizeLimit: "200mb" },
  },
};

module.exports = nextConfig;

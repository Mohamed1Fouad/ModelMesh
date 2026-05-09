/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.GATEWAY_URL ?? 'http://localhost:3000'}/v1/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;

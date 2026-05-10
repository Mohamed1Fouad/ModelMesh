/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  transpilePackages: ['@modelmesh/db', '@modelmesh/shared'],
  webpack(config) {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js'],
    };
    return config;
  },
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

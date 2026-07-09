/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@finance/api', '@finance/db'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'logo.clearbit.com' },
      { protocol: 'https', hostname: 'plaid-merchant-logos.plaid.com' },
    ],
  },
};
module.exports = nextConfig;

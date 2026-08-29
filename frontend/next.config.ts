import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      { source: '/restaurant/dashboard', destination: '/dashboard' },
      { source: '/restaurant/:path*', destination: '/:path*' },
      { source: '/access-control/:path*', destination: '/:path*' },
      { source: '/config/companies', destination: '/accounting/configuration/companies' },
      { source: '/config/currencies', destination: '/accounting/configuration/currencies' },
      { source: '/config/taxes', destination: '/accounting/configuration/taxes' },
      { source: '/config/payment-methods', destination: '/accounting/configuration/payment-methods' },
      { source: '/config/payment-terms', destination: '/accounting/configuration/payment-terms' },
    ];
  },
};

export default nextConfig;

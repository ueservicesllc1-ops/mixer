import type {NextConfig} from 'next';
require('dotenv').config();

const nextConfig: NextConfig = {
  output: 'export',
  experimental: {
    allowedDevOrigins: [
      '6000-firebase-multitrack-mixer3-1758135046186.cluster-wfwbjypkvnfkaqiqzlu3ikwjhe.cloudworkstations.dev',
    ],
  },
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'i.imgur.com',
        port: '',
        pathname: '/**',
      }
    ],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...config.externals, 'handlebars'];
    }
    return config;
  },
};

export default nextConfig;

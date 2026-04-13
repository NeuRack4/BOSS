/** @type {import('next').NextConfig} */
const nextConfig = {
  // PWA support can be added via next-pwa
  webpack: (config) => {
    // pdfjs-dist uses canvas in Node.js builds; not needed in browser
    config.resolve.alias.canvas = false;
    return config;
  },
};

module.exports = nextConfig;

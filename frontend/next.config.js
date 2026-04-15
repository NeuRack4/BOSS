/** @type {import('next').NextConfig} */
const nextConfig = {
  // react-markdown v10+ is ESM-only — transpile for client components
  transpilePackages: [
    "react-markdown",
    "remark-gfm",
    "remark-parse",
    "unified",
    "bail",
    "is-plain-obj",
    "trough",
    "vfile",
    "vfile-message",
    "unist-util-stringify-position",
    "mdast-util-from-markdown",
    "mdast-util-to-string",
    "micromark",
    "decode-named-character-reference",
    "character-entities",
    "mdast-util-to-hast",
    "hast-util-whitespace",
    "property-information",
    "hast-util-to-jsx-runtime",
    "comma-separated-tokens",
    "space-separated-tokens",
    "unist-util-visit",
    "unist-util-is",
    "estree-util-is-identifier-name",
    "html-url-attributes",
  ],
  // PWA support can be added via next-pwa
  webpack: (config) => {
    // pdfjs-dist uses canvas in Node.js builds; not needed in browser
    config.resolve.alias.canvas = false;
    return config;
  },
};

module.exports = nextConfig;

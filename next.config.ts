import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@google/genai",
    "pdf-lib",
    "@pdf-lib/fontkit",
    "pdfjs-dist",
    "@napi-rs/canvas",
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // 90 is used for the About portrait so the face stays sharp.
  images: { qualities: [75, 90] },
};

export default nextConfig;

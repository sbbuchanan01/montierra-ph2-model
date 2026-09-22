import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    // The Projects tab became the Deals dashboard at "/".
    return [{ source: "/projects", destination: "/", permanent: false }];
  },
};

export default nextConfig;

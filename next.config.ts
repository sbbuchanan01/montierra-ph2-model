import type { NextConfig } from "next";

// This site was merged into cre-underwriting on 2026-09-24 (its /development side).
// Every path forwards there; next.config redirects run before the proxy auth gate.
const NEW_SITE = "https://cre-underwriting.vercel.app";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/login", destination: `${NEW_SITE}/login`, permanent: false },
      { source: "/reset-password", destination: `${NEW_SITE}/reset-password`, permanent: false },
      { source: "/projects", destination: `${NEW_SITE}/development`, permanent: false },
      { source: "/", destination: `${NEW_SITE}/development`, permanent: false },
      { source: "/:path*", destination: `${NEW_SITE}/development/:path*`, permanent: false },
    ];
  },
};

export default nextConfig;

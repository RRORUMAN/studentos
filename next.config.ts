import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Old product routes. The community was "The Loop" and discovery was
     "Explore" before the information architecture settled; anything a student
     bookmarked or was linked to keeps working. */
  async redirects() {
    return [
      { source: "/loop", destination: "/pulse", permanent: true },
      { source: "/loop/:path*", destination: "/pulse/:path*", permanent: true },
      { source: "/explore", destination: "/discover", permanent: true },
      { source: "/explore/:path*", destination: "/discover/:path*", permanent: true },
    ];
  },
};

export default nextConfig;

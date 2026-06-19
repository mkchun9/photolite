import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* 백엔드 프록시 설정 (backend가 외부 노출되지 않도록) */
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:3001/api/:path*",
      },
    ];
  },
};

export default nextConfig;

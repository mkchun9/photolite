import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Docker 배포를 위한 standalone 빌드 모드 */
  output: "standalone",

  /* 백엔드 프록시 설정 (backend가 외부 노출되지 않도록) */
  async rewrites() {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
      {
        source: "/uploads/:path*",
        destination: `${backendUrl}/uploads/:path*`,
      },
    ];
  },
};

export default nextConfig;

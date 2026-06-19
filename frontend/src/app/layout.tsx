import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PhotoLite — 사진 최적화 & 중복 감지",
  description: "사진을 업로드하면 자동으로 용량을 최적화하고 중복을 감지하는 웹 서비스",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
        {children}
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PhotoLite",
  description: "PhotoLite - 사진 & 동영상 관리 서비스",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}

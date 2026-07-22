import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "现场共创台",
  description: "扫码即进的现场共创 H5/PWA。",
  manifest: "/field-cocreation/manifest.webmanifest",
};

export const viewport = {
  themeColor: "#11120f",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}

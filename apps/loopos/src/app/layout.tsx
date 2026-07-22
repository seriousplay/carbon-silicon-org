import type { Metadata } from "next";
import "./globals.css";

/**
 * 字体配置 —— 活体组织美学
 *
 * 使用系统字体，避免 Google Fonts 网络依赖（Turbopack 下远程字体加载不稳定）
 * macOS: Songti SC / PingFang SC / Georgia / system-ui
 * 跨平台: 通过 CSS font-family 回退链覆盖
 */

export const metadata: Metadata = {
  title: {
    default: "回路OS · 组织治理操作系统",
    template: "%s · 回路OS",
  },
  description: "回路治理组织操作系统。把回路制方法论真正跑起来。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { SessionProvider } from "./session-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "碳硅组织｜从人力规模，到智能密度",
  description:
    "《碳硅组织》书籍主内容站，连接组织 AI 转型框架、22 个 OD 工具、在线测评与企业数据沉淀。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { SessionProvider } from "./session-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "碳硅组织工作坊 | Workshops",
  description: "碳硅组织系列工作坊 — 超级个体赋能、现场共创、组织诊断。",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}

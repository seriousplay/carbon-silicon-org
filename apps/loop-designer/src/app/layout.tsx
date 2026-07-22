import type { Metadata } from "next";
import { StudioHomeButton } from "@/components/studio-home-button";
import "./globals.css";

export const metadata: Metadata = {
  title: "碳硅组织设计工作室",
  description: "为 AI 时代领导者设计可自进化的碳硅共生组织：从组织诊断，到蓝图生成，到业务回路落地。",
  icons: {
    icon: "/loop-designer/icon.png",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        {children}
        <StudioHomeButton />
      </body>
    </html>
  );
}

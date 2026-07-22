"use client";

import { Download, Printer } from "lucide-react";

export function PrintButton({ variant = "primary" }: { variant?: "primary" | "ghost" }) {
  const className =
    variant === "ghost"
      ? "inline-flex items-center gap-2 rounded-full border border-emerald-200/20 px-4 py-2 text-sm font-bold text-emerald-50 hover:bg-white/10"
      : "inline-flex items-center gap-2 rounded-full bg-emerald-300 px-5 py-3 text-sm font-black text-[#06110f]";

  return (
    <button type="button" className={className} onClick={() => window.print()}>
      {variant === "ghost" ? <Printer className="h-4 w-4" /> : <Download className="h-4 w-4" />}
      {variant === "ghost" ? "打印 / 保存 PDF" : "下载 PDF"}
    </button>
  );
}

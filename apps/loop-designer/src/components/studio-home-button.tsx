"use client";

import Link from "next/link";
import { Home } from "lucide-react";
import { usePathname } from "next/navigation";

export function StudioHomeButton() {
  const pathname = usePathname();
  if (pathname === "/studio" || pathname === "/loop-designer/studio") return null;

  return (
    <Link
      href="/studio"
      className="fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 border border-[var(--acid)]/45 bg-[#08110f]/92 px-4 py-3 text-xs font-black text-[var(--acid)] shadow-2xl shadow-black/35 backdrop-blur transition hover:border-[var(--acid)] hover:bg-[var(--acid)] hover:text-black"
    >
      <Home size={15} />
      工作室主页
    </Link>
  );
}

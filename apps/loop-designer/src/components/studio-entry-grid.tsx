"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ClipboardList, Layers3, LoaderCircle, Workflow } from "lucide-react";

type StudioEntry = {
  icon: "questionnaire" | "blueprint" | "loop";
  label: string;
  title: string;
  href: string;
  action: string;
  loadingAction: string;
};

const icons = {
  questionnaire: ClipboardList,
  blueprint: Layers3,
  loop: Workflow,
};

export function StudioEntryGrid({ entries }: { entries: StudioEntry[] }) {
  const [loadingHref, setLoadingHref] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {entries.map((entry) => {
        const Icon = icons[entry.icon];
        const loading = loadingHref === entry.href;
        const locked = loadingHref !== null && !loading;
        return (
          <Link
            key={entry.href}
            href={entry.href}
            aria-disabled={loadingHref !== null}
            onClick={(event) => {
              if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
              event.preventDefault();
              if (loadingHref) {
                return;
              }
              setLoadingHref(entry.href);
              window.setTimeout(() => router.push(entry.href), 80);
            }}
            className={`group grid w-full gap-5 border border-white/10 bg-[#0b1d19]/82 p-5 text-left shadow-2xl shadow-black/15 transition sm:grid-cols-[72px_minmax(0,1fr)_auto] sm:items-center lg:block ${
              loading
                ? "cursor-wait border-[var(--acid)]/70 bg-[var(--acid)]/10"
                : locked
                  ? "pointer-events-none opacity-45"
                  : "hover:-translate-y-1 hover:border-[var(--acid)]/70 hover:bg-[var(--acid)]/8"
            }`}
          >
            <span className="grid h-16 w-16 place-items-center border border-white/12 bg-black/20 text-[var(--acid)]">
              {loading ? <LoaderCircle className="h-7 w-7 animate-spin" /> : <Icon className="h-7 w-7" />}
            </span>
            <span className="mt-0 block lg:mt-6">
              <span className="text-xs font-black uppercase tracking-[0.18em] text-[var(--cyan)]">{entry.label}</span>
              <span className="mt-2 block text-2xl font-black text-white">{entry.title}</span>
            </span>
            <span className="inline-flex items-center gap-2 text-sm font-black text-[var(--acid)] group-hover:text-white lg:mt-8">
              {loading ? entry.loadingAction : entry.action}
              {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

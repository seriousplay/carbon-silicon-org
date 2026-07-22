"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { withBasePath } from "@/lib/base-path";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

type SearchResult = {
  type: string;
  id: string;
  label: string;
  sub: string;
  href: string;
};

const typeIcon: Record<string, string> = {
  circle: "❋",
  tension: "∿",
  blocker: "◐",
  person: "◉",
};

const typeLabel: Record<string, string> = {
  circle: "回路",
  tension: "张力",
  blocker: "阻塞点",
  person: "人员",
};

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const router = useRouter();

  // ⌘K / Ctrl+K 打开
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // 防抖搜索
  useEffect(() => {
    if (!query.trim()) {
      return;
    }
    const timer = setTimeout(async () => {
      const res = await fetch(withBasePath(`/api/search?q=${encodeURIComponent(query)}`));
      const data = await res.json();
      setResults(data.results ?? []);
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  // 按类型分组
  const visibleResults = query.trim() ? results : [];

  const grouped = visibleResults.reduce<Record<string, SearchResult[]>>((acc, r) => {
    (acc[r.type] ??= []).push(r);
    return acc;
  }, {});

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="搜索回路、张力、阻塞点、人员…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>{query ? "未找到结果" : "输入关键词开始搜索"}</CommandEmpty>
        {Object.entries(grouped).map(([type, items]) => (
          <CommandGroup key={type} heading={typeLabel[type] ?? type}>
            {items.map((item) => (
              <CommandItem
                key={`${item.type}-${item.id}`}
                onSelect={() => {
                  router.push(item.href);
                  setOpen(false);
                }}
                className="cursor-pointer"
              >
                <span className="mr-2 text-muted-foreground">{typeIcon[item.type] ?? "•"}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{item.label}</p>
                  {item.sub && (
                    <p className="text-xs text-muted-foreground truncate">{item.sub}</p>
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}

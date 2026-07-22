"use client";

import { useState, useRef, useEffect } from "react";
import { Search } from "lucide-react";

type SearchableOption = {
  id: string;
  name: string;
  sub?: string;
};

export function RoleCircleSearch({
  options,
  value,
  onChange,
  placeholder = "搜索角色或圈子…",
}: {
  options: SearchableOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.id === value);

  const filtered = query
    ? options.filter(
        (o) =>
          o.name.toLowerCase().includes(query.toLowerCase()) ||
          o.sub?.toLowerCase().includes(query.toLowerCase())
      )
    : options.slice(0, 15);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className="w-full flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm text-left hover:border-moss/40 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        {selected ? (
          <span className="flex-1 truncate">
            <span className="font-medium">{selected.name}</span>
            {selected.sub && <span className="text-muted-foreground ml-1 text-xs">({selected.sub})</span>}
          </span>
        ) : (
          <span className="text-muted-foreground flex-1">{placeholder}</span>
        )}
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-card shadow-lg max-h-48 overflow-hidden">
          <div className="p-2 border-b border-border">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="输入关键词搜索…"
              className="w-full text-sm bg-transparent outline-none"
              autoFocus
            />
          </div>
          <div className="max-h-36 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">无匹配结果</p>
            ) : (
              filtered.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/40 transition-colors ${
                    opt.id === value ? "bg-moss-pale/30 text-moss font-medium" : ""
                  }`}
                  onClick={() => {
                    onChange(opt.id);
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  <span>{opt.name}</span>
                  {opt.sub && <span className="text-muted-foreground ml-1 text-xs">{opt.sub}</span>}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

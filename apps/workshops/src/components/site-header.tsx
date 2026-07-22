"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { sections } from "@/lib/sections";
import { siteConfig } from "@/lib/site-config";

const navigation = [
  { label: "首页", href: "/" },
  ...sections.map((section) => ({
    label: section.shortName,
    href: `/sections/${section.id}`,
  })),
  { label: "关于", href: "/about" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Link className="brand" href="/" aria-label={`${siteConfig.name}首页`}>
          <span className="brand-mark" aria-hidden="true">一</span>
          <span>
            <strong>{siteConfig.name}</strong>
            <small>SUPER INDIVIDUAL JOURNAL</small>
          </span>
        </Link>

        <nav className="desktop-nav" aria-label="主导航">
          {navigation.map((item) => (
            <Link
              className={pathname === item.href ? "nav-link active" : "nav-link"}
              href={item.href}
              key={item.href}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <button
          className="menu-button"
          type="button"
          aria-expanded={open}
          aria-controls="mobile-navigation"
          aria-label={open ? "关闭导航" : "打开导航"}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X size={21} /> : <Menu size={21} />}
        </button>
      </div>

      {open ? (
        <nav id="mobile-navigation" className="mobile-nav" aria-label="移动端主导航">
          {navigation.map((item, index) => (
            <Link
              className={pathname === item.href ? "mobile-nav-link active" : "mobile-nav-link"}
              href={item.href}
              key={item.href}
              onClick={() => setOpen(false)}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              {item.label}
            </Link>
          ))}
        </nav>
      ) : null}
    </header>
  );
}

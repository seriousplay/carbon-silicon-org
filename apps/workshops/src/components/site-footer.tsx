import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { sections } from "@/lib/sections";
import { siteConfig } from "@/lib/site-config";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell footer-grid">
        <div>
          <p className="footer-kicker">A FIELD NOTE IN PROGRESS</p>
          <p className="footer-statement">先完成一次真实行动，再写下一篇。</p>
        </div>
        <div className="footer-links">
          {sections.map((section) => (
            <Link href={`/sections/${section.id}`} key={section.id}>
              {section.name}
            </Link>
          ))}
          <Link href="/about">
            关于我 <ArrowUpRight size={14} aria-hidden="true" />
          </Link>
        </div>
        <div className="footer-meta">
          <span>© {new Date().getFullYear()} {siteConfig.author}</span>
          <span>每周更新，不预支结论</span>
        </div>
      </div>
    </footer>
  );
}

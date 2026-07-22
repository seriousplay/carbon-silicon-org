import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { formatChineseDate } from "@/lib/format";
import { getSection } from "@/lib/sections";
import type { Article } from "@/types/article";

type ArticleCardProps = {
  article: Article;
  featured?: boolean;
  index?: number;
};

export function ArticleCard({ article, featured = false, index }: ArticleCardProps) {
  const section = getSection(article.section);

  if (featured) {
    return (
      <article className="featured-card">
        <div className="featured-index" aria-hidden="true">
          <span>ISSUE</span>
          <strong>001</strong>
        </div>
        <div className="featured-copy">
          <div className="article-meta">
            <span>{section?.name}</span>
            <span>{formatChineseDate(article.publishedAt)}</span>
            <span>{article.readingMinutes} 分钟阅读</span>
          </div>
          <h2>
            <Link href={`/articles/${article.slug}`}>{article.title}</Link>
          </h2>
          <p>{article.summary}</p>
          <Link className="read-link" href={`/articles/${article.slug}`}>
            阅读本期手记 <ArrowUpRight size={18} aria-hidden="true" />
          </Link>
        </div>
      </article>
    );
  }

  return (
    <article className="article-card">
      <div className="article-number" aria-hidden="true">
        {String((index ?? 0) + 1).padStart(2, "0")}
      </div>
      <div>
        <div className="article-meta">
          <span>{section?.name}</span>
          <span>{formatChineseDate(article.publishedAt)}</span>
        </div>
        <h3>
          <Link href={`/articles/${article.slug}`}>{article.title}</Link>
        </h3>
        <p>{article.summary}</p>
      </div>
      <Link className="card-arrow" href={`/articles/${article.slug}`} aria-label={`阅读：${article.title}`}>
        <ArrowUpRight size={20} aria-hidden="true" />
      </Link>
    </article>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { notFound } from "next/navigation";
import { ArticleProse } from "@/components/article-prose";
import { getAdjacentArticles, getAllArticles, getArticleBySlug } from "@/lib/articles";
import { formatChineseDate } from "@/lib/format";
import { createMetadata } from "@/lib/metadata";
import { getSection } from "@/lib/sections";
import { absoluteUrl, siteConfig } from "@/lib/site-config";

type ArticlePageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return getAllArticles().map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticleBySlug(slug);

  if (!article) {
    return {};
  }

  return createMetadata({
    title: `${article.title}｜一个人的组织`,
    description: article.summary,
    pathname: `/articles/${article.slug}`,
    type: "article",
    publishedTime: article.publishedAt,
    modifiedTime: article.updatedAt,
  });
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params;
  const article = getArticleBySlug(slug);

  if (!article) {
    notFound();
  }

  const section = getSection(article.section);
  const adjacent = getAdjacentArticles(article);
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.summary,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt || article.publishedAt,
    inLanguage: "zh-CN",
    mainEntityOfPage: absoluteUrl(`/articles/${article.slug}`),
    author: {
      "@type": "Person",
      name: siteConfig.author,
      url: absoluteUrl("/about"),
    },
    publisher: {
      "@type": "Person",
      name: siteConfig.author,
    },
  };

  return (
    <article className="article-page">
      <header className="article-header shell">
        <Link className="article-back" href={`/sections/${article.section}`}>
          <ArrowLeft size={16} aria-hidden="true" />
          返回{section?.name}
        </Link>
        <div className="article-header-grid">
          <div className="article-issue" aria-hidden="true">
            <span>FIELD NOTE</span>
            <strong>001</strong>
          </div>
          <div>
            <div className="article-meta">
              <span>{section?.name}</span>
              <span>{formatChineseDate(article.publishedAt)}</span>
              <span>{article.readingMinutes} 分钟阅读</span>
            </div>
            <h1>{article.title}</h1>
            <p className="article-summary">{article.summary}</p>
          </div>
        </div>
      </header>

      <div className="article-body shell">
        <aside className="article-aside">
          <span>AI ROLE</span>
          <p>{article.aiRole || "本文未单独记录 AI 的参与方式。"}</p>
          {article.tags.length > 0 ? (
            <div className="article-tags">
              {article.tags.map((tag) => <span key={tag}>#{tag}</span>)}
            </div>
          ) : null}
        </aside>
        <ArticleProse body={article.body} />
      </div>

      <nav className="article-pagination shell" aria-label="文章翻页">
        {adjacent.older ? (
          <Link href={`/articles/${adjacent.older.slug}`}>
            <span><ArrowLeft size={16} aria-hidden="true" /> 较早一篇</span>
            <strong>{adjacent.older.title}</strong>
          </Link>
        ) : <span />}
        {adjacent.newer ? (
          <Link href={`/articles/${adjacent.newer.slug}`}>
            <span>较新一篇 <ArrowRight size={16} aria-hidden="true" /></span>
            <strong>{adjacent.newer.title}</strong>
          </Link>
        ) : <span />}
      </nav>

      <Script
        id={`article-${article.slug}-structured-data`}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
    </article>
  );
}

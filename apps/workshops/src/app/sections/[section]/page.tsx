import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleCard } from "@/components/article-card";
import { EmptySection } from "@/components/empty-section";
import { getArticlesBySection } from "@/lib/articles";
import { groupByYear } from "@/lib/format";
import { createMetadata } from "@/lib/metadata";
import { getSection, sections } from "@/lib/sections";

type SectionPageProps = {
  params: Promise<{ section: string }>;
};

export function generateStaticParams() {
  return sections.map((section) => ({ section: section.id }));
}

export async function generateMetadata({ params }: SectionPageProps): Promise<Metadata> {
  const { section: sectionId } = await params;
  const section = getSection(sectionId);

  if (!section) {
    return {};
  }

  return createMetadata({
    title: `${section.name}｜一个人的组织`,
    description: section.description,
    pathname: `/sections/${section.id}`,
  });
}

export default async function SectionPage({ params }: SectionPageProps) {
  const { section: sectionId } = await params;
  const section = getSection(sectionId);

  if (!section) {
    notFound();
  }

  const articles = getArticlesBySection(section.id);
  const groups = groupByYear(articles);

  return (
    <div className="archive-page shell">
      <header className="archive-header">
        <div>
          <p className="eyebrow">{section.eyebrow}</p>
          <h1>{section.name}</h1>
        </div>
        <p>{section.description}</p>
      </header>

      {articles.length === 0 ? (
        <EmptySection message={section.emptyMessage} />
      ) : (
        <div className="archive-groups">
          {Object.entries(groups).map(([year, yearArticles]) => (
            <section className="archive-year" key={year}>
              <h2>{year}</h2>
              <div className="article-list">
                {yearArticles.map((article, index) => (
                  <ArticleCard article={article} index={index} key={article.slug} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

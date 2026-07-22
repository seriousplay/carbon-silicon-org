import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { z } from "zod";
import { calculateReadingMinutes } from "@/lib/reading-time";
import { sectionIds, type SectionId } from "@/lib/sections";
import type { Article } from "@/types/article";

const articlesDirectory = path.join(process.cwd(), "content", "articles");

const articleSchema = z.object({
  title: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  section: z.enum(sectionIds),
  summary: z.string().min(1),
  publishedAt: z.coerce.date(),
  updatedAt: z.coerce.date().optional(),
  cover: z.string().min(1).optional(),
  status: z.enum(["draft", "published"]),
  aiRole: z.string().min(1).optional(),
  tags: z.array(z.string().min(1)).default([]),
});

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function readArticleFile(fileName: string): Article {
  const sourcePath = path.join(articlesDirectory, fileName);
  const raw = fs.readFileSync(sourcePath, "utf8");
  const parsed = matter(raw);
  const result = articleSchema.safeParse(parsed.data);

  if (!result.success) {
    throw new Error(
      `Invalid article metadata in ${sourcePath}: ${z.prettifyError(result.error)}`,
    );
  }

  const metadata = result.data;
  return {
    ...metadata,
    section: metadata.section as SectionId,
    publishedAt: formatDate(metadata.publishedAt),
    updatedAt: metadata.updatedAt ? formatDate(metadata.updatedAt) : undefined,
    body: parsed.content.trim(),
    readingMinutes: calculateReadingMinutes(parsed.content),
    sourcePath,
  };
}

export function getAllArticles(options: { includeDrafts?: boolean } = {}) {
  if (!fs.existsSync(articlesDirectory)) {
    return [];
  }

  const articles = fs
    .readdirSync(articlesDirectory)
    .filter((fileName) => fileName.endsWith(".md"))
    .map(readArticleFile);

  const duplicateSlugs = articles
    .map((article) => article.slug)
    .filter((slug, index, slugs) => slugs.indexOf(slug) !== index);

  if (duplicateSlugs.length > 0) {
    throw new Error(`Duplicate article slug: ${[...new Set(duplicateSlugs)].join(", ")}`);
  }

  return articles
    .filter((article) => options.includeDrafts || article.status === "published")
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

export function getArticleBySlug(slug: string) {
  return getAllArticles().find((article) => article.slug === slug);
}

export function getArticlesBySection(section: SectionId) {
  return getAllArticles().filter((article) => article.section === section);
}

export function getAdjacentArticles(article: Article) {
  const articles = getAllArticles();
  const index = articles.findIndex((item) => item.slug === article.slug);

  return {
    newer: index > 0 ? articles[index - 1] : undefined,
    older: index >= 0 && index < articles.length - 1 ? articles[index + 1] : undefined,
  };
}

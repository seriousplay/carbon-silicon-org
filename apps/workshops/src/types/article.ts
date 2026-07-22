import type { SectionId } from "@/lib/sections";

export type ArticleStatus = "draft" | "published";

export type Article = {
  title: string;
  slug: string;
  section: SectionId;
  summary: string;
  publishedAt: string;
  updatedAt?: string;
  cover?: string;
  status: ArticleStatus;
  aiRole?: string;
  tags: string[];
  body: string;
  readingMinutes: number;
  sourcePath: string;
};

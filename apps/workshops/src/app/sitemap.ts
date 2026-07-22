import type { MetadataRoute } from "next";
import { getAllArticles } from "@/lib/articles";
import { sections } from "@/lib/sections";
import { absoluteUrl } from "@/lib/site-config";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), changeFrequency: "weekly", priority: 1 },
    { url: absoluteUrl("/about"), changeFrequency: "monthly", priority: 0.6 },
    ...sections.map((section) => ({
      url: absoluteUrl(`/sections/${section.id}`),
      changeFrequency: "weekly" as const,
      priority: section.id === "growth-notes" ? 0.9 : 0.7,
    })),
  ];

  return [
    ...staticPages,
    ...getAllArticles().map((article) => ({
      url: absoluteUrl(`/articles/${article.slug}`),
      lastModified: article.updatedAt || article.publishedAt,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}

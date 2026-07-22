import { describe, expect, it } from "vitest";
import { getAllArticles, getArticleBySlug, getArticlesBySection } from "@/lib/articles";

describe("article content layer", () => {
  it("loads published articles in descending order", () => {
    const articles = getAllArticles();

    expect(articles.length).toBeGreaterThan(0);
    expect(articles.every((article) => article.status === "published")).toBe(true);
    expect(articles.map((article) => article.publishedAt)).toEqual(
      [...articles.map((article) => article.publishedAt)].sort().reverse(),
    );
  });

  it("finds an article by slug", () => {
    expect(getArticleBySlug("why-i-start")?.title).toContain("为什么");
  });

  it("filters articles by fixed section", () => {
    const articles = getArticlesBySection("growth-notes");
    expect(articles.every((article) => article.section === "growth-notes")).toBe(true);
  });
});

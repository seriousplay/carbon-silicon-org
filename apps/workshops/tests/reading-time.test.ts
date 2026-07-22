import { describe, expect, it } from "vitest";
import { calculateReadingMinutes } from "@/lib/reading-time";

describe("calculateReadingMinutes", () => {
  it("returns at least one minute", () => {
    expect(calculateReadingMinutes("很短。")).toBe(1);
  });

  it("estimates Chinese text by character count", () => {
    expect(calculateReadingMinutes("字".repeat(801))).toBe(3);
  });

  it("estimates Latin text by word count", () => {
    expect(calculateReadingMinutes(Array.from({ length: 221 }, () => "word").join(" "))).toBe(2);
  });

  it("ignores fenced code", () => {
    expect(calculateReadingMinutes(`正文\n\n\`\`\`js\n${"word ".repeat(1000)}\n\`\`\``)).toBe(1);
  });
});

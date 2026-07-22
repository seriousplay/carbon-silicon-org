import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const brainPageSource = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

test("legacy Brain route redirects to the Organization Brain home", () => {
  assert.doesNotMatch(brainPageSource, /^["']use client["'];?/m);
  assert.match(brainPageSource, /import \{ redirect \} from "next\/navigation"/);
  assert.match(brainPageSource, /redirect\("\/app"\)/);
  assert.doesNotMatch(brainPageSource, /BrainClient|mode="(?:workspace|panel)"|return \(/);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const topbar = readFileSync(new URL("./topbar.tsx", import.meta.url), "utf8");

test("Button links declare non-native button semantics", () => {
  const buttonLinks = topbar.match(
    /<Button\b(?:(?!<Button\b)[\s\S])*?render=\{<Link\b[\s\S]*?\/>\}(?:(?!<Button\b)[\s\S])*?>/g,
  );

  assert.equal(buttonLinks?.length, 3);
  for (const buttonLink of buttonLinks ?? []) {
    assert.match(buttonLink, /nativeButton=\{false\}/);
  }
});

test("Brain launcher stays global and expands to the Brain home", () => {
  assert.match(topbar, /aria-label="打开组织大脑"/);
  assert.match(topbar, /<BrainClient mode="panel"/);
  assert.match(topbar, /render=\{<Link href="\/app" onClick=\{\(\) => setBrainOpen\(false\)\} \/>\}/);
  assert.doesNotMatch(topbar, /href="\/app\/brain"/);
});

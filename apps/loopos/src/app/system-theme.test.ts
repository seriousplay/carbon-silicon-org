import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const globalStyles = readFileSync(new URL("./globals.css", import.meta.url), "utf8");

function blockAfter(marker: string, endMarker: string) {
  const start = globalStyles.indexOf(marker);
  assert.notEqual(start, -1, `missing ${marker}`);

  const end = globalStyles.indexOf(endMarker, start);
  assert.notEqual(end, -1, `missing ${endMarker} after ${marker}`);
  return globalStyles.slice(start, end);
}

test("system dark preference does not override the default light surface", () => {
  assert.match(globalStyles, /:root\s*\{[\s\S]*?color-scheme:\s*light;/);
  assert.doesNotMatch(globalStyles, /@media\s*\(prefers-color-scheme:\s*dark\)/);
  assert.match(globalStyles, /--brain-warning:\s*#92400e;/);
});

test("explicit dark class remains a complete supported override", () => {
  const explicitDark = globalStyles.slice(globalStyles.indexOf(".dark {"));

  assert.match(explicitDark, /color-scheme:\s*dark;/);
  for (const token of [
    "background",
    "foreground",
    "card",
    "popover",
    "border",
    "input",
    "sidebar",
    "seed-pale",
    "selection-background",
    "brain-success",
    "brain-info",
    "brain-warning",
    "brain-danger",
  ]) {
    assert.match(explicitDark, new RegExp(`--${token}:`), `.dark must set --${token}`);
  }
});

test("reduced motion disables the existing ambient animations and hover lift", () => {
  const reducedMotion = blockAfter(
    "@media (prefers-reduced-motion: reduce)",
    "/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n * 状态徽章",
  );

  assert.match(reducedMotion, /\.animate-breathe,[\s\S]*?\.animate-fade-rise\s*\{[\s\S]*?animation:\s*none;/);
  assert.match(reducedMotion, /\.card-hover\s*\{[\s\S]*?transition:\s*none;/);
  assert.match(reducedMotion, /\.card-hover:hover\s*\{[\s\S]*?transform:\s*none;/);
});

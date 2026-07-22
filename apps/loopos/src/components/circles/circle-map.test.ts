import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(new URL("./circle-map.tsx", import.meta.url), "utf8");

test("interactive Circle nodes support keyboard selection", () => {
  assert.match(source, /role="button"/);
  assert.match(source, /tabIndex=\{0\}/);
  assert.match(source, /aria-label=\{`选择回路/);
  assert.match(source, /onFocus=\{\(\) => onSelect/);
  assert.match(source, /event\.key === "Enter" \|\| event\.key === " "/);
});

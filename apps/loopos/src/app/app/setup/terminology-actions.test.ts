import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(new URL("./terminology-actions.ts", import.meta.url), "utf8");

test("saving organization terminology synchronizes the Brain profile evidence", () => {
  assert.match(source, /organizationBrainProfile\.updateMany/);
  assert.match(source, /terminologyPreferences: terminology/);
  assert.match(source, /prisma\.\$transaction/);
});

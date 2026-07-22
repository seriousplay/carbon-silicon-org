import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const mapSource = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const detailSource = readFileSync(new URL("../[id]/page.tsx", import.meta.url), "utf8");
const organizationSubnavSource = readFileSync(
  new URL("../../organization/organization-subnav.tsx", import.meta.url),
  "utf8",
);

test("Organization landing preserves stable secondary destinations", () => {
  assert.match(mapSource, /OrganizationSubnav active="structure"/);
  for (const href of ["/app/circles/map", "/app/me", "/app/roles/market", "/app/people", "/app/governance", "/app/goals"]) {
    assert.match(organizationSubnavSource, new RegExp(`href: "${href.replaceAll("/", "\\/")}"`));
  }
  assert.match(organizationSubnavSource, /\/app\/organization\/business-loops/);
});

test("Circle role rows link to the existing Role detail route", () => {
  assert.match(detailSource, /href=\{`\/app\/roles\/\$\{role\.id\}`\}/);
});

test("Circle map includes active role summaries inside each circle node", () => {
  assert.match(mapSource, /roles:\s*\{/);
  assert.match(mapSource, /where:\s*\{\s*status:\s*"ACTIVE"\s*\}/);
  assert.match(mapSource, /assigneeCount:\s*role\._count\.assignees/);
});

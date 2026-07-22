import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { after, before, describe, test } from "node:test";
import type { PrismaClient } from "@/generated/prisma/client";
import {
  closeDisposableDbClient,
  createDisposableDbClient,
  requiredRtw1S0DatabaseUrl,
  type DisposableDbClient,
} from "@/test/rtw1-s0-disposable-db";

const actionSource = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");
const draftSource = readFileSync(new URL("./review-draft.tsx", import.meta.url), "utf8");
const pageSource = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const schemaSource = readFileSync(new URL("../../../../prisma/schema.prisma", import.meta.url), "utf8");
const migrationSource = readFileSync(new URL("../../../../prisma/migrations/20260713190000_rtw1_s4_weekly_review_confirmer/migration.sql", import.meta.url), "utf8");

test("weekly AI generation returns a preview without writing", () => {
  const generateBody = actionSource.slice(actionSource.indexOf("generateWeeklyReviewAction"), actionSource.indexOf("confirmWeeklyReviewAction"));
  assert.doesNotMatch(generateBody, /governanceLog\.(?:create|update|upsert)/);
  assert.match(generateBody, /return draft \? \{ draft \}/);
});

test("weekly review is written only by the explicit confirmation form", () => {
  assert.match(draftSource, /form action=\{confirmAction\}/);
  assert.match(draftSource, /确认并保存/);
  assert.match(actionSource, /governanceLog\.create/);
  assert.doesNotMatch(actionSource, /governanceLog\.(?:upsert|update)/);
  assert.match(actionSource, /formData\.get\("period"\) !== period\.key/);
});

test("weekly review confirmation is create-only, conflict-safe, and records its tenant-scoped confirmer", () => {
  assert.match(actionSource, /confirmedById:\s*person\.id/);
  assert.match(actionSource, /Prisma\.PrismaClientKnownRequestError/);
  assert.match(actionSource, /error\.code === "P2002"/);
  assert.match(actionSource, /本周期回顾已被确认，请重新加载/);
  assert.match(pageSource, /confirmedBy:\s*\{\s*select:\s*\{\s*name:\s*true/);
  assert.match(pageSource, /existing\.confirmedBy\?\.name/);
  assert.match(schemaSource, /confirmedBy\s+Person\?\s+@relation\("GovernanceLogConfirmer", fields: \[confirmedById, organizationId\], references: \[id, organizationId\], onDelete: Restrict\)/);
  assert.match(migrationSource, /FOREIGN KEY \("confirmedById", "organizationId"\)[\s\S]*REFERENCES "people"\("id", "organizationId"\)/);
});

async function createReviewFixture(prisma: PrismaClient, label: string) {
  const suffix = `${label}-${randomUUID().slice(0, 8)}`;
  const organization = await prisma.organization.create({ data: { name: suffix, slug: `review-${suffix}` } });
  const circle = await prisma.circle.create({
    data: { organizationId: organization.id, name: "Review root", number: "CUSTOM", type: "PRODUCTION", purpose: "Review test" },
  });
  const person = await prisma.person.create({
    data: { organizationId: organization.id, name: "Confirmer", homeCircleId: circle.id },
  });
  return { organizationId: organization.id, personId: person.id };
}

if (process.env.RTW1_S4_DB_REQUIRED === "1") {
  describe("weekly review create-only persistence against disposable PostgreSQL", { concurrency: 1 }, () => {
    let first: DisposableDbClient;
    let second: DisposableDbClient;

    before(() => {
      const connectionString = requiredRtw1S0DatabaseUrl();
      first = createDisposableDbClient(connectionString);
      second = createDisposableDbClient(connectionString);
    });

    after(async () => {
      await Promise.all([closeDisposableDbClient(first), closeDisposableDbClient(second)]);
    });

    test("first confirmation persists final submitted content and confirmer; duplicate does not overwrite", async () => {
      const fixture = await createReviewFixture(first.prisma, "first");
      const period = "2026-W29";
      await first.prisma.governanceLog.create({
        data: { organizationId: fixture.organizationId, confirmedById: fixture.personId, period, title: "Final title", content: "Final edited content", patterns: "[]", status: "published" },
      });
      await assert.rejects(
        first.prisma.governanceLog.create({
          data: { organizationId: fixture.organizationId, confirmedById: fixture.personId, period, title: "Overwrite", content: "Overwrite", patterns: "[]", status: "published" },
        }),
        (error: { code?: string }) => error.code === "P2002",
      );
      assert.deepEqual(
        await first.prisma.governanceLog.findUnique({
          where: { organizationId_period: { organizationId: fixture.organizationId, period } },
          select: { title: true, content: true, confirmedById: true },
        }),
        { title: "Final title", content: "Final edited content", confirmedById: fixture.personId },
      );
    });

    test("two clients competing for one period produce one durable confirmation", async () => {
      const fixture = await createReviewFixture(first.prisma, "race");
      const period = "2026-W30";
      const results = await Promise.allSettled([
        first.prisma.governanceLog.create({ data: { organizationId: fixture.organizationId, confirmedById: fixture.personId, period, title: "A", content: "A", patterns: "[]", status: "published" } }),
        second.prisma.governanceLog.create({ data: { organizationId: fixture.organizationId, confirmedById: fixture.personId, period, title: "B", content: "B", patterns: "[]", status: "published" } }),
      ]);
      assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
      assert.equal(results.filter((result) => result.status === "rejected" && (result.reason as { code?: string }).code === "P2002").length, 1);
      assert.equal(await first.prisma.governanceLog.count({ where: { organizationId: fixture.organizationId, period } }), 1);
    });
  });
}

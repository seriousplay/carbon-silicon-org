import assert from "node:assert/strict";
import { test } from "node:test";
import { weeklyReviewPeriod } from "./weekly-review";

test("weekly review period is Monday through Sunday with a stable week key", () => {
  const period = weeklyReviewPeriod(new Date(2026, 6, 15, 12));
  assert.equal(period.start.getDay(), 1);
  assert.equal(period.start.getDate(), 13);
  assert.equal(period.end.getDate(), 20);
  assert.match(period.key, /^2026-W\d{2}$/);
});

test("Sunday remains in the week that started on the prior Monday", () => {
  const sunday = weeklyReviewPeriod(new Date(2026, 6, 19, 20));
  const monday = weeklyReviewPeriod(new Date(2026, 6, 13, 1));
  assert.equal(sunday.key, monday.key);
  assert.equal(sunday.start.getTime(), monday.start.getTime());
});

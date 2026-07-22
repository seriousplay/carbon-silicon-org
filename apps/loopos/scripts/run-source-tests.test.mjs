import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { parseTapSummary } from "./run-source-tests.mjs";

const thisFile = fileURLToPath(import.meta.url);

if (process.env.RUN_SOURCE_TESTS_REPORTER_FIXTURE === "1") {
  test("forced TAP reporter fixture", () => {
    assert.equal(1 + 1, 2);
  });
} else {
  test("explicit TAP reporting replaces the Node 22 spec summary that caused the review failure", () => {
    const runFixture = (reporter) => {
      const env = { ...process.env, RUN_SOURCE_TESTS_REPORTER_FIXTURE: "1" };
      delete env.NODE_TEST_CONTEXT;
      return spawnSync(
        process.execPath,
        [`--test-reporter=${reporter}`, thisFile],
        { encoding: "utf8", env },
      );
    };
    const spec = runFixture("spec");
    assert.equal(spec.status, 0, spec.stderr);
    assert.match(spec.stdout, /^ℹ tests 1\r?$/m);
    assert.throws(() => parseTapSummary(spec.stdout), /invalid TAP summary/);

    const tap = runFixture("tap");
    assert.equal(tap.status, 0, tap.stderr);
    assert.doesNotMatch(tap.stdout, /^ℹ tests \d+\r?$/m);
    assert.deepEqual(parseTapSummary(tap.stdout), {
      tests: 1,
      pass: 1,
      fail: 0,
      cancelled: 0,
      skipped: 0,
      todo: 0,
    });
  });

  test("TAP parser accepts CRLF but rejects count drift", () => {
    assert.equal(
      parseTapSummary("# tests 2\r\n# pass 1\r\n# fail 0\r\n# cancelled 0\r\n# skipped 1\r\n# todo 0\r\n").tests,
      2,
    );
    assert.throws(
      () => parseTapSummary("# tests 2\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n"),
      /invalid TAP summary counts/,
    );
  });
}

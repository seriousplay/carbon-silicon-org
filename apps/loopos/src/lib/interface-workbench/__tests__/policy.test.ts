import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { canAdministerWorkbench, type WorkbenchOperation } from "../policy";

describe("administrator workbench policy", () => {
  const operations: WorkbenchOperation[] = ["edit", "validate", "compare", "publish"];

  test("allows organization administrators", () => {
    for (const operation of operations) {
      assert.equal(canAdministerWorkbench({ membershipRole: "ORG_ADMIN" }, operation), true);
    }
  });

  test("denies members and unauthenticated actors", () => {
    for (const operation of operations) {
      assert.equal(canAdministerWorkbench({ membershipRole: "ORG_MEMBER" }, operation), false);
      assert.equal(canAdministerWorkbench({ membershipRole: null }, operation), false);
    }
  });
});

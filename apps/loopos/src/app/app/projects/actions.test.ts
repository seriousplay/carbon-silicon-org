import assert from "node:assert/strict";
import { test } from "node:test";

import { createProjectAction } from "./actions";

test("standalone Project creation fails closed before any dependency or write", async () => {
  const result = await createProjectAction(undefined, new FormData());
  assert.deepEqual(result, { error: "项目只能由战术会通过的项目提案创建" });
});

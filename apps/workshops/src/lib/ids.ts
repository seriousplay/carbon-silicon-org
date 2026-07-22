import { randomBytes } from "node:crypto";

export function createId(prefix: string) {
  return `${prefix}_${randomBytes(6).toString("hex")}`;
}

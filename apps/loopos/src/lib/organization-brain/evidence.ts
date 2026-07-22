import { createHash } from "node:crypto";

import { resolveBrainApplicationUrl } from "./link-resolver";
import {
  BRAIN_QUERY_CATALOG,
  type BrainFieldType,
  type BrainQueryResource,
} from "./query-plan";

const MAX_DISPLAY_FIELD_BYTES = 2 * 1024;
const MAX_DISPLAY_TOTAL_BYTES = 8 * 1024;

export type BrainEvidenceErrorCode =
  | "ROW_SHAPE_MISMATCH"
  | "DATABASE_POLICY_MISMATCH";

export class BrainEvidenceError extends Error {
  constructor(public readonly code: BrainEvidenceErrorCode) {
    super(`Brain evidence rejected: ${code}`);
    this.name = "BrainEvidenceError";
  }
}

export type BrainEvidencePacket = Readonly<{
  evidenceId: string;
  source: Readonly<{
    resource: BrainQueryResource;
    recordId: string;
    version: string;
  }>;
  display: Readonly<Record<string, string>>;
  truncatedFields: readonly string[];
  applicationUrl: string | null;
}>;

type EvidenceRow = Readonly<Record<string, unknown>>;

function fail(code: BrainEvidenceErrorCode): never {
  throw new BrainEvidenceError(code);
}

function isValidFieldValue(
  value: unknown,
  type: BrainFieldType,
  nullable: boolean,
): boolean {
  if (value === null) return nullable;
  if (type === "id" || type === "string") return typeof value === "string";
  if (type === "number") return typeof value === "number" && Number.isFinite(value);
  if (type === "datetime") {
    return (
      (value instanceof Date && Number.isFinite(value.getTime())) ||
      (typeof value === "string" && Number.isFinite(Date.parse(value)))
    );
  }
  if (type === "stringArray") {
    return Array.isArray(value) && value.every((entry) => typeof entry === "string");
  }
  if (type === "json") {
    if (typeof value !== "object" || value === null) return false;
    try {
      JSON.stringify(value);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

function assertRow(
  organizationId: string,
  resource: BrainQueryResource,
  row: unknown,
): EvidenceRow {
  if (
    typeof row !== "object" ||
    row === null ||
    Array.isArray(row) ||
    Object.getPrototypeOf(row) !== Object.prototype
  ) {
    fail("ROW_SHAPE_MISMATCH");
  }
  const record = row as Record<string, unknown>;
  const definition = BRAIN_QUERY_CATALOG[resource];
  const keys = Object.keys(record);
  if (
    keys.length !== definition.projection.length ||
    definition.projection.some((field) => !Object.hasOwn(record, field)) ||
    keys.some((field) => !Object.hasOwn(definition.fields, field))
  ) {
    fail("ROW_SHAPE_MISMATCH");
  }
  for (const field of definition.projection) {
    const fieldDefinition = definition.fields[field];
    if (
      !fieldDefinition ||
      !isValidFieldValue(record[field], fieldDefinition.type, fieldDefinition.nullable)
    ) {
      fail("ROW_SHAPE_MISMATCH");
    }
  }

  const rowOrganizationId =
    resource === "organizationIdentity" ? record.id : record.organizationId;
  if (rowOrganizationId !== organizationId) fail("DATABASE_POLICY_MISMATCH");
  const recordId = record[definition.recordIdField];
  if (
    typeof recordId !== "string" ||
    recordId.length === 0 ||
    Buffer.byteLength(recordId, "utf8") > 191
  ) {
    fail("ROW_SHAPE_MISMATCH");
  }
  return record;
}

function isoDate(value: unknown): string | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value.toISOString();
  }
  if (typeof value === "string" && Number.isFinite(Date.parse(value))) {
    return new Date(value).toISOString();
  }
  return null;
}

function displayString(value: unknown, type: BrainFieldType): string {
  if (value === null) return "";
  if (type === "datetime") return isoDate(value) ?? "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function truncateUtf8(
  value: string,
  maximumBytes: number,
): Readonly<{ value: string; truncated: boolean }> {
  if (Buffer.byteLength(value, "utf8") <= maximumBytes) {
    return { value, truncated: false };
  }
  let result = "";
  let bytes = 0;
  for (const character of value) {
    const characterBytes = Buffer.byteLength(character, "utf8");
    if (bytes + characterBytes > maximumBytes) break;
    result += character;
    bytes += characterBytes;
  }
  return { value: result, truncated: true };
}

function sourceVersion(
  resource: BrainQueryResource,
  row: EvidenceRow,
  observedAt: string,
): string {
  const sourceVersionField = BRAIN_QUERY_CATALOG[resource].sourceVersionField;
  if (sourceVersionField !== null) {
    return isoDate(row[sourceVersionField]) ?? fail("ROW_SHAPE_MISMATCH");
  }
  if (resource === "meetingDrafts") {
    return `notesRevision:${String(row.notesRevision)}`;
  }
  return isoDate(row.updatedAt) ?? observedAt;
}

function evidenceId(
  organizationId: string,
  resource: BrainQueryResource,
  recordId: string,
): string {
  return `ev_${createHash("sha256")
    .update(organizationId)
    .update("\0")
    .update(resource)
    .update("\0")
    .update(recordId)
    .digest("hex")}`;
}

export function buildBrainEvidencePackets(
  organizationId: string,
  resource: BrainQueryResource,
  rows: readonly unknown[],
  observationTime = new Date(),
): readonly BrainEvidencePacket[] {
  if (
    typeof organizationId !== "string" ||
    organizationId.length === 0 ||
    Buffer.byteLength(organizationId, "utf8") > 191 ||
    !Number.isFinite(observationTime.getTime())
  ) {
    fail("ROW_SHAPE_MISMATCH");
  }
  const observedAt = observationTime.toISOString();
  const validatedRows = rows.map((row) => assertRow(organizationId, resource, row));
  const definition = BRAIN_QUERY_CATALOG[resource];

  return Object.freeze(
    validatedRows.map((row) => {
      const display: Record<string, string> = {};
      const truncatedFields: string[] = [];
      let totalBytes = 0;
      for (const field of definition.displayFields) {
        const fieldDefinition = definition.fields[field];
        if (!fieldDefinition) fail("ROW_SHAPE_MISMATCH");
        const available = Math.max(0, MAX_DISPLAY_TOTAL_BYTES - totalBytes);
        const bounded = truncateUtf8(
          displayString(row[field], fieldDefinition.type),
          Math.min(MAX_DISPLAY_FIELD_BYTES, available),
        );
        display[field] = bounded.value;
        totalBytes += Buffer.byteLength(bounded.value, "utf8");
        if (bounded.truncated) truncatedFields.push(field);
      }
      const recordId = row[definition.recordIdField] as string;
      return Object.freeze({
        evidenceId: evidenceId(organizationId, resource, recordId),
        source: Object.freeze({
          resource,
          recordId,
          version: sourceVersion(resource, row, observedAt),
        }),
        display: Object.freeze(display),
        truncatedFields: Object.freeze(truncatedFields),
        applicationUrl: resolveBrainApplicationUrl(resource, row),
      });
    }),
  );
}

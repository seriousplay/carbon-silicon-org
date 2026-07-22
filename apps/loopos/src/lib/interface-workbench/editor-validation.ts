import { validateWorkflowResourceBounds } from "./bounds";
import { compileWorkflow } from "./compiler";
import type { ValidationDto } from "./dto";

const MAX_DEFINITION_BYTES = 256 * 1024;

export function validateSubmittedDefinition(value: FormDataEntryValue | null): ValidationDto {
  const serialized = String(value ?? "");
  if (Buffer.byteLength(serialized, "utf8") > MAX_DEFINITION_BYTES) return invalid("INPUT_TOO_LARGE", "$", "Definition exceeds 256 KiB");
  let definition: unknown;
  try { definition = JSON.parse(serialized); } catch { return invalid("INVALID_INPUT", "$", "Definition must be valid JSON"); }
  const bounds = validateWorkflowResourceBounds(definition);
  if (bounds.length) return { ok: false, issues: bounds };
  const result = compileWorkflow(definition);
  return result.ok
    ? { ok: true, sourceHash: result.sourceHash, compiledHash: result.compiledHash }
    : { ok: false, issues: result.issues };
}

function invalid(code: string, path: string, message: string): ValidationDto {
  return { ok: false, issues: [{ code, path, message }] };
}

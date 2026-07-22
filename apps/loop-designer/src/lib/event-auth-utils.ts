import { timingSafeEqual } from "node:crypto";

export function verifyEventAccessCode(input: string, expected: string) {
  const left = Buffer.from(input.trim());
  const right = Buffer.from(expected.trim());
  return left.length === right.length && timingSafeEqual(left, right);
}

export function normalizePhone(value: string) {
  const digits = value.replace(/[^\d]/g, "");
  if (/^1\d{10}$/.test(digits)) return digits;
  if (/^86(1\d{10})$/.test(digits)) return digits.slice(2);
  return "";
}

export function maskPhone(value: string) {
  return value.length === 11 ? `${value.slice(0, 3)}****${value.slice(7)}` : "现场学员";
}

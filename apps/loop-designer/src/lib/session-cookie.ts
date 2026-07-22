export function extractCookieValues(cookieHeader: string | null | undefined, names: string[]) {
  if (!cookieHeader) return [];
  const wanted = new Set(names);
  const values: string[] = [];

  for (const part of cookieHeader.split(";")) {
    const item = part.trim();
    const separator = item.indexOf("=");
    if (separator <= 0) continue;
    const name = item.slice(0, separator);
    if (!wanted.has(name)) continue;
    const value = item.slice(separator + 1).trim();
    if (value) values.push(value);
  }

  return values;
}

export function uniqueCookieValues(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}


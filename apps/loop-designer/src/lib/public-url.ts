import "server-only";

export function getPublicBaseUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3010").replace(/\/$/, "");
}

export function publicUrl(path: string) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return new URL(normalized, getPublicBaseUrl());
}

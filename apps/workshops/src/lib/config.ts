export const APP_NAME = "现场共创台";
export const BASE_PATH = "/field-cocreation";

export function joinAppPath(path = "") {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${BASE_PATH}${suffix}`.replace(/\/+/g, "/");
}

export function buildPublicUrl(path = "") {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || `http://localhost:3030${BASE_PATH}`;
  return new URL(joinAppPath(path), siteUrl).toString();
}

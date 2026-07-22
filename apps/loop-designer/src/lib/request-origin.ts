export function originFromUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function forwardedRequestOrigin(headers: Headers, fallbackOrigin: string) {
  const host = headers.get("x-forwarded-host") || headers.get("host");
  if (!host) return fallbackOrigin;
  const protocol = headers.get("x-forwarded-proto") || originFromUrl(fallbackOrigin)?.split(":")[0] || "https";
  return originFromUrl(`${protocol}://${host}`) || fallbackOrigin;
}

export function isTrustedRequestSource(headers: Headers, publicBaseUrl: string, requestOrigin: string) {
  const allowedOrigins = new Set(
    [originFromUrl(publicBaseUrl), originFromUrl(requestOrigin)].filter((origin): origin is string => Boolean(origin)),
  );

  const origin = originFromUrl(headers.get("origin"));
  if (origin) return allowedOrigins.has(origin);

  const referer = originFromUrl(headers.get("referer"));
  if (referer) return allowedOrigins.has(referer);

  return headers.get("sec-fetch-site") === "same-origin";
}

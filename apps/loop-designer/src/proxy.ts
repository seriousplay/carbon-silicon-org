import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Request middleware: generates a traceId for every API request.
 * The traceId is available via `request.headers.get("x-trace-id")` in route handlers.
 */
export function proxy(request: NextRequest) {
  // Only generate trace IDs for API routes
  if (request.nextUrl.pathname.startsWith("/loop-designer/api/")) {
    const traceId = request.headers.get("x-trace-id") || crypto.randomUUID();
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-trace-id", traceId);

    const response = NextResponse.next({
      request: { headers: requestHeaders },
    });

    // Echo traceId back to client for debugging
    response.headers.set("x-trace-id", traceId);
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/loop-designer/api/:path*",
};

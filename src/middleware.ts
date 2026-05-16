import { NextRequest, NextResponse } from "next/server";
import { verifyBasicAuth } from "@/lib/auth/basic";

/**
 * Verifies Bearer token for cron API routes.
 * Compares against CRON_SECRET env var.
 */
function verifyCronSecret(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return false;
  }
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }
  const token = authHeader.slice("Bearer ".length);
  return token === cronSecret;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // /api/cron/*, /api/ingest/*, /api/debug/* — Bearer CRON_SECRET verification
  if (
    pathname.startsWith("/api/cron/") ||
    pathname.startsWith("/api/ingest/") ||
    pathname.startsWith("/api/debug/")
  ) {
    if (verifyCronSecret(req)) {
      return NextResponse.next();
    }
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // All other matched routes — Basic authentication
  if (verifyBasicAuth(req)) {
    return NextResponse.next();
  }

  return new NextResponse("Unauthorized", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="newsapp"',
    },
  });
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     *   - _next/static  (Next.js static assets)
     *   - _next/image   (Next.js image optimisation)
     *   - /icons/*      (PWA icons)
     *   - /manifest.webmanifest
     *   - /sw.js        (Service Worker)
     */
    "/((?!_next/static|_next/image|icons/|manifest\\.webmanifest|sw\\.js).*)",
  ],
};

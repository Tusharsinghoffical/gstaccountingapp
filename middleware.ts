import { withAuth } from "next-auth/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";

export default withAuth(
  function middleware(request: NextRequest) {
    const pathname = request.nextUrl.pathname;
    const ip =
      request.ip ||
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "127.0.0.1";

    // 1. Rate-limit auth endpoints to 10 requests per minute per IP
    if (pathname.startsWith("/api/auth")) {
      const rl = checkRateLimit(`auth:${ip}`, { limit: 10, windowMs: 60 * 1000 });
      if (!rl.success) {
        return new NextResponse(
          JSON.stringify({
            error: "Too many authentication requests. Please try again later.",
          }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "Retry-After": String(rl.retryAfterSeconds),
            },
          }
        );
      }
    }

    // 2. Rate-limit OCR and AI routes to 15 requests per minute per IP
    if (pathname.startsWith("/api/ocr") || pathname === "/api/invoices/classify") {
      const rl = checkRateLimit(`ai-ocr:${ip}`, { limit: 15, windowMs: 60 * 1000 });
      if (!rl.success) {
        return new NextResponse(
          JSON.stringify({
            error: "Too many AI/OCR requests. Please try again later.",
          }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "Retry-After": String(rl.retryAfterSeconds),
            },
          }
        );
      }
    }

    // 3. Rate-limit file streaming to 60 requests per minute
    if (pathname.startsWith("/api/files")) {
      const rl = checkRateLimit(`files:${ip}`, { limit: 60, windowMs: 60 * 1000 });
      if (!rl.success) {
        return new NextResponse(
          JSON.stringify({
            error: "Too many file streaming requests.",
          }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "Retry-After": String(rl.retryAfterSeconds),
            },
          }
        );
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized({ token, req }) {
        const pathname = req.nextUrl.pathname;
        // Public paths matching the matcher
        if (pathname.startsWith("/api/auth")) {
          return true;
        }
        return !!token;
      },
    },
    pages: {
      signIn: "/login",
    },
  }
);

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/invoices/:path*",
    "/customers/:path*",
    "/suppliers/:path*",
    "/payments/:path*",
    "/reports/:path*",
    "/settings/:path*",
    "/ocr/:path*",
    "/audit-log/:path*",
    "/api/files/:path*",
    "/api/auth/:path*",
    "/api/ocr/:path*",
  ],
};

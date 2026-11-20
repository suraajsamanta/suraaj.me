import { randomUUID } from "node:crypto";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { eventFrom, isBot, record, VISITOR_COOKIE, VISITOR_HEADER } from "@/lib/analytics/events";

const RESUME_PATHS = new Set(["/resume", "/cv", "/suraaj_resume"]); // logged by the resume vault itself
const YEAR = 60 * 60 * 24 * 365;

const isInternalHost = (host: string) => host.startsWith("internal.");
const isLocal = (host: string) => /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);

function isNavigation(request: NextRequest) {
  if (request.method !== "GET") return false;
  const h = request.headers;
  const prefetch =
    h.has("next-router-prefetch") ||
    h.has("next-router-segment-prefetch") ||
    h.get("purpose") === "prefetch" ||
    (h.get("sec-purpose") ?? "").includes("prefetch");
  if (prefetch) return false;
  if (h.has("rsc")) return true; // client-side navigation between pages
  const dest = h.get("sec-fetch-dest");
  return dest ? dest === "document" : (h.get("accept") ?? "").includes("text/html");
}

export function proxy(request: NextRequest, event: NextFetchEvent) {
  const host = request.headers.get("host") ?? "";
  const { pathname } = request.nextUrl;

  if (isInternalHost(host)) {
    const url = request.nextUrl.clone();
    url.pathname = `/internal${pathname === "/" ? "" : pathname}`;
    return NextResponse.rewrite(url);
  }
  if (pathname === "/internal" || pathname.startsWith("/internal/")) {
    if (!isLocal(host)) return new NextResponse("Not found", { status: 404 });
    return NextResponse.next();
  }

  const existing = request.cookies.get(VISITOR_COOKIE)?.value;
  const vid = existing ?? randomUUID();
  const headers = new Headers(request.headers);
  headers.set(VISITOR_HEADER, vid);
  const response = NextResponse.next({ request: { headers } });

  if (!existing) {
    response.cookies.set(VISITOR_COOKIE, vid, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: YEAR,
      ...(host.endsWith("suraaj.me") ? { domain: "suraaj.me" } : {}),
    });
  }

  if (!RESUME_PATHS.has(pathname) && isNavigation(request) && !isBot(request)) {
    const visit = eventFrom(request, "view");
    visit.vid = vid;
    event.waitUntil(record(visit));
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/|favicon|icon|.*\\.[a-zA-Z0-9]+$).*)"],
};

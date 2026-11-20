// internal.suraaj.me (rewritten here by src/proxy.ts): owner-only visitor analytics.
import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { adminLoginPage, dashboardPage } from "@/lib/analytics/dashboard";
import { OWNER_COOKIE, recentEvents, sign, storeConfigured, verify } from "@/lib/analytics/events";

const ADMIN_COOKIE = "ss_admin";
const SESSION_SECONDS = 60 * 60 * 24 * 30;
const DAYS_SHOWN = 30;
const HEADERS = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer" };

const configured = () => Boolean(process.env.INTERNAL_PASSWORD && process.env.INTERNAL_SECRET);

function html(body: string, status = 200) {
  return new NextResponse(body, { status, headers: { ...HEADERS, "Content-Type": "text/html; charset=utf-8" } });
}

function samePassword(a: string, b: string) {
  const digest = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(digest(a), digest(b));
}

function isAdmin(request: NextRequest) {
  const [expires, sig] = (request.cookies.get(ADMIN_COOKIE)?.value ?? "").split(".");
  return Number(expires) > Date.now() / 1000 && verify(`admin:${expires}`, sig);
}

function home(request: NextRequest) {
  const host = request.headers.get("host") ?? request.nextUrl.host;
  const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  return new URL(host.startsWith("internal.") ? "/" : "/internal", `${proto}://${host}`);
}

export async function GET(request: NextRequest) {
  if (!configured()) return html("Internal analytics is not configured.", 503);
  if (!isAdmin(request)) return html(adminLoginPage(false), 401);
  let events: Awaited<ReturnType<typeof recentEvents>> = [];
  try {
    events = await recentEvents(Date.now() - DAYS_SHOWN * 864e5);
  } catch (error) {
    console.error("[internal] could not load events", error);
  }
  return html(dashboardPage(events, storeConfigured()));
}

export async function POST(request: NextRequest) {
  if (!configured()) return html("Internal analytics is not configured.", 503);
  const form = await request.formData().catch(() => null);
  const secure = process.env.NODE_ENV === "production";
  const host = request.headers.get("host") ?? "";
  const ownerDomain = host.endsWith("suraaj.me") ? { domain: "suraaj.me" } : {};

  if (form?.get("action") === "logout") {
    const response = NextResponse.redirect(home(request), 303);
    response.cookies.set(ADMIN_COOKIE, "", { path: "/", maxAge: 0 });
    return response;
  }

  const attempt = form?.get("password");
  if (typeof attempt !== "string" || !samePassword(attempt, process.env.INTERNAL_PASSWORD!)) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return html(adminLoginPage(true), 401);
  }

  const expires = String(Math.floor(Date.now() / 1000) + SESSION_SECONDS);
  const response = NextResponse.redirect(home(request), 303);
  const options = { httpOnly: true, secure, sameSite: "lax" as const, path: "/", maxAge: SESSION_SECONDS };
  response.cookies.set(ADMIN_COOKIE, `${expires}.${sign(`admin:${expires}`)}`, options);
  // Marks this browser as the owner on every *.suraaj.me site so your own visits can be hidden.
  const ownerExpires = String(Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365);
  response.cookies.set(OWNER_COOKIE, `${ownerExpires}.${sign(`owner:${ownerExpires}`)}`, {
    ...options,
    maxAge: 60 * 60 * 24 * 365,
    ...ownerDomain,
  });
  return response;
}

// Visitor events for internal.suraaj.me, stored as one capped Redis list
// (Upstash REST). Recording never throws: analytics must not break a page.
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

export type EventKind =
  | "view"
  | "resume_locked"
  | "resume_wrong"
  | "resume_unlocked"
  | "resume_opened"
  | "resume_download";

export type VisitEvent = {
  t: number;
  vid: string;
  kind: EventKind;
  path: string;
  q?: string;
  city?: string;
  region?: string;
  country?: string;
  lat?: number;
  lon?: number;
  device: "mobile" | "tablet" | "desktop";
  browser: string;
  ref?: string;
  owner?: true;
};

const LIST = "visits";
const MAX_EVENTS = 50_000;
export const VISITOR_COOKIE = "ss_vid";
export const VISITOR_HEADER = "x-ss-vid";
export const OWNER_COOKIE = "ss_owner";

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|quora|whatsapp|telegram|discord|slack|vercel|headless|lighthouse|curl|wget|python|node-fetch|axios|go-http|java\//i;

function redis() {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}

async function pipeline(commands: (string | number)[][]) {
  const db = redis();
  if (!db) return null;
  const res = await fetch(`${db.url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${db.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(commands),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`analytics store ${res.status}`);
  return (await res.json()) as { result?: unknown; error?: string }[];
}

export const storeConfigured = () => redis() !== null;

export function isBot(request: NextRequest) {
  return BOT.test(request.headers.get("user-agent") ?? "");
}

function secret() {
  return process.env.INTERNAL_SECRET ?? "";
}

export function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export function verify(value: string, signature: string) {
  if (!secret() || !signature) return false;
  const a = Buffer.from(sign(value));
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Signed "this browser is Suraaj" marker, shared across *.suraaj.me. */
export function isOwner(request: NextRequest) {
  const [expires, sig] = (request.cookies.get(OWNER_COOKIE)?.value ?? "").split(".");
  return Number(expires) > Date.now() / 1000 && verify(`owner:${expires}`, sig);
}

export function visitorId(request: NextRequest) {
  return request.headers.get(VISITOR_HEADER) ?? request.cookies.get(VISITOR_COOKIE)?.value ?? randomUUID();
}

function device(ua: string): VisitEvent["device"] {
  if (/ipad|tablet/i.test(ua)) return "tablet";
  return /mobi|iphone|android/i.test(ua) ? "mobile" : "desktop";
}

function browser(ua: string) {
  const name = /edg\//i.test(ua) ? "Edge" : /chrome|crios/i.test(ua) ? "Chrome" : /firefox|fxios/i.test(ua) ? "Firefox" : /safari/i.test(ua) ? "Safari" : "Other";
  const os = /iphone|ipad/i.test(ua) ? "iOS" : /android/i.test(ua) ? "Android" : /mac os/i.test(ua) ? "Mac" : /windows/i.test(ua) ? "Windows" : /linux/i.test(ua) ? "Linux" : "";
  return os ? `${name} · ${os}` : name;
}

function decode(value: string | null) {
  if (!value) return undefined;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function referrer(request: NextRequest) {
  const ref = request.headers.get("referer");
  if (!ref) return undefined;
  try {
    const host = new URL(ref).hostname.replace(/^www\./, "");
    return host.endsWith("suraaj.me") ? undefined : host;
  } catch {
    return undefined;
  }
}

export function eventFrom(request: NextRequest, kind: EventKind, path = request.nextUrl.pathname): VisitEvent {
  const h = request.headers;
  const ua = h.get("user-agent") ?? "";
  const lat = Number(h.get("x-vercel-ip-latitude"));
  const lon = Number(h.get("x-vercel-ip-longitude"));
  const params = request.nextUrl.searchParams;
  const room = params.get("room") ?? params.get("join") ?? params.get("code");
  return {
    t: Date.now(),
    vid: visitorId(request),
    kind,
    path,
    ...(room ? { q: room.slice(0, 12) } : {}),
    city: decode(h.get("x-vercel-ip-city")),
    region: decode(h.get("x-vercel-ip-country-region")),
    country: h.get("x-vercel-ip-country") ?? undefined,
    ...(Number.isFinite(lat) && Number.isFinite(lon) && (lat || lon) ? { lat, lon } : {}),
    device: device(ua),
    browser: browser(ua),
    ref: referrer(request),
    ...(isOwner(request) ? { owner: true as const } : {}),
  };
}

export async function record(event: VisitEvent) {
  try {
    await pipeline([
      ["LPUSH", LIST, JSON.stringify(event)],
      ["LTRIM", LIST, 0, MAX_EVENTS - 1],
    ]);
  } catch (error) {
    console.error("[analytics] record failed", error);
  }
}

export async function recentEvents(sinceMs: number): Promise<VisitEvent[]> {
  const result = await pipeline([["LRANGE", LIST, 0, MAX_EVENTS - 1]]);
  const rows = (result?.[0]?.result as string[] | undefined) ?? [];
  const events: VisitEvent[] = [];
  for (const row of rows) {
    try {
      const event = JSON.parse(row) as VisitEvent;
      if (event.t < sinceMs) break; // newest first
      events.push(event);
    } catch {
      // skip malformed rows
    }
  }
  return events;
}

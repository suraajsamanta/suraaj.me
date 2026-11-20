// Visitor events for internal.suraaj.me, stored as one capped Redis list
// (Upstash REST). Recording never throws: analytics must not break a page.
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import type { PublicActivity } from "./activity";

export type EventKind =
  | "view"
  | "resume_locked"
  | "resume_wrong"
  | "resume_unlocked"
  | "resume_opened"
  | "resume_download"
  | "resume_pdf_loaded"
  | PublicActivity["kind"];

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
  sid?: string;
  eid?: string;
  label?: string;
  durationMs?: number;
  game?: string;
  matchId?: string;
  roomId?: string;
  playerId?: string;
  estimated?: boolean;
  outcome?: "completed" | "abandoned" | "unknown";
};

const LIST = "visits";
const MAX_EVENTS = 50_000;
const ACTIVITY_LIST = "visits:activity:v1";
const MAX_ACTIVITY = 25_000;
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
    signal: AbortSignal.timeout(5_000),
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
  const gameLink = path === "/beerio" || path.startsWith("/beerio/") || path.startsWith("/madfun/");
  const room = gameLink ? params.get("room") ?? params.get("join") ?? params.get("code") : null;
  // Only a pseudonymous grouping key is needed for the legacy link-open count.
  const roomTag = room && secret() ? sign(`analytics-room:${room.slice(0, 64)}`).slice(0, 16) : undefined;
  return {
    t: Date.now(),
    vid: visitorId(request),
    kind,
    path,
    ...(roomTag ? { q: roomTag } : {}),
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

// Atomic per-browser/global rate gates, short-lived event dedupe, and a
// separate capped list so heartbeat traffic cannot evict historical page views.
const WRITE_ACTIVITY = `
if ARGV[3] ~= '' and redis.call('EXISTS', KEYS[4]) == 1 then return 0 end
local browserCount = redis.call('INCR', KEYS[2])
if browserCount == 1 then redis.call('EXPIRE', KEYS[2], 90) end
if browserCount > 360 then return 0 end
local total = redis.call('INCR', KEYS[3])
if total == 1 then redis.call('EXPIRE', KEYS[3], 90) end
if total > 2400 then return 0 end
if ARGV[3] ~= '' then redis.call('SET', KEYS[4], '1', 'EX', 600) end
redis.call('LPUSH', KEYS[1], ARGV[1])
redis.call('LTRIM', KEYS[1], 0, tonumber(ARGV[2]) - 1)
return 1`;

export function activityFrom(request: NextRequest, vid: string, activity: PublicActivity): VisitEvent {
  if ("game" in activity) {
    // The reporting browser is the host, not the guest being counted.
    return { ...activity, t: Date.now(), vid: activity.roomId ?? activity.matchId, device: "desktop", browser: "Game host report" };
  }
  const ua = request.headers.get("user-agent") ?? "";
  return { ...activity, t: Date.now(), vid, device: device(ua), browser: browser(ua),
    ...(isOwner(request) ? { owner: true } : {}) };
}

export async function recordActivity(event: VisitEvent, reporter: string) {
  const minute = Math.floor(event.t / 60_000);
  try {
    const result = await pipeline([["EVAL", WRITE_ACTIVITY, 4, ACTIVITY_LIST,
      `visits:rate:${minute}:${reporter}`, `visits:rate:${minute}`,
      `visits:dedupe:${reporter}:${event.eid ?? "none"}`,
      JSON.stringify(event), MAX_ACTIVITY, event.eid ?? ""]]);
    if (result?.[0]?.error) throw new Error("analytics activity write rejected");
  } catch (error) {
    console.error("[analytics] activity write failed", error);
  }
}

export async function recentEvents(sinceMs: number): Promise<VisitEvent[]> {
  // Split Redis replies to keep response sizes bounded. Enforce the time
  // cutoff per row: concurrent requests can reach storage out of order.
  const events: VisitEvent[] = [];
  const sources = [{ list: LIST, cap: MAX_EVENTS }, { list: ACTIVITY_LIST, cap: MAX_ACTIVITY }];
  const batch = 2000;
  await Promise.all(sources.map(async ({ list, cap }) => {
    for (let start = 0; start < cap; start += batch) {
      const result = await pipeline([["LRANGE", list, start, Math.min(start + batch, cap) - 1]]);
      if (result?.[0]?.error) throw new Error("analytics read rejected");
      const rows = (result?.[0]?.result as string[] | undefined) ?? [];
      let fresh = false;
      for (const row of rows) {
        try {
          const event = JSON.parse(row) as VisitEvent;
          if (!Number.isFinite(event.t) || event.t < sinceMs) continue;
          fresh = true;
          events.push(event);
        } catch {
          // skip malformed rows
        }
      }
      if (rows.length < batch || !fresh) break;
    }
  }));
  return events.sort((a, b) => b.t - a.t);
}

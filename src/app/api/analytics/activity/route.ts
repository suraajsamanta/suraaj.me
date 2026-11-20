import type { NextRequest } from "next/server";
import { activityId, parseActivity } from "@/lib/analytics/activity";
import { activityFrom, isBot, recordActivity, storeConfigured, VISITOR_COOKIE } from "@/lib/analytics/events";

const MAX_BYTES = 1400;
const noContent = () => new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });

function sameOrigin(request: NextRequest) {
  if (request.headers.get("sec-fetch-site") && request.headers.get("sec-fetch-site") !== "same-origin") return false;
  const host = request.headers.get("host") ?? request.nextUrl.host;
  try {
    const origin = new URL(request.headers.get("origin") ?? "");
    return origin.host === host && (origin.protocol === "https:" ||
      (origin.protocol === "http:" && /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)));
  } catch {
    return false;
  }
}

async function readSmallJson(request: NextRequest): Promise<unknown> {
  if (Number(request.headers.get("content-length")) > MAX_BYTES || !request.body) return null;
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let size = 0, text = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) {
        void reader.cancel().catch(() => {});
        return null;
      }
      text += decoder.decode(value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return new Response(null, { status: 403 });
  if (isBot(request) || request.headers.get("sec-gpc") === "1" || request.headers.get("dnt") === "1" ||
      !storeConfigured() || !process.env.INTERNAL_SECRET) return noContent();
  const vid = activityId(request.cookies.get(VISITOR_COOKIE)?.value);
  if (!vid) return noContent(); // Do not accept caller-supplied visitor IDs or create one here.
  const contentType = (request.headers.get("content-type") ?? "").split(";")[0].trim();
  if (contentType !== "application/json" && contentType !== "text/plain") return new Response(null, { status: 415 });
  const activity = parseActivity(await readSmallJson(request));
  if (!activity) return new Response(null, { status: 400 });
  await recordActivity(activityFrom(request, vid, activity), vid);
  return noContent();
}

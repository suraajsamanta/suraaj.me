import { createDecipheriv, createHash, createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { desktopPage, loginPage } from "./retro";

const COOKIE = "resume_access";
const SESSION_SECONDS = 60 * 60 * 24 * 7;
const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow",
  "Referrer-Policy": "no-referrer",
};

function config() {
  const key = Buffer.from(process.env.RESUME_KEY ?? "", "hex");
  const password = process.env.RESUME_PASSWORD;
  return key.length === 32 && password ? { key, password } : null;
}

function safeEqual(a: string, b: string) {
  const digest = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(digest(a), digest(b));
}

function sign(expires: string, key: Buffer) {
  return createHmac("sha256", key).update(`resume-session:${expires}`).digest("base64url");
}

function hasSession(request: NextRequest, key: Buffer) {
  const [expires, signature] = (request.cookies.get(COOKIE)?.value ?? "").split(".");
  if (!expires || !signature || Number(expires) < Date.now() / 1000) return false;
  return safeEqual(signature, sign(expires, key));
}

function decrypt(payload: string, key: Buffer) {
  const raw = Buffer.from(payload, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]);
}

function html(body: string, status = 200) {
  return new NextResponse(body, {
    status,
    headers: { ...PRIVATE_HEADERS, "Content-Type": "text/html; charset=utf-8" },
  });
}

const unavailable = () =>
  new NextResponse("Resume unavailable", { status: 503, headers: PRIVATE_HEADERS });

export function resumeRoute(payload: string) {
  async function GET(request: NextRequest) {
    const vault = config();
    if (!vault) return unavailable();
    if (!hasSession(request, vault.key)) return html(loginPage(false), 401);
    const { pathname, searchParams } = request.nextUrl;
    if (searchParams.get("view") !== "pdf") return html(desktopPage(pathname));
    const disposition = searchParams.has("download") ? "attachment" : "inline";
    return new NextResponse(new Uint8Array(decrypt(payload, vault.key)), {
      headers: {
        ...PRIVATE_HEADERS,
        "Content-Type": "application/pdf",
        "Content-Disposition": `${disposition}; filename="Suraaj_Samanta_Resume.pdf"`,
      },
    });
  }

  async function POST(request: NextRequest) {
    const vault = config();
    if (!vault) return unavailable();
    const form = await request.formData().catch(() => null);
    const attempt = form?.get("password");
    if (typeof attempt !== "string" || !safeEqual(attempt, vault.password)) {
      await new Promise((resolve) => setTimeout(resolve, 750));
      return html(loginPage(true), 401);
    }
    const expires = String(Math.floor(Date.now() / 1000) + SESSION_SECONDS);
    const response = NextResponse.redirect(new URL(request.nextUrl.pathname, request.url), 303);
    response.cookies.set(COOKIE, `${expires}.${sign(expires, vault.key)}`, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_SECONDS,
    });
    return response;
  }

  return { GET, POST };
}

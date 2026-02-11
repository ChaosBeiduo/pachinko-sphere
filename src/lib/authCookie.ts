import crypto from "node:crypto";

const COOKIE_NAME = "auth";

function getSigningSecret() {
  return process.env.AUTH_PASSWORD || "";
}

function base64url(input: string) {
  return Buffer.from(input, "utf8")
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function hmac(data: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(data).digest("base64url");
}

function decodeBase64url(input: string) {
  const base64 = input
    .replaceAll("-", "+")
    .replaceAll("_", "/")
    .padEnd(Math.ceil(input.length / 4) * 4, "=");
  return Buffer.from(base64, "base64").toString("utf8");
}

export function createAuthCookie(ttlSeconds: number) {
  const secret = getSigningSecret();
  if (!secret) throw new Error("Missing AUTH_PASSWORD");

  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = base64url(JSON.stringify({ exp }));
  const sig = hmac(payload, secret);
  const token = `${payload}.${sig}`;

  // HttpOnly: 前端 JS 读不到；Secure: https only
  const cookie = `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${ttlSeconds}`;
  return cookie;
}

export function verifyAuthCookie(cookieHeader: string | null) {
  const secret = getSigningSecret();
  if (!secret) return false;
  if (!cookieHeader) return false;

  const part = cookieHeader
    .split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith(`${COOKIE_NAME}=`));
  if (!part) return false;

  const token = decodeURIComponent(part.slice(COOKIE_NAME.length + 1));
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;

  const expected = hmac(payload, secret);
  // constant-time compare
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  if (!crypto.timingSafeEqual(a, b)) return false;

  try {
    const json = JSON.parse(decodeBase64url(payload)) as { exp?: number };
    if (!json.exp) return false;
    const now = Math.floor(Date.now() / 1000);
    return now <= json.exp;
  } catch {
    return false;
  }
}

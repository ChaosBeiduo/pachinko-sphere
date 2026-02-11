import type { APIRoute } from "astro";
import crypto from "node:crypto";
import { createAuthCookie } from "../../lib/authCookie";

function timingSafeEqual(a: string, b: string) {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

export const POST: APIRoute = async ({ request }) => {
  const { password } = await request.json().catch(() => ({ password: "" }));
  const expected = process.env.AUTH_PASSWORD;

  if (!expected) return new Response("Server not configured", { status: 500 });
  if (!timingSafeEqual(String(password), expected)) {
    return new Response(JSON.stringify({ ok: false }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const ttl = 60 * 60 * 24 * 7; // 7天
  const cookie = createAuthCookie(ttl);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": cookie,
    },
  });
};

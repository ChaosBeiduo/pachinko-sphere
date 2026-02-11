import type { APIRoute } from "astro";
import { verifyAuthCookie } from "../../lib/authCookie";

export const GET: APIRoute = async ({ request }) => {
  const ok = verifyAuthCookie(request.headers.get("cookie"));
  if (!ok) return new Response("Unauthorized", { status: 401 });

  const url = process.env.NAMES_BLOB_URL;
  if (!url) return new Response("Server not configured", { status: 500 });

  const blobRes = await fetch(url);
  if (!blobRes.ok) return new Response("Failed to load names", { status: 502 });

  const text = await blobRes.text();
  const names = text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  return new Response(JSON.stringify({ names }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

/**
 * Harness Dreams — Cloudflare Worker
 *
 * Serves the static Astro site (via the ASSETS binding) and handles the
 * waitlist API. First-party, no third parties — fits the privacy-first brand.
 *
 * Routes:
 *   POST /api/waitlist   { email, company? }  ->  { ok: true, already }
 *   * (everything else)                       ->  static assets / 404 page
 *
 * Storage: a KV namespace bound as WAITLIST (one entry per email, deduped).
 */

// Minimal structural types so we don't depend on @cloudflare/workers-types.
interface KV {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  list(opts?: { prefix?: string }): Promise<{ keys: { name: string }[] }>;
}
interface Env {
  WAITLIST: KV;
  ASSETS: { fetch(request: Request): Promise<Response> };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/waitlist") {
      return handleWaitlist(request, env);
    }

    // Everything else: serve the built static site.
    return env.ASSETS.fetch(request);
  },
};

async function handleWaitlist(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405, {
      allow: "POST",
    });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "bad_request" }, 400);
  }

  // Honeypot: real users never fill this hidden field; bots do. Drop silently
  // (return success so bots don't learn they were caught).
  const honeypot = typeof body.company === "string" ? body.company.trim() : "";
  if (honeypot !== "") {
    return json({ ok: true });
  }

  const email = String(body.email ?? "")
    .trim()
    .toLowerCase();
  if (email.length > 254 || !EMAIL_RE.test(email)) {
    return json({ error: "invalid_email" }, 422);
  }

  const key = `email:${email}`;
  let already = false;
  try {
    already = (await env.WAITLIST.get(key)) !== null;
    if (!already) {
      const record = {
        email,
        ts: new Date().toISOString(),
        ua: request.headers.get("user-agent") ?? "",
        ref: request.headers.get("referer") ?? "",
        src: (body.src as string) ?? "site",
      };
      await env.WAITLIST.put(key, JSON.stringify(record));
    }
  } catch (_err) {
    return json({ error: "storage_unavailable" }, 503);
  }

  return json({ ok: true, already });
}

function json(
  data: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extraHeaders,
    },
  });
}

export const jsonHeaders = {
  "Access-Control-Allow-Headers":
    "authorization, content-type, x-harness-user-id",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
};

export function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      ...jsonHeaders,
      ...(init.headers ?? {}),
    },
  });
}

export function jsonError(
  error: string,
  status = 400,
  detail?: unknown
): Response {
  return json(detail === undefined ? { error } : { error, detail }, { status });
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

export function bearerToken(request: Request): string {
  const header = request.headers.get("authorization") ?? "";
  if (header.toLowerCase().startsWith("bearer ")) {
    return header.slice(7).trim();
  }
  const url = new URL(request.url);
  return url.searchParams.get("token")?.trim() ?? "";
}

export function cloudUserIdFromRequest(request: Request): string {
  const url = new URL(request.url);
  return (
    request.headers.get("x-harness-user-id")?.trim() ||
    url.searchParams.get("cloudUserId")?.trim() ||
    url.searchParams.get("userId")?.trim() ||
    ""
  );
}

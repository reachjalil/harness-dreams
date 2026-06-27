import type { APIRoute } from "astro";

const SITE_URL = "https://harnessdreams.com";

export const GET: APIRoute = ({ site }) => {
  const origin = site?.toString().replace(/\/$/, "") ?? SITE_URL;

  return new Response(
    ["User-agent: *", "Allow: /", `Sitemap: ${origin}/sitemap.xml`, ""].join(
      "\n"
    ),
    {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    }
  );
};

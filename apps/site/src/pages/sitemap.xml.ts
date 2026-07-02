import type { APIRoute } from "astro";

const SITE_URL = "https://harnesshealth.com";
const escapeXml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

export const GET: APIRoute = ({ site }) => {
  const origin = site?.toString().replace(/\/$/, "") ?? SITE_URL;

  return new Response(
    [
      `<?xml version="1.0" encoding="UTF-8"?>`,
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
      `  <url>`,
      `    <loc>${escapeXml(`${origin}/`)}</loc>`,
      `    <changefreq>monthly</changefreq>`,
      `    <priority>1.0</priority>`,
      `  </url>`,
      `</urlset>`,
      "",
    ].join("\n"),
    {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    }
  );
};

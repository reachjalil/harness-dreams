import type { APIRoute } from "astro";

const SITE_URL = "https://harnessdreams.com";
const routes = [
  { path: "/", priority: "1.0", changefreq: "monthly" },
  { path: "/start/", priority: "0.9", changefreq: "monthly" },
  { path: "/privacy/", priority: "0.8", changefreq: "yearly" },
  { path: "/review/", priority: "0.8", changefreq: "monthly" },
  { path: "/docs/", priority: "0.7", changefreq: "monthly" },
  { path: "/docs/health-review/", priority: "0.7", changefreq: "monthly" },
  { path: "/case-studies/", priority: "0.7", changefreq: "monthly" },
  { path: "/case-studies/agent-fleet/", priority: "0.6", changefreq: "monthly" },
  { path: "/case-studies/ui-review-cost/", priority: "0.6", changefreq: "monthly" },
  { path: "/case-studies/shared-parser-helper/", priority: "0.6", changefreq: "monthly" },
  { path: "/blog/", priority: "0.7", changefreq: "monthly" },
  { path: "/blog/harness-health-app/", priority: "0.6", changefreq: "monthly" },
  { path: "/blog/morning-report-rule/", priority: "0.6", changefreq: "monthly" },
  { path: "/blog/local-first-telemetry/", priority: "0.6", changefreq: "monthly" },
];
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
      ...routes.flatMap((route) => [
        `  <url>`,
        `    <loc>${escapeXml(`${origin}${route.path}`)}</loc>`,
        `    <changefreq>${route.changefreq}</changefreq>`,
        `    <priority>${route.priority}</priority>`,
        `  </url>`,
      ]),
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

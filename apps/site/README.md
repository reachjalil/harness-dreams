# @harness-dreams/site

Marketing site for [harnessdreams.com](https://harnessdreams.com). Astro
(static) served by a Cloudflare Worker that also hosts the waitlist API.

## Develop

```bash
pnpm --filter @harness-dreams/site dev          # Astro dev server (UI only)
pnpm --filter @harness-dreams/site build        # build static site -> dist/
pnpm --filter @harness-dreams/site check        # astro type-check
```

To exercise the **Worker + waitlist API** locally (Miniflare simulates KV — no
account needed):

```bash
pnpm --filter @harness-dreams/site build
pnpm --filter @harness-dreams/site exec wrangler dev --local --port 8799
# then: curl -X POST localhost:8799/api/waitlist -H 'content-type: application/json' -d '{"email":"you@example.com"}'
```

## Architecture

- **`src/`** — the Astro site (components, layout, styles). All headlines read
  from the `--font-display` token (Fraunces today; see Canela below).
- **`worker/index.ts`** — the Cloudflare Worker. Serves the built site via the
  `ASSETS` binding and handles `POST /api/waitlist`.
- **`wrangler.jsonc`** — Worker + assets + KV config.

### Waitlist API

`POST /api/waitlist` with `{ "email": "...", "company": "" }`:

- validates + normalizes the email, dedupes (one KV entry per address),
- `company` is a **honeypot** — if non-empty the submission is silently dropped,
- returns `{ ok: true, already: boolean }`, or `4xx`/`503` on error.

Stored in the `WAITLIST` KV namespace. The front-end form
(`src/components/CTA.astro`) posts here and falls back to an on-device note +
GitHub if the request fails.

## Deploy (Cloudflare)

One-time: create the KV namespace and paste the ids into `wrangler.jsonc`
(`kv_namespaces[0].id` / `.preview_id`):

```bash
pnpm --filter @harness-dreams/site exec wrangler kv namespace create WAITLIST
pnpm --filter @harness-dreams/site exec wrangler kv namespace create WAITLIST --preview
```

Then:

```bash
pnpm --filter @harness-dreams/site deploy          # build + wrangler deploy
pnpm --filter @harness-dreams/site deploy:dry-run  # validate without uploading
```

Read collected emails:

```bash
pnpm --filter @harness-dreams/site exec wrangler kv key list --binding WAITLIST
```

## Brand font (Canela)

The display font is **Canela** (licensed); the repo ships **Fraunces** as a free
stand-in. To activate Canela, drop the `.woff2` files into `public/fonts/` and
follow `public/fonts/README.md` (uncomment one block, reorder one token).

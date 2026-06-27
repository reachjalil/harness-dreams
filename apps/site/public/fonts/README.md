# Self-hosted display font (Canela)

The site's display/headline font is **Canela** (Commercial Type) per the
"Quiet Orbit" brand. Canela is a **licensed** font, so its files are not in this
repo. Until they're added, the site ships **Fraunces** (Google Fonts) as a
close, free stand-in — see `src/styles/global.css` (`--font-display`).

## To activate Canela

1. **Drop the licensed `.woff2` files here** (`apps/site/public/fonts/`) with
   these exact names (or edit the `@font-face` `src` paths to match yours):

   | File | Used for |
   |---|---|
   | `canela-regular.woff2` | body of headlines (weight 400) |
   | `canela-medium.woff2` | wordmark / emphasis (weight 500) |
   | `canela-italic.woff2` | the italic tagline |

2. In `src/styles/global.css`, **uncomment the `@font-face` block** marked
   `CANELA ACTIVATION` and move `"Canela"` to the front of `--font-display`.

3. Optionally drop the Fraunces `<link>` in `src/layouts/SiteLayout.astro`
   (keep `Inter`), then `pnpm --filter @harness-dreams/site build`.

That's the whole swap — no component changes needed; every headline reads from
`--font-display`.

> Tip: subset the files (Latin, the weights above) to keep them small. WOFF2
> only. Do **not** commit licensed font files to a public repo unless your
> license permits redistribution.

# Project Rules

<!-- harness-health:context:start -->
## Harness Health — context hygiene

Apply these user-approved recommendations from the latest Health Review:

- ## Cloudflare Site Deployment
- The baseline site lives in `apps/site` and deploys with Wrangler to Cloudflare for `harnesshealth.com` and `www.harnesshealth.com`.
- Before deployment, verify Wrangler is authenticated and run the workspace validation commands from `CLAUDE.md`.
- After deployment, verify `https://harnesshealth.com`, `https://www.harnesshealth.com`, the workers.dev URL, and an unknown path for the custom 404.
- Cloudflare may prepend its zone-level Managed robots.txt / Content Signals block to `robots.txt`; treat this as a dashboard setting, not a deploy failure, as long as the project `Allow: /` and `Sitemap:` lines are present.
- If `www` initially fails locally after a successful custom-domain deploy, check Cloudflare DNS or `1.1.1.1` before assuming the deploy failed, because local negative-DNS caching can lag.
<!-- harness-health:context:end -->

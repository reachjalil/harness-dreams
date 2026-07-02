import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://harnesshealth.com",
  output: "static",
  devToolbar: {
    enabled: false,
  },
  vite: {
    cacheDir: "../../node_modules/.vite/harness-health-site",
  },
});

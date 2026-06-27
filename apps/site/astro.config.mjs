import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://harnessdreams.com",
  output: "static",
  devToolbar: {
    enabled: false,
  },
  vite: {
    cacheDir: "../../node_modules/.vite/harness-dreams-site",
  },
});

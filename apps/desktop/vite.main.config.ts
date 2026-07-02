import { defineConfig } from "vite";

// https://vitejs.dev/config
export default defineConfig({
  build: {
    rollupOptions: {
      // PGlite loads its WASM/runtime assets relative to its published package.
      // Keeping it external avoids Electron main-process bundle URLs that the
      // Node filesystem loader cannot read.
      external: ["@electric-sql/pglite"],
    },
  },
});

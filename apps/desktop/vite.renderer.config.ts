import react from "@vitejs/plugin-react";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

// https://vitejs.dev/config
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: /^react$/,
        replacement: resolve(workspaceRoot, "node_modules/react/index.js"),
      },
      {
        find: /^react\/jsx-dev-runtime$/,
        replacement: resolve(
          workspaceRoot,
          "node_modules/react/jsx-dev-runtime.js"
        ),
      },
      {
        find: /^react\/jsx-runtime$/,
        replacement: resolve(
          workspaceRoot,
          "node_modules/react/jsx-runtime.js"
        ),
      },
      {
        find: /^react-dom$/,
        replacement: resolve(workspaceRoot, "node_modules/react-dom/index.js"),
      },
      {
        find: /^react-dom\/client$/,
        replacement: resolve(workspaceRoot, "node_modules/react-dom/client.js"),
      },
    ],
    dedupe: ["react", "react-dom"],
  },
});

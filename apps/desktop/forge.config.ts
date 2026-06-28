import { FuseV1Options, FuseVersion } from "@electron/fuses";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerZIP } from "@electron-forge/maker-zip";
import { FusesPlugin } from "@electron-forge/plugin-fuses";
import { VitePlugin } from "@electron-forge/plugin-vite";
import type { ForgeConfig } from "@electron-forge/shared-types";

const config: ForgeConfig = {
  packagerConfig: {
    name: "Harness Dreams",
    appBundleId: "com.reachjalil.harnessdreams",
    appCategoryType: "public.app-category.developer-tools",
    asar: true,
    // Menu-bar-only app: no Dock icon.
    extendInfo: {
      LSUIElement: true,
    },
  },
  rebuildConfig: {},
  makers: [new MakerZIP({}, ["darwin"]), new MakerSquirrel({})],
  plugins: [
    new VitePlugin({
      // Node-side bundles: the main process + the preload bridge.
      build: [
        { entry: "src/main.ts", config: "vite.main.config.ts", target: "main" },
        {
          entry: "src/preload.ts",
          config: "vite.preload.config.ts",
          target: "preload",
        },
      ],
      // One renderer build serves the single React UI page (index.html).
      renderer: [{ name: "main_window", config: "vite.renderer.config.ts" }],
    }),
    // Fuses lock down Electron capabilities at package time.
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: false,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;

import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { VitePlugin } from '@electron-forge/plugin-vite';

const config: ForgeConfig = {
  packagerConfig: {
    appBundleId: 'com.example.healthpattern',
    appCategoryType: 'public.app-category.healthcare-fitness',
    icon: './assets/app-icon',
    osxSign: {},
    // Configure osxNotarize with Apple API key credentials in CI secrets.
  },
  makers: [new MakerZIP({}, ['darwin']), new MakerDMG({ format: 'ULFO' }, ['darwin'])],
  plugins: [
    new VitePlugin({
      build: [
        { entry: 'src/main/main.ts', config: 'vite.main.config.ts' },
        { entry: 'src/preload/preload.ts', config: 'vite.preload.config.ts' },
      ],
      renderer: [{ name: 'main_window', config: 'vite.renderer.config.ts' }],
    }),
  ],
};

export default config;

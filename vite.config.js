import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// On GitHub Pages the app is served from https://<user>.github.io/<repo>/, so derive the base
// from the repository name in CI. Locally it is served from the root.
const repo = process.env.GITHUB_REPOSITORY?.split('/')[1];

export default defineConfig({
  base: repo ? `/${repo}/` : '/',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      // Own service worker (src/sw.js) for measurement reminders; Workbox still injects the precache list.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'HeartPass',
        short_name: 'HeartPass',
        description: 'Track your blood pressure measurements offline.',
        theme_color: '#6750a4',
        background_color: '#6750a4',
        display: 'standalone',
        start_url: '.',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      injectManifest: {
        // Precache everything, including BeerCSS's Material Symbols fonts, so the app works fully offline.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
      },
    }),
  ],
});

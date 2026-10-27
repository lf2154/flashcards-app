/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import pkg from './package.json' with { type: 'json' }

// 網站部署在 GitHub Pages 的子路徑 /flashcards-app/。
// base、manifest 的 start_url 與 scope、Service Worker 的範圍都必須用同一個值，
// 否則加到主畫面後會出現白畫面（SPEC 10.1）。
const BASE = '/flashcards-app/'

export default defineConfig({
  base: BASE,
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // 由使用者按「更新」才套用新版，避免複習到一半被強制重新整理
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: '記憶卡',
        short_name: '記憶卡',
        description: '手機優先的間隔重複記憶卡 App，資料只存在你的手機裡。',
        lang: 'zh-TW',
        start_url: BASE,
        scope: BASE,
        id: BASE,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#ffffff',
        theme_color: '#4f46e5',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // 預先快取所有建置產物，飛航模式下也能開啟
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        navigateFallback: `${BASE}index.html`,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
})

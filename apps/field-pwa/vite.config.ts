import path from 'node:path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // spec §12.2 (Workbox) — injectManifest, GENERATE-SW değil: statik asset
    // precache'i Workbox halleder ama src/sw.ts kendi Background Sync `sync`
    // event handler'ını (bkz. o dosya) elle yazıyor, generateSW modu bunu
    // desteklemiyor.
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      // Elle main.tsx'te register ediliyor (virtual:pwa-register) —
      // resetInterruptedSyncs()/requestSync() ile aynı yerde, sıralı çalışması
      // gerekiyor (bkz. main.tsx).
      injectRegister: false,
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true,
        type: 'module',
      },
      manifest: {
        name: 'GüzelKabir Saha',
        short_name: 'GK Saha',
        start_url: '/gorevler',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#1d4a3a',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    port: 3002,
  },
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // 🟢 1. Avisamos quais arquivos extras ele deve incluir na instalação
      includeAssets: ['favicon.ico', 'favicon-32x32.png', 'favicon-16x16.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Rachapp',
        short_name: 'Rachapp',
        description: 'Divida suas contas e corridas com amigos facilmente.',
        theme_color: '#05080f',
        background_color: '#05080f',
        display: 'standalone',
        start_url: '/', // 🟢 Muito importante para o PWABuilder
        lang: 'pt-BR',  // 🟢 Exigência nova
        orientation: 'portrait', // 🟢 Trava o app na vertical (como app de celular)
        icons: [
          {
            src: '/android-chrome-192x192.png', // 🟢 Barra inicial garantida
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/android-chrome-512x512.png', // 🟢 Barra inicial garantida
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable' // PWABuilder ama isso
          }
        ]
      }
    })
  ],
})

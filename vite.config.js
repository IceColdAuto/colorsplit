import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // host: true exposes the dev server on the LAN; allowedHosts lets a
  // Cloudflare quick-tunnel (random *.trycloudflare.com subdomain) reach it
  // for temporary cross-internet multiplayer testing. Dev-only — ignored by
  // the production build that Vercel serves.
  server: {
    host: true,
    allowedHosts: ['.trycloudflare.com'],
  },
  // `vite preview` serves the production build — more stable than the dev
  // server for an external tunnel test (no HMR websocket churn).
  preview: {
    host: true,
    port: 5173,
    strictPort: true,
    allowedHosts: ['.trycloudflare.com'],
  },
})

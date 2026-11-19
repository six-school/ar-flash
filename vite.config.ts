import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { playwright } from "@vitest/browser-playwright";

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Arabic Flashcards",
        short_name: "Flashcards",
        start_url: ".",
        display: "standalone",
        background_color: "#000000",
        theme_color: "#000000",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
      workbox: {
        // The app shell is precached; the card file ar-en.json is fetched network-first
        // so edits on the server show up, with the cached copy used offline.
        globPatterns: ["**/*.{js,css,html,png}"],
        runtimeCaching: [
          {
            urlPattern: /ar-en\.json$/,
            handler: "NetworkFirst",
            options: { cacheName: "cards" },
          },
        ],
      },
    }),
  ],
  test: {
    projects: [
      // Logic tests run in Node.
      {
        extends: true,
        test: { name: "unit", include: ["src/**/*.test.ts"], environment: "node" },
      },
      // Component tests run in headless Chromium.
      {
        extends: true,
        test: {
          name: "browser",
          include: ["src/**/*.test.tsx"],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
});

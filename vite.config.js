import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig({
    base: "./",
    server: {
        proxy: {
            "/api": { target: "http://127.0.0.1:3000", changeOrigin: true },
        },
    },
    preview: {
        proxy: {
            "/api": { target: "http://127.0.0.1:3000", changeOrigin: true },
        },
    },
    resolve: {
        alias: { "@": path.resolve(__dirname, "./src") },
    },
    plugins: [
        react(),
        VitePWA({
            registerType: "autoUpdate",
            includeAssets: ["favicon.svg", "icon.svg", "offline.html"],
            manifest: {
                id: "./",
                name: "Pulse HUD",
                short_name: "Pulse",
                description: "Real-time heads-up display for live qualitative research interviews",
                theme_color: "#0a0f17",
                background_color: "#0a0f17",
                display: "standalone",
                display_override: ["standalone", "browser"],
                orientation: "any",
                scope: "./",
                start_url: "./",
                categories: ["productivity", "utilities"],
                icons: [
                    {
                        src: "icon.svg",
                        sizes: "512x512",
                        type: "image/svg+xml",
                        purpose: "any",
                    },
                    {
                        src: "favicon.svg",
                        sizes: "64x64",
                        type: "image/svg+xml",
                        purpose: "any",
                    },
                ],
            },
            workbox: {
                globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
                navigateFallback: "index.html",
                navigateFallbackDenylist: [/^\/api\//, /^\/ws\//],
                runtimeCaching: [
                    {
                        urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                        handler: "CacheFirst",
                        options: {
                            cacheName: "google-fonts-cache",
                            expiration: {
                                maxEntries: 10,
                                maxAgeSeconds: 60 * 60 * 24 * 365,
                            },
                            cacheableResponse: { statuses: [0, 200] },
                        },
                    },
                ],
            },
            devOptions: {
                enabled: false,
            },
        }),
    ],
});

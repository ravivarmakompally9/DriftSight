import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const API_PROXY = {
  target: process.env.VITE_API_TARGET ?? "http://localhost:8000",
  changeOrigin: true,
};

export default defineConfig({
  // The static build is served from a sub-path (https://<user>.github.io/DriftSight/).
  base: process.env.VITE_BASE ?? "/",
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  server: {
    port: 5173,
    host: true,
    proxy: { "/api": API_PROXY },
  },
  // `npm run preview` serves the production bundle; it needs the same proxy so
  // the built app can be checked without nginx.
  preview: {
    port: 4173,
    host: true,
    proxy: { "/api": API_PROXY },
  },
  build: { outDir: "dist", sourcemap: false, chunkSizeWarningLimit: 1400 },
});

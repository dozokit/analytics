import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  // WRANGLER_CONFIG=other.jsonc builds with another Wrangler config, e.g. a second deployment.
  plugins: [react(), cloudflare({ configPath: process.env.WRANGLER_CONFIG })],
  server: { port: 5190 },
  // MapLibre starts its worker from a file beside its own; pre-bundling would separate them.
  optimizeDeps: { exclude: ["maplibre-gl"] },
});

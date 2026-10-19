import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  cacheDir: "node_modules/.vite-dev",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    // Bundle lazy-route form dependencies before the browser requests them.
    include: ["@hookform/resolvers/zod", "react-hook-form", "zod"],
  },
  server: {
    watch: {
      // Avoid Linux inotify limits when other projects or IDEs use many watchers.
      usePolling: true,
      interval: 300,
    },
    allowedHosts: ["ticket-new.aiminds.io.vn"],
    proxy: {
      "/api": {
        target: "https://ticket-api.aiminds.io.vn",
        changeOrigin: true,
        secure: true,
      },
      "/media": {
        target: "https://ticket-api.aiminds.io.vn",
        changeOrigin: true,
        secure: true,
      },
    },
  },
});

import path from "path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), ["VITE_", "DEV_"]);
  const apiTarget = env.VITE_API_BASE_URL;
  const allowedHosts = (env.DEV_ALLOWED_HOSTS || "")
    .split(",")
    .map((host) => host.trim())
    .filter(Boolean);

  return {
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
      allowedHosts,
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
          secure: true,
        },
        "/media": {
          target: apiTarget,
          changeOrigin: true,
          secure: true,
        },
      },
    },
  };
});

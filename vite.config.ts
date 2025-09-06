import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import themePlugin from "@replit/vite-plugin-shadcn-theme-json";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

export default defineConfig({
  // Корень фронтенда
  root: path.resolve(__dirname, "client"),

  // Относительные пути для продакшена
  base: "./",

  plugins: [
    react(), // React с Fast Refresh
    runtimeErrorOverlay({ hmr: { overlay: false } }), // ошибки во время dev
    themePlugin(), // твоя тема shadcn
  ],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client/src"),
      "@shared": path.resolve(__dirname, "shared"),
    },
  },

  build: {
    // Папка для Express (dist/public)
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,

    rollupOptions: {
      // Важно: путь к index.html **относительно root**
      input: "index.html",
    },
  },
});

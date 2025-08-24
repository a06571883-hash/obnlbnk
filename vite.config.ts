import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import themePlugin from "@replit/vite-plugin-shadcn-theme-json";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  root: path.resolve(__dirname, "client"), // корень фронта
  base: "./", // относительные пути для продакшена
  plugins: [
    react({
      fastRefresh: true,
    }),
    runtimeErrorOverlay({
      hmr: {
        overlay: false,
      },
    }),
    themePlugin(),
    ...(process.env.NODE_ENV !== "production" && process.env.REPL_ID
      ? [
          (await import("@replit/vite-plugin-cartographer")).cartographer(),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
  build: {
    outDir: path.resolve(__dirname, "dist/public"), // для Express
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, "client/index.html"), // явная точка входа
    },
  },
});

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import themePlugin from "@replit/vite-plugin-shadcn-theme-json";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

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
          // динамический импорт плагина для Replit
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          require("@replit/vite-plugin-cartographer").cartographer(),
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
      input: path.resolve(__dirname, "client/index.html"), // явно указываем точку входа
    },
  },
});

import express, { Request, Response, NextFunction } from "express";
import path from "path";
import { fileURLToPath } from "url";
import { registerRoutes } from "./routes";
import { db } from "./database/connection";
import { setupGlobalErrorHandlers, logError, errorHandler, notFoundHandler } from "./utils/error-handler";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Настройка JSON body parser
app.use(express.json({ limit: "128kb" }));
app.use(express.urlencoded({ extended: false, limit: "128kb" }));

// Минимальный CORS
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

// API маршруты
registerRoutes(app);

// Централизованная обработка ошибок
setupGlobalErrorHandlers();
app.use(notFoundHandler);
app.use(errorHandler);

// Статика фронта (после сборки Vite)
const clientDist = path.join(__dirname, "../client/dist");
app.use(express.static(clientDist));

// SPA fallback для React Router
app.get("*", (req: Request, res: Response) => {
  res.sendFile(path.join(clientDist, "index.html"));
});

// Экспорт для Vercel Serverless
export default app;

// Если нужно локально запускать (для разработки)
if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен локально на http://localhost:${PORT}`);
  });
}

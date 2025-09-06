import express, { Request, Response, NextFunction } from "express";
import path from "path";
import fs from "fs";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { registerRoutes } from "./routes";
import { db } from "./database/connection";
import { setupGlobalErrorHandlers, logError, errorHandler, notFoundHandler } from "./utils/error-handler";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Установка режима окружения
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

// Устанавливаем глобальные обработчики ошибок
setupGlobalErrorHandlers();

// Дополнительные обработчики специфичные для этого приложения
process.on('uncaughtException', (error) => {
  console.error('🚨 КРИТИЧЕСКАЯ ОШИБКА (uncaughtException):', error);
  logError(error);
  // Не завершаем процесс, чтобы приложение продолжало работать
});

process.on('unhandledRejection', (reason: any, promise) => {
  console.error('🚨 НЕОБРАБОТАННЫЙ PROMISE (unhandledRejection):', reason);
  logError(reason instanceof Error ? reason : new Error(String(reason)));
  // Не завершаем процесс, чтобы приложение продолжало работать
});

// Обрабатываем сигналы завершения
process.on('SIGTERM', () => {
  console.log('🛑 Получен сигнал SIGTERM, выполняется плавное завершение...');
});

process.on('SIGINT', () => {
  console.log('🛑 Получен сигнал SIGINT, выполняется плавное завершение...');
});

const app = express();

// Настройка JSON body parser
app.use(express.json({ limit: "128kb" }));
app.use(express.urlencoded({ extended: false, limit: "128kb" }));

// Минимальный CORS
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE,OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

// API маршруты
registerRoutes(app);

// Централизованная обработка ошибок
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
  const HOST = "0.0.0.0";
  
  app.listen(PORT, HOST, () => {
    console.log(`🚀 Сервер запущен на http://${HOST}:${PORT}`);
    console.log(`🔧 Режим: ${process.env.NODE_ENV}`);
  }).on('error', (error) => {
    console.error(`❌ Ошибка запуска сервера:`, error);
    process.exit(1);
  });
}
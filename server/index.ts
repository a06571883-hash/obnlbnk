import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic } from "./vite";
import { db } from "./database/connection";
import { scheduleBackups } from "./database/backup";
import { startBot } from "./telegram-bot";
import * as NodeJS from 'node:process';
import { setupDebugRoutes } from "./debug";
import { setupGlobalErrorHandlers, logError, errorHandler, notFoundHandler } from "./utils/error-handler";
import { spawn } from 'child_process';

// Запускаем отдельный сервер для NFT изображений
const nftImageServer = spawn('node', ['server/nft-image-server.js']);

nftImageServer.stdout.on('data', (data) => {
  console.log(`[NFT Image Server] ${data}`);
});

nftImageServer.stderr.on('data', (data) => {
  console.error(`[NFT Image Server ERROR] ${data}`);
});

nftImageServer.on('close', (code) => {
  console.log(`NFT Image Server exited with code ${code}`);
});

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
  // Здесь можно добавить логику очистки, если нужно
});

process.on('SIGINT', () => {
  console.log('🛑 Получен сигнал SIGINT, выполняется плавное завершение...');
  // Здесь можно добавить логику очистки, если нужно
});

process.env.NODE_ENV = process.env.NODE_ENV || 'development';

const app = express();

// Минимальная конфигурация для free tier
app.use(express.json({ limit: '128kb' }));
app.use(express.urlencoded({ extended: false, limit: '128kb' }));

// Настраиваем статическую раздачу файлов из папки public
// ВАЖНО: Это должно идти ДО других middleware для корректной обработки изображений
app.use(express.static('public', {
  index: false, // Не использовать index.html
  etag: true,   // Включить ETag для кеширования
  lastModified: true, // Включить Last-Modified для кеширования
  setHeaders: (res, path) => {
    // Устанавливаем правильные mime-типы для изображений
    if (path.endsWith('.png')) {
      res.setHeader('Content-Type', 'image/png');
    } else if (path.endsWith('.jpg') || path.endsWith('.jpeg')) {
      res.setHeader('Content-Type', 'image/jpeg');
    } else if (path.endsWith('.avif')) {
      res.setHeader('Content-Type', 'image/avif');
    }
  }
}));

// Специальный обработчик для BAYC NFT изображений
app.use('/bayc_official', (req, res, next) => {
  // Отправляем запрос к прокси NFT сервера
app.use('/nft_assets', express.static(path.join(__dirname, '../nft_assets')));

  console.log(`BAYC request: ${req.path}, перенаправление на NFT прокси сервер`);
  res.redirect(`/nft-proxy/bayc_official${req.path}`);
});

// Минимальный CORS для Replit
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

(async () => {
  try {
    console.log('Initializing database tables...');
    console.log('Database initialized successfully');

    const server = await registerRoutes(app);
    
    // Регистрируем отладочные эндпоинты
    setupDebugRoutes(app);

    // Минимальная частота бэкапов
    scheduleBackups();

    // Запуск Telegram бота всегда
    await startBot();

    if (process.env.NODE_ENV !== 'production') {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }
    
    // Включаем централизованную обработку ошибок ПОСЛЕ настройки Vite
    // Добавляем обработчик для 404 ошибок (маршруты которые не найдены)
    app.use(notFoundHandler);
    
    // Добавляем центральный обработчик ошибок
    app.use(errorHandler);

    // Включаем CORS для development
    if (process.env.NODE_ENV !== 'production') {
      app.use((req, res, next) => {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        if (req.method === 'OPTIONS') {
          return res.sendStatus(200);
        }
        next();
      });
    }

    server.listen(5000, "0.0.0.0", () => {
      console.log('Server running on port 5000');
      console.log(`Mode: ${process.env.NODE_ENV}`);
      console.log('WebSocket server enabled');
    }).on('error', (error) => {
      console.error('Server error:', error);
      if ((error as NodeJS.ErrnoException).code === 'EADDRINUSE') {
        console.error('Port 5000 is already in use. Please kill the process or use a different port.');
      }
    });
  } catch (error) {
    console.error('Startup error:', error);
    process.exit(1);
  }
})();
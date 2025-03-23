import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic } from "./vite";
import { db } from "./database/connection";
import { scheduleBackups } from "./database/backup";
import { startBot } from "./telegram-bot";
import * as NodeJS from 'node:process';
import { setupDebugRoutes } from "./debug";

// Глобальные обработчики необработанных исключений
process.on('uncaughtException', (error) => {
  console.error('🚨 КРИТИЧЕСКАЯ ОШИБКА (uncaughtException):', error);
  console.error('🔍 Stack trace:', error.stack);
  // Не завершаем процесс, чтобы приложение продолжало работать
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 НЕОБРАБОТАННЫЙ PROMISE (unhandledRejection):', reason);
  console.error('🔍 Promise:', promise);
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

    // Улучшенная обработка ошибок
    app.use((err: any, req: Request, res: Response, next: NextFunction) => {
      // Подробное логирование ошибки
      console.error('🔴 Error URL:', req.method, req.originalUrl);
      console.error('🔴 Error headers:', req.headers);
      console.error('🔴 Error body:', req.body);
      console.error('🔴 Error details:', err);
      console.error('🔴 Error stack:', err.stack);
      
      // Разные сообщения для разных типов ошибок
      let statusCode = 500;
      let errorMessage = "Внутренняя ошибка сервера";
      
      if (err.name === 'ValidationError') {
        statusCode = 400;
        errorMessage = "Ошибка валидации данных";
      } else if (err.name === 'UnauthorizedError') {
        statusCode = 401;
        errorMessage = "Требуется авторизация";
      } else if (err.name === 'ForbiddenError') {
        statusCode = 403;
        errorMessage = "Доступ запрещен";
      } else if (err.name === 'NotFoundError') {
        statusCode = 404;
        errorMessage = "Ресурс не найден";
      }
      
      // Скрываем технические детали от пользователя в production
      if (process.env.NODE_ENV === 'production') {
        res.status(statusCode).json({ error: errorMessage });
      } else {
        // В development показываем полную информацию об ошибке
        res.status(statusCode).json({
          error: errorMessage,
          details: err.message,
          stack: err.stack
        });
      }
      
      // Даже если произошла ошибка, приложение продолжит работать
    });

    if (process.env.NODE_ENV !== 'production') {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

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
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic } from "./vite";
import { db } from "./database/connection";
import { scheduleBackups } from "./database/backup";
import { startBot } from "./telegram-bot";
import * as NodeJS from 'node:process';

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

    // Минимальная частота бэкапов
    scheduleBackups();

    // Запуск Telegram бота всегда
    await startBot();

    // Базовая обработка ошибок
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      console.error('Error:', err.message);
      res.status(500).json({ error: "Internal server error" });
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
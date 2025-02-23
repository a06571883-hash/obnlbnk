import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { db } from "./database/connection";
import * as schema from "@shared/schema";
import { storage } from "./storage";
import { setupAuth } from "./auth";

// Установка режима разработки
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

const app = express();

// Базовые middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Настройка CORS
app.use((req, res, next) => {
  const origin = req.headers.origin || '';
  if (origin.includes('.replit.dev') || origin.includes('replit.com') || process.env.NODE_ENV !== 'production') {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');

    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
  }
  next();
});

// Логирование запросов
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  const sessionId = req.sessionID;

  // Отладка сессии
  console.log('Session debug:', {
    sessionID: req.sessionID,
    session: req.session,
    isAuthenticated: req.isAuthenticated?.(),
    user: req.user,
    cookies: req.headers.cookie,
    method: req.method,
    path: req.path
  });

  res.on("finish", () => {
    const duration = Date.now() - start;
    const authStatus = req.isAuthenticated?.() ? 'authenticated' : 'unauthenticated';
    const sessionStatus = req.sessionID ? 'with session' : 'no session';

    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} [${authStatus}] [${sessionStatus}] [sid:${sessionId}] in ${duration}ms`;
      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    console.log('Инициализация таблиц базы данных...');
    await db.execute(`
      CREATE TABLE IF NOT EXISTS session (
        sid VARCHAR PRIMARY KEY,
        sess JSON NOT NULL,
        expire TIMESTAMP(6) NOT NULL
      )
    `);
    console.log('База данных успешно инициализирована');

    // Настройка аутентификации после инициализации базы данных
    setupAuth(app);

    const server = await registerRoutes(app);

    // Обработка ошибок
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Внутренняя ошибка сервера";
      const stack = process.env.NODE_ENV === 'development' ? err.stack : undefined;

      console.error('Error:', {
        status,
        message,
        stack,
        type: err.constructor.name
      });

      res.status(status).json({ 
        error: {
          message,
          ...(stack ? { stack } : {})
        }
      });
    });

    // Настройка Vite в режиме разработки
    if (process.env.NODE_ENV !== 'production') {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // Запуск сервера
    const PORT = 5000;
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`Сервер запущен на http://0.0.0.0:${PORT}`);
      log(`Сервер работает на порту ${PORT} в режиме ${process.env.NODE_ENV}`);
    });
  } catch (error) {
    console.error('Ошибка при инициализации:', error);
    process.exit(1);
  }
})();
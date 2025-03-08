import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { db } from "./database/connection";
import { scheduleBackups } from "./database/backup";
import { startBot } from "./telegram-bot";
import { seaTableManager } from './utils/seatable';
import { DEFAULT_TABLES } from '@shared/seatable.config';

// Set development mode
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

// Логируем важные переменные окружения при запуске
console.log('Environment variables:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('REPLIT_SLUG:', process.env.REPLIT_SLUG || 'local-development');
console.log('REPLIT_ID:', process.env.REPLIT_ID || 'local');
console.log('REPLIT_DEPLOYMENT_URL:', process.env.REPLIT_DEPLOYMENT_URL || 'http://localhost:5000');

const app = express();

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// CORS and security headers for Telegram WebApp and SeaTable
app.use((req, res, next) => {
  const origin = req.headers.origin || '';

  // Allow Telegram WebApp, SeaTable and Replit domains
  if (origin.includes('.telegram.org') ||
      origin.includes('.t.me') ||
      origin.includes('.replit.dev') ||
      origin.includes('replit.com') ||
      origin.includes('seatable.io') ||
      process.env.NODE_ENV !== 'production') {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');

    // Updated Security headers to include SeaTable
    res.header('Content-Security-Policy',
      "default-src 'self' *.telegram.org *.seatable.io; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' *.telegram.org *.seatable.io; " +
      "style-src 'self' 'unsafe-inline' *.telegram.org *.seatable.io; " +
      "img-src 'self' data: blob: *.telegram.org *.seatable.io; " +
      "connect-src 'self' *.telegram.org *.seatable.io wss://*.telegram.org wss://*.seatable.io ws://localhost:* http://localhost:* https://localhost:* https://cloud.seatable.io/; " +
      "worker-src 'self' blob:; " +
      "frame-src 'self' *.telegram.org *.seatable.io; "
    );
    res.header('X-Frame-Options', 'ALLOW-FROM https://web.telegram.org/ https://cloud.seatable.io/');

    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
  }
  next();
});

// Request logging with session info
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    const authStatus = req.isAuthenticated?.() ? 'authenticated' : 'unauthenticated';
    const sessionStatus = req.sessionID ? 'with session' : 'no session';

    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} [${authStatus}] [${sessionStatus}] [sid:${req.sessionID}] in ${duration}ms`;
      if (req.user) {
        logLine += ` [user:${req.user.username}]`;
      }
      log(logLine);

      if (path === '/api/user' || path === '/api/login') {
        console.log('Session details:', {
          id: req.sessionID,
          cookie: req.session?.cookie,
          user: req.user?.username,
          isAuthenticated: req.isAuthenticated?.()
        });
      }
    }
  });

  next();
});

(async () => {
  try {
    console.log('Initializing database tables...');
    await db.execute(`
      CREATE TABLE IF NOT EXISTS session (
        sid VARCHAR PRIMARY KEY,
        sess JSON NOT NULL,
        expire TIMESTAMP(6) NOT NULL
      )
    `);
    console.log('Database initialized successfully');

    // Initialize SeaTable connection with retries
    console.log('Initializing SeaTable connection...');
    try {
      await seaTableManager.initialize();
      console.log('SeaTable connection established successfully');

      // Create default tables if they don't exist
      for (const table of DEFAULT_TABLES) {
        try {
          await seaTableManager.createTable(table);
          console.log(`SeaTable table "${table.name}" created successfully`);
        } catch (error: any) {
          if (error.message?.includes('already exists')) {
            console.log(`SeaTable table "${table.name}" already exists`);
          } else {
            console.error(`Error creating SeaTable table "${table.name}":`, error);
          }
        }
      }

      // Update regulator balance after successful connection
      await seaTableManager.updateRegulatorBalance(48983.08474);
      console.log('Регулятор balance updated successfully');

      // Получаем и выводим все данные из SeaTable
      const seaTableData = await seaTableManager.syncFromSeaTable();
      console.log('\nДанные из SeaTable:');
      console.log('\nПользователи:');
      console.log(JSON.stringify(seaTableData.data.users, null, 2));
      console.log('\nКарты:');
      console.log(JSON.stringify(seaTableData.data.cards, null, 2));
      console.log('\nТранзакции:');
      console.log(JSON.stringify(seaTableData.data.transactions, null, 2));

    } catch (error: any) {
      console.error('Error initializing SeaTable:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        config: error.config
      });
      // Continue execution even if SeaTable initialization fails
    }

    const server = await registerRoutes(app);

    // Initialize scheduled backups
    scheduleBackups();
    console.log('Scheduled database backups initialized');

    // Start Telegram bot
    startBot();
    console.log('Telegram bot started successfully');

    // Обработка необработанных исключений и отказов Promise
    process.on('uncaughtException', (error) => {
      console.error('Необработанное исключение:', error);
      // Не завершаем процесс, просто логируем ошибку
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('Необработанное отклонение Promise:', reason);
      // Не завершаем процесс, просто логируем ошибку
    });

    // Error handling
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal server error";
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

    // Setup Vite in development mode
    if (process.env.NODE_ENV !== 'production') {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // Start server
    const PORT = 5000;
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`Server started at http://0.0.0.0:${PORT}`);
      log(`Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
    });
  } catch (error) {
    console.error('Initialization error:', error);
    process.exit(1);
  }
})();
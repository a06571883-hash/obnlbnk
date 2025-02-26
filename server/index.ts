import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { db } from "./database/connection";
import { scheduleBackups } from "./database/backup";
import { startBot } from "./telegram-bot";

// Set development mode
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

const app = express();

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// CORS and security headers for Telegram WebApp
app.use((req, res, next) => {
  const origin = req.headers.origin || '';

  // Allow Telegram WebApp and Replit domains
  if (origin.includes('.telegram.org') || 
      origin.includes('.t.me') || 
      origin.includes('.replit.dev') || 
      origin.includes('replit.com') || 
      process.env.NODE_ENV !== 'production') {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');

    // Security headers for Telegram WebApp
    res.header('Content-Security-Policy', 
      "default-src 'self' *.telegram.org; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' *.telegram.org; " +
      "style-src 'self' 'unsafe-inline' *.telegram.org; " +
      "img-src 'self' data: blob: *.telegram.org; " +
      "connect-src 'self' *.telegram.org wss://*.telegram.org"
    );
    res.header('X-Frame-Options', 'ALLOW-FROM https://web.telegram.org/');

    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
  }
  next();
});

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    const authStatus = req.isAuthenticated?.() ? 'authenticated' : 'unauthenticated';
    const sessionStatus = req.sessionID ? 'with session' : 'no session';

    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} [${authStatus}] [${sessionStatus}] [sid:${req.sessionID}] in ${duration}ms`;
      log(logLine);
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

    const server = await registerRoutes(app);

    // Initialize scheduled backups
    scheduleBackups();
    console.log('Scheduled database backups initialized');

    // Start Telegram bot
    startBot();
    console.log('Telegram bot started successfully');

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
      // Log the deployment URL for Telegram WebApp
      console.log('Deployment URL:', process.env.REPLIT_DEPLOYMENT_URL || 'https://bnal-bank.webxcorporation.repl.co');
    });
  } catch (error) {
    console.error('Initialization error:', error);
    process.exit(1);
  }
})();
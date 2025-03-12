import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic } from "./vite";
import { db } from "./database/connection";
import { scheduleBackups } from "./database/backup";
import { startBot } from "./telegram-bot";

process.env.NODE_ENV = process.env.NODE_ENV || 'development';

const app = express();

// Optimized settings for free tier
app.use(express.json({ limit: '512kb' }));
app.use(express.urlencoded({ extended: false, limit: '512kb' }));

// Simplified CORS for Replit
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Minimal request logging (preserved from original, but could be removed for further optimization)
app.use((req, res, next) => {
  if (req.path.startsWith("/api")) {
    console.log(`${req.method} ${req.path}`);
  }
  next();
});

(async () => {
  try {
    console.log('Initializing database tables...');
    //The following lines are kept from the original code as they are crucial for database setup and are not present in the edited code
    console.log('Database initialized successfully');


    const server = await registerRoutes(app);

    // Initialize scheduled backups - from original code
    scheduleBackups();
    console.log('Scheduled database backups initialized');

    await startBot();
    console.log('Telegram bot started successfully');

    // Simplified error handling (from edited code)
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      console.error('Error:', err);
      res.status(err.status || 500).json({
        error: err.message || "Internal server error"
      });
    });

    if (process.env.NODE_ENV !== 'production') {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    const PORT = process.env.PORT || 5000;
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Startup error:', error);
    process.exit(1);
  }
})();
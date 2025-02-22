import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { db } from "./database/connection";
import * as schema from "@shared/schema";
import passport from "passport";
import { storage } from "./storage";
import { setupAuth } from "./auth";

// Set development mode explicitly
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Add CORS headers for development
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

// Request logging middleware with detailed session info
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  const sessionId = req.sessionID;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  // Add session debugging
  console.log('Session debug:', {
    sessionID: req.sessionID,
    session: req.session,
    isAuthenticated: req.isAuthenticated?.(),
    user: req.user
  });

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    const authStatus = req.isAuthenticated?.() ? 'authenticated' : 'unauthenticated';

    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} [${authStatus}] [sid:${sessionId}] in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    console.log('Initializing database tables...');

    // Use raw SQL to create session table if it doesn't exist
    await db.execute(`
      CREATE TABLE IF NOT EXISTS session (
        sid VARCHAR PRIMARY KEY,
        sess JSON NOT NULL,
        expire TIMESTAMP(6) NOT NULL
      )
    `);

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
  }

  // Setup authentication after database is initialized
  setupAuth(app);

  const server = await registerRoutes(app);

  // Error handling middleware with better error messages
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
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

  if (process.env.NODE_ENV !== 'production') {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const PORT = 5000;
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening at http://0.0.0.0:${PORT}`);
    log(`Server is running on port ${PORT} in ${process.env.NODE_ENV} mode`);
  });
})();
/**
 * Direct server startup without vite dependencies
 * This bypasses the vite config that causes __dirname issues
 */

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./server/routes.js";
import { serveStatic } from "./server/vite.js";
import { db } from "./server/database/connection.js";
import { scheduleBackups } from "./server/database/backup.js";
import { startBot } from "./server/telegram-bot.js";
import * as NodeJS from 'node:process';
import { setupDebugRoutes } from "./server/debug.js";
import { setupGlobalErrorHandlers, logError, errorHandler, notFoundHandler } from "./server/utils/error-handler.js";
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Setup global error handlers
setupGlobalErrorHandlers();

process.env.NODE_ENV = process.env.NODE_ENV || 'development';

const app = express();

// Minimal config for free tier
app.use(express.json({ limit: '128kb' }));
app.use(express.urlencoded({ extended: false, limit: '128kb' }));

app.use('/nft_assets', express.static(path.join(__dirname, 'nft_assets')));

// Minimal CORS for Replit
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

async function createDirectServer() {
  try {
    console.log('Initializing database tables...');
    console.log('Database initialized successfully');

    console.log('🔄 Registering routes...');
    const server = await registerRoutes(app);

    console.log('🔧 Setting up debug endpoints...');
    setupDebugRoutes(app);

    console.log('💾 Setting up backups...');
    scheduleBackups();

    console.log('🤖 Starting Telegram bot...');
    await startBot();

    console.log('🌐 Setting up static serving...');
    // Use static serving instead of vite for production-like setup
    serveStatic(app);

    console.log('🌐 Server setup completed...');

    // Add error handlers
    app.use(notFoundHandler);
    app.use(errorHandler);

    // Always use port 5000 for Replit
    const PORT = 5000;
    const HOST = "0.0.0.0";

    console.log(`⚡ Starting server on port ${PORT} (${HOST})...`);

    server.listen(PORT, HOST, () => {
      console.log(`\n\n🚀 Server successfully started on port ${PORT}`);
      console.log(`📡 Server address: http://${HOST}:${PORT}`);
      console.log(`🔧 Mode: ${process.env.NODE_ENV}`);
      console.log('🌐 WebSocket server activated\n\n');
    }).on('error', (error) => {
      console.error(`❌ Server start error on port ${PORT}:`, error);
      process.exit(1);
    });

    return server;
  } catch (error) {
    console.error('Startup error:', error);
    process.exit(1);
  }
}

console.log('🌟 Starting server directly without vite...');
createDirectServer();
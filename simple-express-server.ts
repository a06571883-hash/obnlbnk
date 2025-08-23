import express from "express";
import { registerRoutes } from "./server/routes";
import { setupDebugRoutes } from "./server/debug";
import { startBot } from "./server/telegram-bot";
import { scheduleBackups } from "./server/database/backup";
import path from "path";

console.log('🚀 Starting simplified Express server...');

const app = express();
const PORT = 5000;
const HOST = "0.0.0.0";

// Basic middleware
app.use(express.json({ limit: '128kb' }));
app.use(express.urlencoded({ extended: false, limit: '128kb' }));

// Static file serving
app.use(express.static('public'));
app.use('/nft_assets', express.static(path.join(process.cwd(), 'nft_assets')));

// Basic CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

async function startServer() {
  try {
    // Setup routes and create HTTP server
    console.log('🔄 Setting up routes...');
    const server = await registerRoutes(app);
    
    // Setup debug routes
    console.log('🔧 Setting up debug routes...');
    setupDebugRoutes(app);
    
    // Schedule backups
    console.log('💾 Setting up backups...');
    scheduleBackups();
    
    // Start Telegram bot
    console.log('🤖 Starting Telegram bot...');
    startBot();
    
    // Basic health check endpoint
    app.get('/health', (req, res) => {
      res.json({ status: 'OK', timestamp: new Date().toISOString() });
    });
    
    // Fallback for SPA routing
    app.get('*', (req, res) => {
      res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
    });
    
    // Start server
    server.listen(PORT, HOST, () => {
      console.log(`\n🚀 Server successfully started on port ${PORT}`);
      console.log(`📡 Server address: http://${HOST}:${PORT}`);
      console.log(`🔧 Mode: ${process.env.NODE_ENV || 'development'}`);
      console.log('✅ Server is ready!\n');
    });
    
  } catch (error) {
    console.error('❌ Error starting server:', error);
    process.exit(1);
  }
}

startServer();
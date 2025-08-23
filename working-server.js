// Working server using available packages
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import path from 'path';
import { readFile } from 'fs/promises';

const port = 5000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('🚀 Starting working server...');
console.log('📊 Environment:', process.env.NODE_ENV || 'development');
console.log('🔧 Node.js version:', process.version);
console.log('💾 Database URL available:', !!process.env.DATABASE_URL);

const server = createServer(async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${port}`);
  
  if (url.pathname === '/') {
    res.setHeader('Content-Type', 'text/html');
    res.writeHead(200);
    res.end(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Banking App - Development Server</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
          .status { background: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .error { background: #f8d7da; border: 1px solid #f5c6cb; }
          .info { background: #cce5ff; border: 1px solid #99d6ff; }
          pre { background: #f8f9fa; padding: 10px; border-radius: 5px; overflow-x: auto; }
        </style>
      </head>
      <body>
        <h1>🏦 Banking Application</h1>
        <div class="status">
          <h3>✅ Server Status: Running</h3>
          <p>Development server is working on port ${port}</p>
        </div>
        <div class="info">
          <h3>🔧 Environment Information</h3>
          <ul>
            <li>Node.js: ${process.version}</li>
            <li>Environment: ${process.env.NODE_ENV || 'development'}</li>
            <li>Database: ${process.env.DATABASE_URL ? 'PostgreSQL Available' : 'No database'}</li>
            <li>Timestamp: ${new Date().toISOString()}</li>
          </ul>
        </div>
        <div class="info">
          <h3>📋 Next Steps</h3>
          <ol>
            <li>Fix package dependencies (tsx, express, etc.)</li>
            <li>Resolve database schema configuration</li>
            <li>Restore full TypeScript development environment</li>
            <li>Start the complete application</li>
          </ol>
        </div>
        <div class="info">
          <h3>🔗 API Endpoints</h3>
          <ul>
            <li><a href="/health">/health</a> - Health check</li>
            <li><a href="/status">/status</a> - Detailed status</li>
          </ul>
        </div>
      </body>
      </html>
    `);
  } else if (url.pathname === '/health') {
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    res.end(JSON.stringify({ 
      status: 'OK', 
      server: 'working',
      timestamp: new Date().toISOString() 
    }));
  } else if (url.pathname === '/status') {
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    res.end(JSON.stringify({ 
      server: 'Working Development Server',
      runtime: process.version,
      environment: process.env.NODE_ENV || 'development',
      database: !!process.env.DATABASE_URL,
      port: port,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      issues: [
        'Package dependencies missing (tsx, express)',
        'TypeScript compilation broken',
        'Database schema mismatch (SQLite vs PostgreSQL)'
      ]
    }));
  } else {
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found', path: url.pathname }));
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`✅ Working server is running!`);
  console.log(`🌐 Access: http://0.0.0.0:${port}`);
  console.log(`📊 Status: http://0.0.0.0:${port}/status`);
  console.log(`❤️  Health: http://0.0.0.0:${port}/health`);
  console.log('');
  console.log('🔥 Ready to fix the environment and restore the full app!');
});

process.on('SIGINT', () => {
  console.log('\n🔴 Shutting down server...');
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
});
// Minimal server using only built-in Node.js modules
import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';

const port = 5000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const server = createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.url === '/') {
    res.writeHead(200);
    res.end(JSON.stringify({ 
      status: 'Server is working!', 
      message: 'Basic Node.js runtime is functional',
      timestamp: new Date().toISOString(),
      environment: 'minimal',
      nodeVersion: process.version
    }));
  } else if (req.url === '/health') {
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'OK', mode: 'minimal' }));
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`✅ Minimal server running on http://0.0.0.0:${port}`);
  console.log('Node.js runtime test successful!');
  console.log('Next: Fix package installation and environment');
});

process.on('SIGINT', () => {
  console.log('\n🔴 Server shutting down...');
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
});

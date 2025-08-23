#!/usr/bin/env node
// Alternative development server that works around tsx issues
import { spawn } from 'child_process';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('🚀 Starting development server...');

// Since tsx is broken, let's run the pre-built version and watch for changes
async function startServer() {
  try {
    // Check if we have a working built version
    const distExists = await readFile('dist/index.js').then(() => true).catch(() => false);
    
    if (distExists) {
      console.log('📦 Using pre-built version from dist/index.js');
      console.log('🔧 Setting environment for development...');
      
      const server = spawn('node', ['dist/index.js'], {
        stdio: 'inherit',
        env: { 
          ...process.env, 
          NODE_ENV: 'development',
          PORT: '5000'
        }
      });
      
      server.on('error', (error) => {
        console.error('❌ Server error:', error.message);
        // Fallback to working server
        console.log('🔄 Falling back to working server...');
        fallbackServer();
      });
      
      server.on('exit', (code) => {
        if (code !== 0) {
          console.log(`❌ Server exited with code ${code}, trying fallback...`);
          fallbackServer();
        }
      });
      
    } else {
      console.log('📁 No dist build found, using fallback server...');
      fallbackServer();
    }
    
  } catch (error) {
    console.error('❌ Startup error:', error.message);
    fallbackServer();
  }
}

function fallbackServer() {
  console.log('🔄 Starting working fallback server...');
  const server = spawn('node', ['working-server.js'], {
    stdio: 'inherit',
    env: { 
      ...process.env, 
      NODE_ENV: 'development',
      PORT: '5000'
    }
  });
  
  server.on('error', (error) => {
    console.error('❌ Fallback server error:', error.message);
    process.exit(1);
  });
}

// Start the server
startServer();
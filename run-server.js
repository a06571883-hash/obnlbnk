#!/usr/bin/env node
// Alternative server runner that bypasses tsx issues
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('🚀 Starting server with alternative method...');

// Try different TypeScript execution methods
const methods = [
  // Method 1: Use tsx as import
  () => {
    console.log('📦 Trying tsx with --import flag...');
    return spawn('node', ['--import', 'tsx/esm', 'server/index.ts'], {
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'development' }
    });
  },
  
  // Method 2: Use tsx directly from node_modules
  () => {
    console.log('📦 Trying tsx from node_modules...');
    const tsxPath = path.join(__dirname, 'node_modules/tsx/dist/cli.mjs');
    return spawn('node', [tsxPath, 'server/index.ts'], {
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'development' }
    });
  },
  
  // Method 3: Use the pre-built version
  () => {
    console.log('📦 Trying pre-built dist/index.js...');
    return spawn('node', ['dist/index.js'], {
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'development' }
    });
  },
  
  // Method 4: Fallback to working server
  () => {
    console.log('📦 Using working fallback server...');
    return spawn('node', ['working-server.js'], {
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'development' }
    });
  }
];

async function tryMethods() {
  for (let i = 0; i < methods.length; i++) {
    try {
      console.log(`\n🔄 Attempt ${i + 1}/${methods.length}:`);
      const child = methods[i]();
      
      return new Promise((resolve, reject) => {
        let resolved = false;
        
        // Success if it runs for more than 3 seconds without crashing
        const successTimeout = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            console.log('✅ Server started successfully!');
            resolve(child);
          }
        }, 3000);
        
        child.on('error', (error) => {
          if (!resolved) {
            resolved = true;
            clearTimeout(successTimeout);
            console.log(`❌ Method ${i + 1} failed:`, error.message);
            reject(error);
          }
        });
        
        child.on('exit', (code) => {
          if (!resolved) {
            resolved = true;
            clearTimeout(successTimeout);
            if (code !== 0) {
              console.log(`❌ Method ${i + 1} exited with code ${code}`);
              reject(new Error(`Process exited with code ${code}`));
            }
          }
        });
      });
    } catch (error) {
      console.log(`❌ Method ${i + 1} failed:`, error.message);
      if (i === methods.length - 1) {
        throw error;
      }
    }
  }
}

tryMethods().catch(error => {
  console.error('💥 All methods failed:', error.message);
  process.exit(1);
});
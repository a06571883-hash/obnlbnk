// Simple development server runner
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('Starting development server...');

// Try to run tsx directly from node_modules
const tsxPath = path.join(__dirname, 'node_modules/tsx/dist/cli.mjs');
const serverPath = path.join(__dirname, 'server/index.ts');

const child = spawn('node', [tsxPath, serverPath], {
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'development' }
});

child.on('error', (error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

child.on('exit', (code) => {
  console.log(`Server process exited with code ${code}`);
  process.exit(code);
});
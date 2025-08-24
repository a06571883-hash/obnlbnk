#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`🔧 Запуск: ${command} ${args.join(' ')}`);
    const child = spawn(command, args, {
      stdio: 'inherit',
      ...options
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });
  });
}

async function main() {
  try {
    console.log('🚀 Минимальная сборка для Vercel...');
    
    // Создание директорий
    if (!fs.existsSync('dist')) {
      fs.mkdirSync('dist', { recursive: true });
    }
    if (!fs.existsSync('dist/public')) {
      fs.mkdirSync('dist/public', { recursive: true });
    }
    
    console.log('📦 Сборка клиентской части через esbuild...');
    
    // Простая сборка клиентской части через esbuild
    await runCommand('npx', [
      'esbuild', 
      'client/src/main.tsx', 
      '--bundle', 
      '--outdir=dist/public', 
      '--format=esm',
      '--platform=browser',
      '--jsx=automatic',
      '--define:process.env.NODE_ENV="production"',
      '--external:react',
      '--external:react-dom'
    ]);
    
    // Создаем index.html
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OOO BNAL BANK</title>
    <link rel="stylesheet" href="./main.css">
</head>
<body>
    <div id="root"></div>
    <script type="module" src="./main.js"></script>
</body>
</html>`;
    
    fs.writeFileSync('dist/public/index.html', htmlContent);
    
    console.log('✅ Клиентская часть собрана');
    
    console.log('🔧 Создание серверной части...');
    
    // Простая точка входа для Vercel
    const serverEntry = `
// Простая Vercel function
export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  if (req.url?.startsWith('/api/')) {
    res.status(200).json({ 
      message: 'Server is running', 
      status: 'ok',
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url
    });
  } else {
    res.status(404).json({ error: 'Not found' });
  }
}
`;
    
    fs.writeFileSync('dist/index.js', serverEntry);
    
    console.log('🎉 Минимальная сборка завершена!');
    console.log('📁 Результаты:');
    console.log('  - dist/public/index.html');  
    console.log('  - dist/public/main.js');
    console.log('  - dist/index.js - серверная функция');
    
  } catch (error) {
    console.error('❌ Ошибка сборки:', error.message);
    process.exit(1);
  }
}

main();
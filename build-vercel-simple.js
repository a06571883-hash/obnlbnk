#!/usr/bin/env node

/**
 * Упрощенный скрипт сборки специально для Vercel
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`🔧 Запуск: ${command} ${args.join(' ')}`);
    const child = spawn(command, args, {
      stdio: 'inherit',
      cwd: options.cwd || __dirname,
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
    console.log('🚀 Простая сборка для Vercel...');
    
    // Создание директорий
    if (!fs.existsSync('dist')) {
      fs.mkdirSync('dist', { recursive: true });
    }
    if (!fs.existsSync('dist/public')) {
      fs.mkdirSync('dist/public', { recursive: true });
    }
    
    console.log('📦 Сборка клиентской части через временный конфиг...');
    
    // Создание чистого vite.config.ts без top-level await
    const cleanViteConfig = `
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import themePlugin from "@replit/vite-plugin-shadcn-theme-json";
import path, { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [
    react(),
    themePlugin(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: false,
  },
});`;

    fs.writeFileSync('vite.config.vercel.ts', cleanViteConfig);
    
    // Сборка клиентской части
    await runCommand('npx', ['vite', 'build', '--config', 'vite.config.vercel.ts'], {
      cwd: __dirname
    });
    
    // Удаление временного файла
    fs.unlinkSync('vite.config.vercel.ts');
    
    console.log('✅ Клиентская часть собрана');
    
    console.log('🔧 Создание точки входа сервера...');
    
    // Создание минимальной точки входа для сервера
    const serverEntry = `
// Vercel serverless function
import { createServer } from 'http';

export default function handler(req, res) {
  // Простой обработчик для проверки
  if (req.url?.startsWith('/api/')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      message: 'Server is running', 
      status: 'ok',
      timestamp: new Date().toISOString()
    }));
  } else {
    // Статические файлы обрабатываются Vercel автоматически
    res.writeHead(404);
    res.end('Not found');
  }
}
`;
    
    fs.writeFileSync('dist/index.js', serverEntry);
    
    console.log('🎉 Сборка завершена успешно!');
    console.log('📁 Результаты:');
    console.log('  - dist/public/ - статические файлы');
    console.log('  - dist/index.js - серверная функция');
    
  } catch (error) {
    console.error('❌ Ошибка сборки:', error.message);
    process.exit(1);
  }
}

main();
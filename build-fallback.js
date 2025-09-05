#!/usr/bin/env node

/**
 * Альтернативный скрипт сборки для обхода проблем с ESM и top-level await в Vite
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import path from 'path';

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

async function prepareDirs() {
  console.log('📁 Подготовка директорий...');
  
  const dirsToCreate = ['dist', 'dist/public'];
  
  for (const dir of dirsToCreate) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`✅ Создана директория: ${dir}`);
    }
  }
}

async function buildClient() {
  console.log('📦 Сборка клиентской части...');
  
  try {
    // Создание временного vite.config.ts без top-level await
    const tempViteConfig = `
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import themePlugin from "@replit/vite-plugin-shadcn-theme-json";
import path, { dirname } from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [
    react({
      fastRefresh: true
    }),
    runtimeErrorOverlay({
      hmr: {
        overlay: false
      }
    }),
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

    fs.writeFileSync('vite.config.temp.ts', tempViteConfig);
    
    // Сборка через временный конфиг
    await runCommand('npx', ['vite', 'build', '--config', 'vite.config.temp.ts'], {
      cwd: __dirname
    });
    
    // Удаление временного файла
    fs.unlinkSync('vite.config.temp.ts');
    
    console.log('✅ Клиентская часть собрана успешно');
  } catch (error) {
    console.log('⚠️  Ошибка сборки клиентской части:', error.message);
    
    // Попытка альтернативной сборки
    console.log('🔄 Пробуем альтернативный способ...');
    try {
      await runCommand('npx', ['esbuild', 'client/src/main.tsx', '--bundle', '--outfile=dist/public/main.js', '--format=esm', '--platform=browser', '--jsx=automatic', '--define:process.env.NODE_ENV="production"'], {
        cwd: __dirname
      });
      
      // Копирование HTML
      if (fs.existsSync('client/index.html')) {
        fs.copyFileSync('client/index.html', 'dist/public/index.html');
      }
      
      console.log('✅ Альтернативная сборка клиентской части успешна');
    } catch (altError) {
      throw new Error(`Все способы сборки клиентской части провалились: ${altError.message}`);
    }
  }
}

async function buildServer() {
  console.log('🔧 Сборка серверной части для Vercel...');
  
  try {
    // Не будем собирать отдельно, просто скопируем файлы
    console.log('📁 Копирование серверных файлов...');
    
    // Создаем директории
    const serverDirs = ['server', 'shared'];
    for (const dir of serverDirs) {
      await copyDirectory(dir, `api/${dir}`);
    }
    
    console.log('✅ Серверные файлы скопированы в api/');
    
  } catch (error) {
    console.log('⚠️  Ошибка сборки сервера:', error.message);
    console.log('🔄 Пробуем простую компиляцию...');
    
    try {
      // Простая компиляция без bundling
      await runCommand('npx', ['tsc', 
        'server/storage.ts',
        'server/routes-vercel.ts',
        '--target', 'ES2020', 
        '--module', 'ESNext', 
        '--moduleResolution', 'node',
        '--outDir', 'api',
        '--allowJs'
      ], {
        cwd: __dirname
      });
      
      console.log('✅ Простая компиляция завершена');
      
    } catch (altError) {
      throw new Error(`Все способы сборки сервера провалились: ${altError.message}`);
    }
  }
}

// Функция для копирования директорий
async function copyDirectory(src, dest) {
  if (!fs.existsSync(src)) {
    console.log(`⚠️  Директория ${src} не найдена, пропускаем`);
    return;
  }
  
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  const items = fs.readdirSync(src);
  
  for (const item of items) {
    const srcPath = path.join(src, item);
    const destPath = path.join(dest, item);
    
    const stat = fs.statSync(srcPath);
    
    if (stat.isDirectory()) {
      await copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
  
  console.log(`📁 Скопирована директория: ${src} -> ${dest}`);
}

async function main() {
  try {
    console.log('🚀 Начинаем альтернативную сборку для Vercel...');
    
    await prepareDirs();
    await buildClient();
    await buildServer();
    
    console.log('🎉 Сборка завершена успешно!');
    console.log('📁 Результаты сборки:');
    console.log('  - dist/public/ - статические файлы клиентской части');
    console.log('  - dist/index.js - серверный код');
    
  } catch (error) {
    console.error('❌ Ошибка сборки:', error.message);
    process.exit(1);
  }
}

main();

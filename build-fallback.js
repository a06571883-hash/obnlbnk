#!/usr/bin/env node

/**
 * Альтернативный скрипт сборки для обхода проблем с ESM и top-level await
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

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

async function buildClient() {
  console.log('📦 Сборка клиентской части...');
  
  // Пробуем сборку через esbuild напрямую для Tailwind
  try {
    await runCommand('npx', ['tailwindcss', '-i', 'client/src/index.css', '-o', 'client/dist/styles.css', '--minify'], {
      cwd: __dirname
    });
    console.log('✅ CSS скомпилирован успешно');
  } catch (error) {
    console.log('⚠️  Проблема с Tailwind, продолжаем без CSS...');
  }

  // Сборка JS через esbuild
  try {
    await runCommand('npx', ['esbuild', 'client/src/main.tsx', '--bundle', '--outfile=dist/public/main.js', '--format=esm', '--platform=browser', '--jsx=automatic'], {
      cwd: __dirname
    });
    console.log('✅ JavaScript скомпилирован успешно');
  } catch (error) {
    console.log('⚠️  Проблема с JavaScript сборкой');
    throw error;
  }
}

async function buildServer() {
  console.log('🔧 Сборка серверной части...');
  
  try {
    await runCommand('npx', ['esbuild', 'server/index.ts', '--platform=node', '--packages=external', '--bundle', '--format=esm', '--outdir=dist'], {
      cwd: __dirname
    });
    console.log('✅ Сервер скомпилирован успешно');
  } catch (error) {
    console.log('⚠️  Проблема с сборкой сервера');
    throw error;
  }
}

async function main() {
  try {
    console.log('🚀 Начинаем альтернативную сборку...');
    
    await buildClient();
    await buildServer();
    
    console.log('🎉 Сборка завершена успешно!');
  } catch (error) {
    console.error('❌ Ошибка сборки:', error.message);
    process.exit(1);
  }
}

main();
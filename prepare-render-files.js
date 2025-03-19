/**
 * Скрипт для подготовки основных файлов для деплоя на Render.com
 * Создает копию только самых важных файлов в директории render-deployment
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Получаем __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Директория для деплоя
const deploymentDir = path.join(__dirname, 'render-deployment');

// Создаем директорию, если её нет
if (!fs.existsSync(deploymentDir)) {
  fs.mkdirSync(deploymentDir, { recursive: true });
}

// Основные файлы для копирования
const mainFiles = [
  'package.json',
  'render.yaml',
  'build.sh',
  'start.sh',
  'drizzle.config.ts',
  'vite.config.ts',
  'tsconfig.json',
  'postcss.config.js',
  'tailwind.config.ts',
  'RENDER_DEPLOYMENT_GUIDE.md',
  'DATABASE_BACKUP_RESTORE.md'
];

// Директории для копирования
const dirsToProcess = [
  { source: 'data', includeSubdirs: true },
  { source: 'scripts', include: ['prepare-data-directory.js', 'prepare-for-render.js'] },
  { source: 'server', includeSubdirs: true },
  { source: 'client/src', dest: 'client/src', includeSubdirs: true },
  { source: 'shared', includeSubdirs: true }
];

// Копирование основных файлов
console.log('Копируем основные файлы...');
for (const file of mainFiles) {
  try {
    const srcPath = path.join(__dirname, file);
    const destPath = path.join(deploymentDir, file);
    
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, destPath);
      console.log(`✅ Файл ${file} скопирован`);
    } else {
      console.log(`⚠️ Файл ${file} не найден`);
    }
  } catch (error) {
    console.error(`❌ Ошибка при копировании файла ${file}:`, error.message);
  }
}

// Рекурсивное копирование директории
function copyDir(src, dest, include = null) {
  // Создаем директорию назначения
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  // Получаем содержимое директории
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    // Если есть список файлов для включения и это файл, проверяем, нужно ли его копировать
    if (include && entry.isFile() && !include.includes(entry.name)) {
      continue;
    }
    
    // Если это директория, копируем рекурсивно
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } 
    // Если это файл, копируем
    else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Копирование директорий
console.log('\nКопируем директории...');
for (const dir of dirsToProcess) {
  try {
    const srcPath = path.join(__dirname, dir.source);
    const destPath = path.join(deploymentDir, dir.dest || dir.source);
    
    if (fs.existsSync(srcPath)) {
      if (dir.include) {
        // Если нужно копировать только определенные файлы
        if (!fs.existsSync(destPath)) {
          fs.mkdirSync(destPath, { recursive: true });
        }
        
        for (const file of dir.include) {
          const srcFilePath = path.join(srcPath, file);
          const destFilePath = path.join(destPath, file);
          if (fs.existsSync(srcFilePath)) {
            fs.copyFileSync(srcFilePath, destFilePath);
            console.log(`✅ Файл ${dir.source}/${file} скопирован`);
          } else {
            console.log(`⚠️ Файл ${dir.source}/${file} не найден`);
          }
        }
      } else {
        // Копируем всю директорию
        copyDir(srcPath, destPath);
        console.log(`✅ Директория ${dir.source} скопирована в ${destPath}`);
      }
    } else {
      console.log(`⚠️ Директория ${dir.source} не найдена`);
    }
  } catch (error) {
    console.error(`❌ Ошибка при копировании директории ${dir.source}:`, error.message);
  }
}

console.log('\n✅ Подготовка файлов для Render.com завершена!');
console.log(`📁 Все необходимые файлы скопированы в директорию: ${deploymentDir}`);
console.log('Теперь вы можете скачать эту директорию через "Files" панель в Replit.');
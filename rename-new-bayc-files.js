/**
 * Скрипт для переименования файлов NFT-изображений из архива в соответствии с именами, ожидаемыми в приложении
 * 
 * Переименовывает изображения из формата с длинными именами в bayc_X.png и bayc_X.avif
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Пути к директориям
const sourceDir = './temp_extract';
const targetDir = './public/bayc_official';

async function setupDirectories() {
  console.log('Создаем целевую директорию...');
  
  // Создаем директорию, если она не существует
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
    console.log(`Директория ${targetDir} создана`);
  } else {
    console.log(`Директория ${targetDir} уже существует`);
  }
}

async function copyAndRenameFiles() {
  console.log('Начинаем копирование и переименование файлов...');
  
  // Получаем список файлов из исходной директории
  const files = fs.readdirSync(sourceDir);
  
  const baseFilenames = new Set();
  const pngFiles = [];
  const avifFiles = [];
  
  // Сортируем файлы по типу
  files.forEach(filename => {
    if (filename.endsWith('.png')) {
      pngFiles.push(filename);
    } else if (filename.endsWith('.avif')) {
      avifFiles.push(filename);
    }
  });
  
  // Создаем последовательные имена для PNG файлов
  console.log(`Найдено ${pngFiles.length} PNG файлов`);
  for (let i = 0; i < pngFiles.length; i++) {
    const originalFile = path.join(sourceDir, pngFiles[i]);
    const newFileName = `bayc_${i + 1}.png`;
    const newFile = path.join(targetDir, newFileName);
    
    fs.copyFileSync(originalFile, newFile);
    console.log(`Скопирован и переименован: ${pngFiles[i]} -> ${newFileName}`);
    
    // Также создаем версию с префиксом official_
    const officialFileName = `official_bayc_${i + 1}.png`;
    const officialFile = path.join(targetDir, officialFileName);
    fs.copyFileSync(originalFile, officialFile);
    console.log(`Создана официальная версия: ${officialFileName}`);
  }
  
  // Создаем последовательные имена для AVIF файлов
  console.log(`Найдено ${avifFiles.length} AVIF файлов`);
  for (let i = 0; i < avifFiles.length; i++) {
    const originalFile = path.join(sourceDir, avifFiles[i]);
    const newFileName = `bayc_${i + 1}.avif`;
    const newFile = path.join(targetDir, newFileName);
    
    fs.copyFileSync(originalFile, newFile);
    console.log(`Скопирован и переименован: ${avifFiles[i]} -> ${newFileName}`);
  }
  
  console.log('Копирование и переименование файлов завершено');
}

async function main() {
  try {
    await setupDirectories();
    await copyAndRenameFiles();
    console.log('Операция завершена успешно');
  } catch (error) {
    console.error('Ошибка при выполнении операции:', error);
  }
}

main();
/**
 * Скрипт для переименования файлов NFT-изображений с правильной нумерацией
 * Для официальной коллекции BAYC
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Получаем текущую директорию
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function renameBAYCFiles() {
  try {
    const nftDir = path.join(__dirname, 'public', 'bayc_official');
    
    if (!fs.existsSync(nftDir)) {
      console.error(`Директория ${nftDir} не существует!`);
      return;
    }
    
    const files = fs.readdirSync(nftDir);
    
    // Создаем карту для группировки файлов по их базовому имени
    const fileGroups = new Map();
    
    // Группируем файлы
    for (const file of files) {
      if (!file.toLowerCase().endsWith('.png') && !file.toLowerCase().endsWith('.avif')) {
        continue;
      }
      
      // Получаем базовое имя файла (без расширения и суффиксов)
      let baseName = file;
      
      // Убираем суффиксы вида " (1)" или " (2)"
      baseName = baseName.replace(/\s+\(\d+\)\.(png|avif)$/i, '');
      
      // Убираем расширение
      baseName = baseName.replace(/\.(png|avif)$/i, '');
      
      if (!fileGroups.has(baseName)) {
        fileGroups.set(baseName, []);
      }
      
      fileGroups.get(baseName).push(file);
    }
    
    console.log(`Найдено ${fileGroups.size} уникальных изображений NFT.`);
    
    // Переименовываем файлы в каждой группе
    let counter = 1;
    
    for (const [baseName, groupFiles] of fileGroups) {
      for (const file of groupFiles) {
        const fileExt = path.extname(file).toLowerCase();
        const oldPath = path.join(nftDir, file);
        
        // Определяем номер BAYC на основе счетчика
        const baycNumber = counter;
        
        // Создаем новое имя файла
        const newName = `bayc_${baycNumber}${fileExt}`;
        const newPath = path.join(nftDir, newName);
        
        fs.renameSync(oldPath, newPath);
        console.log(`Переименован файл: ${file} -> ${newName}`);
      }
      
      counter++;
    }
    
    console.log(`Переименовано ${fileGroups.size} групп файлов.`);
  } catch (error) {
    console.error('Ошибка при переименовании файлов:', error);
  }
}

// Запускаем функцию
renameBAYCFiles();
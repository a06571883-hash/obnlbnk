/**
 * Скрипт для переименования файлов NFT-изображений с правильной нумерацией
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Получаем текущую директорию
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function renameNFTFiles() {
  try {
    const nftDir = path.join(__dirname, 'bored_ape_nft');
    
    if (!fs.existsSync(nftDir)) {
      console.error(`Директория ${nftDir} не существует!`);
      return;
    }
    
    const files = fs.readdirSync(nftDir);
    let counter = 1;
    
    // Перебираем файлы и переименовываем их
    for (const file of files) {
      if (!file.toLowerCase().endsWith('.png') && !file.toLowerCase().endsWith('.avif')) {
        continue;
      }
      
      const fileExt = path.extname(file).toLowerCase();
      const oldPath = path.join(nftDir, file);
      const newName = `bored_ape_${counter}${fileExt}`;
      const newPath = path.join(nftDir, newName);
      
      fs.renameSync(oldPath, newPath);
      console.log(`Переименован файл: ${file} -> ${newName}`);
      counter++;
    }
    
    console.log(`Переименовано ${counter-1} файлов.`);
  } catch (error) {
    console.error('Ошибка при переименовании файлов:', error);
  }
}

// Запускаем функцию
renameNFTFiles();
/**
 * Скрипт для обновления конфигурации сервера NFT
 * и настройки правильного доступа к изображениям
 */

const fs = require('fs');
const path = require('path');

// Проверка наличия директорий
console.log('Проверка директорий с изображениями...');
const nftAssetsDir = './nft_assets';
const boredApeDir = path.join(nftAssetsDir, 'bored_ape');
const mutantApeDir = path.join(nftAssetsDir, 'mutant_ape');

if (!fs.existsSync(nftAssetsDir)) {
  console.log(`Директория ${nftAssetsDir} не найдена, создаем...`);
  fs.mkdirSync(nftAssetsDir, { recursive: true });
}

if (!fs.existsSync(boredApeDir)) {
  console.log(`Директория ${boredApeDir} не найдена, создаем...`);
  fs.mkdirSync(boredApeDir, { recursive: true });
}

if (!fs.existsSync(mutantApeDir)) {
  console.log(`Директория ${mutantApeDir} не найдена, создаем...`);
  fs.mkdirSync(mutantApeDir, { recursive: true });
}

// Копируем файлы из новой директории обратно в корень для совместимости с путями
console.log('Копирование файлов для совместимости с путями...');

// Функция для копирования всех файлов из одной директории в другую
function copyFilesForCompatibility(sourceDir, targetDir, pattern) {
  if (!fs.existsSync(sourceDir)) {
    console.log(`Исходная директория ${sourceDir} не найдена`);
    return;
  }

  if (!fs.existsSync(targetDir)) {
    console.log(`Целевая директория ${targetDir} не найдена, создаем...`);
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // Получаем список всех файлов в исходной директории
  const files = fs.readdirSync(sourceDir);
  console.log(`Найдено ${files.length} файлов в ${sourceDir}`);

  // Копируем каждый файл
  let copiedCount = 0;
  for (const file of files) {
    if (pattern && !file.match(pattern)) continue;
    
    const sourcePath = path.join(sourceDir, file);
    const targetPath = path.join(targetDir, file);
    
    // Проверяем, является ли файл директорией
    if (fs.statSync(sourcePath).isDirectory()) {
      continue;
    }
    
    try {
      fs.copyFileSync(sourcePath, targetPath);
      copiedCount++;
      
      if (copiedCount % 100 === 0) {
        console.log(`Скопировано ${copiedCount} файлов...`);
      }
    } catch (err) {
      console.error(`Ошибка при копировании ${sourcePath} в ${targetPath}: ${err.message}`);
    }
  }
  
  console.log(`Всего скопировано ${copiedCount} файлов из ${sourceDir} в ${targetDir}`);
}

// Копируем файлы из nft_assets/bored_ape в корневую директорию bored_ape_nft
copyFilesForCompatibility('./nft_assets/bored_ape', './bored_ape_nft', /\.png$/);

// Копируем файлы из nft_assets/mutant_ape в корневую директорию mutant_ape_nft
copyFilesForCompatibility('./nft_assets/mutant_ape', './mutant_ape_nft', /\.svg$/);

// Проверяем каталоги
function countFilesInDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return 0;
  }
  
  try {
    const files = fs.readdirSync(dirPath);
    return files.length;
  } catch (err) {
    console.error(`Ошибка при подсчете файлов в ${dirPath}: ${err.message}`);
    return 0;
  }
}

console.log(`\nПроверка количества файлов в директориях:`);
console.log(`- nft_assets/bored_ape: ${countFilesInDir('./nft_assets/bored_ape')} файлов`);
console.log(`- nft_assets/mutant_ape: ${countFilesInDir('./nft_assets/mutant_ape')} файлов`);
console.log(`- bored_ape_nft: ${countFilesInDir('./bored_ape_nft')} файлов`);
console.log(`- mutant_ape_nft: ${countFilesInDir('./mutant_ape_nft')} файлов`);

console.log('\nОбновление конфигурации сервера NFT завершено!');
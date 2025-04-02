/**
 * Скрипт для принудительного копирования изображений Mutant Ape и исправления путей в файлах
 * Этот скрипт не использует базу данных и работает только с файловой системой
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Получаем текущую директорию
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Директории для работы
const MUTANT_APE_NFT_DIR = path.join(process.cwd(), 'mutant_ape_nft');
const NFT_ASSETS_MUTANT_APE_DIR = path.join(process.cwd(), 'nft_assets', 'mutant_ape');
const MUTANT_APE_OFFICIAL_DIR = path.join(process.cwd(), 'mutant_ape_official');

// Создаем директории, если они не существуют
function ensureDirectories() {
  const directories = [
    MUTANT_APE_NFT_DIR,
    NFT_ASSETS_MUTANT_APE_DIR,
    MUTANT_APE_OFFICIAL_DIR,
  ];
  
  for (const dir of directories) {
    if (!fs.existsSync(dir)) {
      console.log(`🔧 Создаем директорию ${dir}`);
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

/**
 * Копирует файл из исходной директории в целевую
 */
function copyImageFile(sourcePath, destPath) {
  try {
    // Проверяем существование исходного файла
    if (!fs.existsSync(sourcePath)) {
      console.log(`⚠️ Исходный файл не существует: ${sourcePath}`);
      return false;
    }
    
    // Создаем целевую директорию, если она не существует
    const destDir = path.dirname(destPath);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    
    // Копируем файл
    fs.copyFileSync(sourcePath, destPath);
    console.log(`✅ Скопирован файл: ${path.basename(sourcePath)} -> ${path.basename(destPath)}`);
    return true;
  } catch (error) {
    console.error(`❌ Ошибка при копировании файла: ${error.message}`);
    return false;
  }
}

/**
 * Собирает информацию о всех изображениях Mutant Ape в системе
 */
function collectAllMutantApeImages() {
  console.log('🔍 Собираем информацию о всех изображениях Mutant Ape...');
  
  const result = {
    nftAssetsDir: {
      png: [],
      svg: []
    },
    nftDir: {
      files: []
    },
    officialDir: {
      files: []
    }
  };
  
  // Проверяем директорию nft_assets/mutant_ape
  if (fs.existsSync(NFT_ASSETS_MUTANT_APE_DIR)) {
    try {
      const files = fs.readdirSync(NFT_ASSETS_MUTANT_APE_DIR);
      result.nftAssetsDir.png = files.filter(f => f.endsWith('.png'));
      result.nftAssetsDir.svg = files.filter(f => f.endsWith('.svg'));
      
      console.log(`📊 В директории nft_assets/mutant_ape найдено ${result.nftAssetsDir.png.length} PNG и ${result.nftAssetsDir.svg.length} SVG файлов`);
    } catch (err) {
      console.error(`❌ Ошибка при чтении директории ${NFT_ASSETS_MUTANT_APE_DIR}:`, err);
    }
  }
  
  // Проверяем директорию mutant_ape_nft
  if (fs.existsSync(MUTANT_APE_NFT_DIR)) {
    try {
      const files = fs.readdirSync(MUTANT_APE_NFT_DIR);
      result.nftDir.files = files.filter(f => f.endsWith('.png'));
      
      console.log(`📊 В директории mutant_ape_nft найдено ${result.nftDir.files.length} PNG файлов`);
    } catch (err) {
      console.error(`❌ Ошибка при чтении директории ${MUTANT_APE_NFT_DIR}:`, err);
    }
  }
  
  // Проверяем директорию mutant_ape_official
  if (fs.existsSync(MUTANT_APE_OFFICIAL_DIR)) {
    try {
      const files = fs.readdirSync(MUTANT_APE_OFFICIAL_DIR);
      result.officialDir.files = files.filter(f => f.endsWith('.png'));
      
      console.log(`📊 В директории mutant_ape_official найдено ${result.officialDir.files.length} PNG файлов`);
    } catch (err) {
      console.error(`❌ Ошибка при чтении директории ${MUTANT_APE_OFFICIAL_DIR}:`, err);
    }
  }
  
  return result;
}

/**
 * Извлекает номер токена из имени файла
 */
function extractTokenIdFromFilename(filename) {
  const match = filename.match(/mutant_ape_(\d+)\.png/);
  if (match && match[1]) {
    return parseInt(match[1]);
  }
  return null;
}

/**
 * Копирует изображения между директориями для обеспечения полного набора
 */
function copyMissingMutantApeImages(imageData) {
  console.log('🔄 Копируем отсутствующие изображения Mutant Ape...');
  
  // Копируем PNG из nft_assets/mutant_ape в mutant_ape_nft, если они отсутствуют
  let copiedCount = 0;
  
  // Получаем список токен ID из каждой директории
  const nftAssetsTokenIds = imageData.nftAssetsDir.png.map(file => extractTokenIdFromFilename(file)).filter(id => id !== null);
  const nftDirTokenIds = imageData.nftDir.files.map(file => extractTokenIdFromFilename(file)).filter(id => id !== null);
  
  console.log(`🔢 Уникальных токенов в nft_assets/mutant_ape: ${new Set(nftAssetsTokenIds).size}`);
  console.log(`🔢 Уникальных токенов в mutant_ape_nft: ${new Set(nftDirTokenIds).size}`);
  
  // Находим токены, которые есть в nft_assets/mutant_ape, но отсутствуют в mutant_ape_nft
  const missingInNftDir = nftAssetsTokenIds.filter(id => !nftDirTokenIds.includes(id));
  console.log(`🔍 Токены, отсутствующие в mutant_ape_nft: ${missingInNftDir.length}`);
  
  // Копируем отсутствующие изображения
  for (const tokenId of missingInNftDir) {
    const sourceFile = path.join(NFT_ASSETS_MUTANT_APE_DIR, `mutant_ape_${tokenId}.png`);
    const destFile = path.join(MUTANT_APE_NFT_DIR, `mutant_ape_${tokenId}.png`);
    
    if (fs.existsSync(sourceFile) && !fs.existsSync(destFile)) {
      if (copyImageFile(sourceFile, destFile)) {
        copiedCount++;
      }
    }
  }
  
  console.log(`✅ Скопировано ${copiedCount} изображений из nft_assets/mutant_ape в mutant_ape_nft`);
  
  // Теперь копируем изображения, которые есть в mutant_ape_nft, но отсутствуют в nft_assets/mutant_ape
  copiedCount = 0;
  const missingInNftAssets = nftDirTokenIds.filter(id => !nftAssetsTokenIds.includes(id));
  console.log(`🔍 Токены, отсутствующие в nft_assets/mutant_ape: ${missingInNftAssets.length}`);
  
  for (const tokenId of missingInNftAssets) {
    const sourceFile = path.join(MUTANT_APE_NFT_DIR, `mutant_ape_${tokenId}.png`);
    const destFile = path.join(NFT_ASSETS_MUTANT_APE_DIR, `mutant_ape_${tokenId}.png`);
    
    if (fs.existsSync(sourceFile) && !fs.existsSync(destFile)) {
      if (copyImageFile(sourceFile, destFile)) {
        copiedCount++;
      }
    }
  }
  
  console.log(`✅ Скопировано ${copiedCount} изображений из mutant_ape_nft в nft_assets/mutant_ape`);
  
  return { 
    copiedToNftDir: copiedCount,
    copiedToNftAssets: copiedCount
  };
}

/**
 * Создает nft-server-port.txt для указания порта NFT сервера
 */
function createNFTServerPortFile() {
  console.log('🔧 Создаем файл с портом NFT сервера...');
  
  const portFile = path.join(process.cwd(), 'nft-server-port.txt');
  const port = 8081; // Порт по умолчанию
  
  try {
    fs.writeFileSync(portFile, port.toString(), 'utf8');
    console.log(`✅ Создан файл ${portFile} с портом ${port}`);
    return true;
  } catch (error) {
    console.error(`❌ Ошибка при создании файла ${portFile}:`, error);
    return false;
  }
}

/**
 * Основная функция скрипта
 */
function main() {
  console.log('🚀 Начинаем исправление изображений Mutant Ape...');
  
  // Создаем директории
  ensureDirectories();
  
  // Собираем информацию об изображениях
  const imageData = collectAllMutantApeImages();
  
  // Копируем недостающие изображения
  copyMissingMutantApeImages(imageData);
  
  // Создаем файл с портом NFT сервера
  createNFTServerPortFile();
  
  console.log('✅ Все операции успешно завершены');
}

// Запускаем скрипт
main();
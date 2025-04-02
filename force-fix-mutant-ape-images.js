/**
 * Скрипт для принудительного исправления путей к изображениям Mutant Ape
 * Включает диагностику, копирование файлов и обновление базы данных
 */

import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';

// Получаем текущую директорию
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Проверяем наличие переменной окружения с URL базы данных
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ Переменная окружения DATABASE_URL не найдена');
  process.exit(1);
}

// Создаем подключение к базе данных
const sql = neon(DATABASE_URL);

// Директории для работы
const MUTANT_APE_OFFICIAL_DIR = path.join(process.cwd(), 'mutant_ape_official');
const MUTANT_APE_NFT_DIR = path.join(process.cwd(), 'mutant_ape_nft');
const NFT_ASSETS_MUTANT_APE_DIR = path.join(process.cwd(), 'nft_assets', 'mutant_ape');

// Создаем директории, если они не существуют
function ensureDirectories() {
  const directories = [
    MUTANT_APE_OFFICIAL_DIR,
    MUTANT_APE_NFT_DIR,
    NFT_ASSETS_MUTANT_APE_DIR,
  ];
  
  for (const dir of directories) {
    if (!fs.existsSync(dir)) {
      console.log(`🔧 Создаем директорию ${dir}`);
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

/**
 * Проверяет наличие файла NFT и при необходимости копирует файл из другого места
 */
async function ensureNFTFileExists(filepath, collectionType) {
  // Удостоверяемся, что путь начинается с /
  if (!filepath.startsWith('/')) {
    filepath = '/' + filepath;
  }
  
  // Полный путь к файлу
  const fullPath = path.join(process.cwd(), filepath);
  
  // Проверяем существование файла
  if (fs.existsSync(fullPath)) {
    return true; // Файл существует
  }
  
  // Файл не существует, пробуем найти его в других местах
  console.log(`❌ Файл не найден: ${fullPath}`);
  
  // Извлекаем имя файла и токен ID
  const filename = path.basename(filepath);
  const match = filename.match(/mutant_ape_(\d+)\.png/);
  let tokenId = 0;
  
  if (match && match[1]) {
    tokenId = parseInt(match[1]);
  } else {
    console.error(`⚠️ Не удалось извлечь ID токена из ${filename}`);
    return false;
  }
  
  // Проверяем наличие файла в других директориях
  let sourcePath = null;
  let sourceFile = null;
  
  // Массив возможных директорий и файлов для поиска
  const possibleSources = [];
  
  // Проверяем mutant_ape_nft
  const mutantApeFile = path.join(MUTANT_APE_NFT_DIR, filename);
  if (fs.existsSync(mutantApeFile)) {
    possibleSources.push({ path: mutantApeFile, source: 'mutant_ape_nft' });
  }
  
  // Проверяем mutant_ape_official
  const officialFile = path.join(MUTANT_APE_OFFICIAL_DIR, filename);
  if (fs.existsSync(officialFile)) {
    possibleSources.push({ path: officialFile, source: 'mutant_ape_official' });
  }
  
  // Проверяем nft_assets/mutant_ape
  const nftAssetsFile = path.join(NFT_ASSETS_MUTANT_APE_DIR, filename);
  if (fs.existsSync(nftAssetsFile)) {
    possibleSources.push({ path: nftAssetsFile, source: 'nft_assets/mutant_ape' });
  }
  
  // Проверяем SVG файл в nft_assets/mutant_ape
  const svgFile = path.join(NFT_ASSETS_MUTANT_APE_DIR, filename.replace('.png', '.svg'));
  if (fs.existsSync(svgFile)) {
    possibleSources.push({ path: svgFile, source: 'nft_assets/mutant_ape (SVG)' });
  }
  
  // Если найдены возможные источники, выбираем лучший
  if (possibleSources.length > 0) {
    // Предпочитаем PNG вместо SVG
    const pngSources = possibleSources.filter(src => !src.path.endsWith('.svg'));
    if (pngSources.length > 0) {
      sourcePath = pngSources[0].path;
      sourceFile = pngSources[0].source;
    } else {
      // Если нет PNG, берем SVG (в этом случае нужно конвертировать, но это опускаем в этом скрипте)
      sourcePath = possibleSources[0].path;
      sourceFile = possibleSources[0].source;
    }
    
    // Создаем директорию назначения, если она не существует
    const destDir = path.dirname(fullPath);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    
    try {
      // Копируем файл
      fs.copyFileSync(sourcePath, fullPath);
      console.log(`✅ Создана копия изображения: ${filename} (из ${sourceFile})`);
      return true;
    } catch (error) {
      console.error(`❌ Ошибка при копировании файла для ${filename}:`, error);
    }
  } else {
    console.error(`❌ Не найдены источники для ${filename}`);
  }
  
  return false;
}

/**
 * Проверяет все NFT в коллекции Mutant Ape Yacht Club и исправляет пути к изображениям
 */
async function fixMutantApeImagePaths() {
  console.log('🔍 Проверяем NFT в коллекции Mutant Ape Yacht Club...');
  
  try {
    // Получаем ID коллекции Mutant Ape
    const collections = await sql`
      SELECT id, name FROM nft_collections 
      WHERE name ILIKE '%Mutant Ape%' OR name ILIKE '%MAYC%'
    `;
    
    if (!collections || collections.length === 0) {
      console.error('❌ Коллекция Mutant Ape не найдена в базе данных');
      return 0;
    }
    
    const mutantApeCollection = collections[0];
    console.log(`✅ Найдена коллекция: ${mutantApeCollection.name} (ID: ${mutantApeCollection.id})`);
    
    // Получаем все NFT из коллекции Mutant Ape Yacht Club
    const nfts = await sql`
      SELECT id, token_id, name, image_path 
      FROM nfts 
      WHERE collection_id = ${mutantApeCollection.id}
    `;
    
    console.log(`📋 Найдено ${nfts.length} NFT в коллекции Mutant Ape Yacht Club`);
    
    // Считаем количество обновленных NFT
    let updatedCount = 0;
    
    // Проверяем и исправляем пути к изображениям
    for (const nft of nfts) {
      console.log(`🧐 Проверяем NFT #${nft.token_id}: ${nft.name} (ID: ${nft.id})`);
      
      // Проверяем путь к изображению
      const imagePath = nft.image_path;
      console.log(`🔍 Текущий путь к изображению: ${imagePath}`);
      
      // Убеждаемся, что файл существует
      const fileExists = await ensureNFTFileExists(imagePath, 'mutant');
      
      if (!fileExists) {
        console.log(`⚠️ Файл не найден: ${imagePath}. Генерируем новый путь...`);
        
        // Генерируем новый путь к изображению на основе token_id
        const newImagePath = `/mutant_ape_nft/mutant_ape_${nft.token_id}.png`;
        console.log(`🔄 Новый путь к изображению: ${newImagePath}`);
        
        // Обновляем запись в базе данных
        await sql`
          UPDATE nfts 
          SET image_path = ${newImagePath}
          WHERE id = ${nft.id}
        `;
        
        // Обновляем путь в метаданных
        await sql`
          UPDATE nfts 
          SET metadata = jsonb_set(
            CASE WHEN metadata IS NULL THEN '{}' ELSE metadata END,
            '{image}',
            to_jsonb(${newImagePath}::text)
          )
          WHERE id = ${nft.id}
        `;
        
        // Проверяем наличие файла по новому пути и копируем его при необходимости
        await ensureNFTFileExists(newImagePath, 'mutant');
        
        console.log(`✅ Обновлен путь и метаданные для NFT #${nft.token_id}`);
        updatedCount++;
      }
    }
    
    console.log(`✅ Обновлено ${updatedCount} путей к изображениям из ${nfts.length} NFT`);
    
    return updatedCount;
  } catch (error) {
    console.error('❌ Ошибка при обновлении путей к изображениям:', error);
    return 0;
  }
}

/**
 * Исправляет пути в модуле обработки изображений на клиенте, если это необходимо
 */
async function fixClientImageHandling() {
  console.log('🔧 Проверяем обработку изображений на клиенте...');
  
  // Путь к клиентскому файлу обработки изображений
  const imageFunctionPath = path.join(process.cwd(), 'client', 'src', 'lib', 'image-utils.ts');
  
  if (fs.existsSync(imageFunctionPath)) {
    // Читаем содержимое файла
    const content = fs.readFileSync(imageFunctionPath, 'utf8');
    
    // Проверяем наличие обработки Mutant Ape
    if (!content.includes('mutant_ape_nft')) {
      console.log('⚠️ Файл image-utils.ts не содержит обработку mutant_ape_nft');
    } else {
      console.log('✅ Файл image-utils.ts содержит обработку mutant_ape_nft');
    }
    
    // Проверяем DEBUG_MODE (должен быть включен для диагностики)
    if (!content.includes('DEBUG_MODE = true')) {
      console.log('⚠️ DEBUG_MODE не включен в image-utils.ts');
      
      // Включаем DEBUG_MODE
      const updatedContent = content.replace(/DEBUG_MODE\s*=\s*false/, 'DEBUG_MODE = true');
      fs.writeFileSync(imageFunctionPath, updatedContent, 'utf8');
      console.log('✅ DEBUG_MODE включен в image-utils.ts');
    } else {
      console.log('✅ DEBUG_MODE включен в image-utils.ts');
    }
  } else {
    console.error(`❌ Файл ${imageFunctionPath} не найден`);
  }
}

/**
 * Проверяет работу NFT сервера
 */
async function checkNFTServer() {
  console.log('🔍 Проверяем работу NFT сервера...');
  
  // Проверяем наличие файла с портом NFT сервера
  const portFile = path.join(process.cwd(), 'nft-server-port.txt');
  let nftServerPort = 8081; // порт по умолчанию
  
  if (fs.existsSync(portFile)) {
    try {
      const portData = fs.readFileSync(portFile, 'utf8').trim();
      const port = parseInt(portData);
      if (!isNaN(port) && port > 0) {
        nftServerPort = port;
      }
    } catch (err) {
      console.error('⚠️ Ошибка при чтении порта NFT сервера:', err);
    }
  }
  
  console.log(`🔍 Проверяем NFT сервер на порту ${nftServerPort}...`);
  
  // Проверяем доступность NFT сервера
  return new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port: nftServerPort,
      path: '/status',
      method: 'GET'
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log(`✅ NFT сервер работает на порту ${nftServerPort}. Статус: ${res.statusCode}`);
        resolve(true);
      });
    });
    
    req.on('error', (err) => {
      console.error(`❌ Не удалось подключиться к NFT серверу на порту ${nftServerPort}:`, err.message);
      resolve(false);
    });
    
    req.end();
  });
}

/**
 * Проверяет наличие преобразованных из SVG файлов PNG
 * и при необходимости инициирует запуск конвертера
 */
async function checkConvertedImages() {
  console.log('🔍 Проверяем наличие преобразованных PNG файлов из SVG...');
  
  const nftAssetsMutantDir = NFT_ASSETS_MUTANT_APE_DIR;
  
  if (!fs.existsSync(nftAssetsMutantDir)) {
    console.error(`❌ Директория ${nftAssetsMutantDir} не существует`);
    return false;
  }
  
  // Количество файлов PNG и SVG в директории
  let pngCount = 0;
  let svgCount = 0;
  
  try {
    const files = fs.readdirSync(nftAssetsMutantDir);
    pngCount = files.filter(f => f.endsWith('.png')).length;
    svgCount = files.filter(f => f.endsWith('.svg')).length;
    
    console.log(`📊 В директории ${nftAssetsMutantDir} найдено ${pngCount} PNG файлов и ${svgCount} SVG файлов`);
    
    // Если PNG файлов меньше чем SVG, запускаем конвертер
    if (pngCount < svgCount) {
      console.log(`⚠️ Найдено меньше PNG (${pngCount}) чем SVG (${svgCount}). Возможно требуется конвертация.`);
      
      // Проверяем наличие скрипта конвертации
      const converterScript = path.join(process.cwd(), 'convert-nft-assets-svg-to-png.js');
      if (fs.existsSync(converterScript)) {
        console.log(`ℹ️ Скрипт конвертации ${converterScript} найден`);
        console.log(`ℹ️ Для запуска конвертации выполните: node convert-nft-assets-svg-to-png.js`);
      } else {
        console.error(`❌ Скрипт конвертации ${converterScript} не найден`);
      }
      
      return false;
    }
    
    return true;
  } catch (err) {
    console.error(`❌ Ошибка при проверке директории ${nftAssetsMutantDir}:`, err);
    return false;
  }
}

/**
 * Основная функция запуска скрипта
 */
async function main() {
  console.log('🚀 Начало исправления изображений Mutant Ape...');
  
  // Проверяем и создаем директории
  ensureDirectories();
  
  // Проверяем наличие преобразованных PNG файлов
  await checkConvertedImages();
  
  // Проверяем работу NFT сервера
  const nftServerRunning = await checkNFTServer();
  
  if (!nftServerRunning) {
    console.log('⚠️ NFT сервер не запущен. Продолжаем без проверки доступности изображений.');
  }
  
  // Исправляем пути к изображениям в базе данных
  const updatedCount = await fixMutantApeImagePaths();
  
  // Проверяем обработку изображений на клиенте
  await fixClientImageHandling();
  
  console.log(`✅ Все операции исправления изображений Mutant Ape завершены. Обновлено ${updatedCount} NFT.`);
}

// Запускаем основную функцию
main().catch(err => {
  console.error('❌ Ошибка при выполнении скрипта:', err);
  process.exit(1);
});
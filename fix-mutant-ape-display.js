/**
 * Скрипт для проверки и исправления отображения Mutant Ape NFT
 * Проверяет как обрабатываются изображения на клиенте и сервере
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
const { Client } = pg;

// Подключаемся к базе данных
const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

// Константы путей
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MUTANT_APE_DIR = path.join(process.cwd(), 'mutant_ape_nft');
const IMAGE_PATH_PREFIX = '/mutant_ape_nft/';

/**
 * Проверяет доступность изображений
 */
async function checkImageAvailability() {
  console.log('🖼️ Проверяем доступность изображений Mutant Ape...');
  
  // Проверяем наличие директории
  if (!fs.existsSync(MUTANT_APE_DIR)) {
    console.log(`⚠️ Директория ${MUTANT_APE_DIR} не существует!`);
    console.log('Создаем директорию...');
    fs.mkdirSync(MUTANT_APE_DIR, { recursive: true });
  }
  
  // Получаем список файлов в директории
  const files = fs.readdirSync(MUTANT_APE_DIR);
  const imageFiles = files.filter(file => file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.avif'));
  
  console.log(`📊 Найдено ${imageFiles.length} изображений в директории`);
  
  // Выводим первые 5 файлов для проверки
  console.log('🔎 Примеры изображений:');
  imageFiles.slice(0, 5).forEach((file, index) => {
    const filePath = path.join(MUTANT_APE_DIR, file);
    const stats = fs.statSync(filePath);
    console.log(`${index + 1}. ${file} (${(stats.size / 1024).toFixed(2)} KB)`);
  });
  
  return imageFiles;
}

/**
 * Проверяет пути к изображениям в базе данных
 */
async function checkDatabaseImagePaths() {
  console.log('🔍 Проверяем пути к изображениям в базе данных...');
  
  await client.connect();
  
  // Запрос на получение NFT коллекции Mutant Ape
  const query = `
    SELECT n.id, n.token_id, n.image_path, n.name, c.name as collection_name
    FROM nfts n
    JOIN nft_collections c ON n.collection_id = c.id
    WHERE c.name LIKE '%Mutant%'
    ORDER BY n.id
    LIMIT 20;
  `;
  
  const result = await client.query(query);
  const nfts = result.rows;
  
  console.log(`📊 Получено ${nfts.length} NFT из коллекции Mutant Ape`);
  
  // Проверяем пути к изображениям
  let validCount = 0;
  let invalidCount = 0;
  
  console.log('🔎 Примеры NFT и их пути к изображениям:');
  nfts.forEach((nft, index) => {
    const imagePath = nft.image_path;
    const isMutantPath = imagePath && imagePath.includes('mutant_ape');
    
    if (isMutantPath) {
      validCount++;
      console.log(`✅ ${index + 1}. ID: ${nft.id}, Token: ${nft.token_id}, Путь: ${imagePath}`);
    } else {
      invalidCount++;
      console.log(`❌ ${index + 1}. ID: ${nft.id}, Token: ${nft.token_id}, Путь: ${imagePath}`);
    }
  });
  
  console.log(`📊 Статистика: ${validCount} правильных путей, ${invalidCount} неправильных путей`);
  
  return nfts;
}

/**
 * Проверяет соответствие путей в базе и файлов на диске
 */
async function checkPathsAndFiles(nfts, imageFiles) {
  console.log('🔄 Проверяем соответствие путей и файлов...');
  
  const missingFiles = [];
  
  for (const nft of nfts) {
    if (!nft.image_path) {
      console.log(`⚠️ NFT ID ${nft.id} не имеет пути к изображению`);
      continue;
    }
    
    // Извлекаем имя файла из пути
    const fileName = path.basename(nft.image_path);
    
    // Проверяем существование файла
    const fileExists = imageFiles.includes(fileName);
    
    if (!fileExists) {
      console.log(`❌ Файл ${fileName} для NFT ID ${nft.id} не найден`);
      missingFiles.push({
        id: nft.id,
        tokenId: nft.token_id,
        imagePath: nft.image_path,
        fileName
      });
    }
  }
  
  console.log(`📊 Итог: ${missingFiles.length} отсутствующих файлов из ${nfts.length} NFT`);
  
  return missingFiles;
}

/**
 * Проверяет как обрабатываются пути к изображениям на клиенте
 */
async function analyzeClientImageHandling() {
  console.log('🧪 Анализируем обработку изображений на клиенте...');
  
  // Путь к клиентскому файлу обработки изображений
  const imageFunctionPath = path.join(process.cwd(), 'client', 'src', 'lib', 'image-utils.ts');
  
  if (fs.existsSync(imageFunctionPath)) {
    console.log('✅ Нашли файл обработки изображений на клиенте');
    const content = fs.readFileSync(imageFunctionPath, 'utf8');
    
    // Проверяем обработку Mutant Ape
    const hasMutantHandling = content.includes('mutant_ape');
    
    if (hasMutantHandling) {
      console.log('✅ Клиентский код содержит обработку Mutant Ape');
      
      // Проверяем корректность приоритета коллекций
      const usesMutantApeCollection = content.match(/collectionType\s*=\s*isOfficial\s*\?\s*['"]official['"]\s*:\s*['"]regular['"]/);
      
      if (usesMutantApeCollection) {
        console.log('✅ Клиентский код правильно определяет тип коллекции Mutant Ape');
      } else {
        console.log('❌ Клиентский код может неправильно определять тип коллекции Mutant Ape');
      }
    } else {
      console.log('❌ Клиентский код не содержит обработку Mutant Ape');
    }
  } else {
    console.log('❌ Файл обработки изображений на клиенте не найден');
  }
}

/**
 * Главная функция
 */
async function main() {
  console.log('🚀 Запускаем проверку отображения Mutant Ape NFT...');
  
  try {
    const imageFiles = await checkImageAvailability();
    const nfts = await checkDatabaseImagePaths();
    const missingFiles = await checkPathsAndFiles(nfts, imageFiles);
    await analyzeClientImageHandling();
    
    // Завершаем работу с базой данных
    await client.end();
    
    console.log('✅ Проверка завершена');
  } catch (error) {
    console.error('❌ Ошибка при выполнении проверки:', error);
    
    try {
      // Завершаем работу с базой данных в случае ошибки
      await client.end();
    } catch (err) {
      // Игнорируем ошибки при закрытии соединения
    }
  }
}

// Запускаем скрипт
main().catch(console.error);
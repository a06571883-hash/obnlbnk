/**
 * Скрипт для полного исправления путей к изображениям Mutant Ape NFT
 * Этот скрипт обеспечивает точное соответствие записей в базе данных
 * и реальных файлов изображений на диске.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Pool } from 'pg';
import dotenv from 'dotenv';

// Загружаем переменные окружения
dotenv.config();

// Константы путей
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MUTANT_APE_DIR = path.join(process.cwd(), 'mutant_ape_nft');
const TEMP_LOG_FILE = path.join(process.cwd(), 'mutant_ape_fixes.log');

// Подключение к базе данных
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Логирует действия в файл и консоль
 */
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `${timestamp} - ${message}`;
  console.log(logMessage);
  
  // Также сохраняем в лог-файл
  fs.appendFileSync(TEMP_LOG_FILE, logMessage + '\n');
}

/**
 * Получает информацию о коллекции Mutant Ape
 */
async function getMutantApeCollection() {
  log('🔍 Получаем информацию о коллекции Mutant Ape...');
  
  try {
    const result = await pool.query(`
      SELECT * FROM collections 
      WHERE name ILIKE '%mutant%' AND name ILIKE '%ape%'
    `);
    
    if (result.rows.length > 0) {
      log(`✅ Найдена коллекция Mutant Ape: ${result.rows[0].name} (ID: ${result.rows[0].id})`);
      return result.rows[0];
    } else {
      log('❌ Коллекция Mutant Ape не найдена');
      return null;
    }
  } catch (error) {
    log(`❌ Ошибка при поиске коллекции Mutant Ape: ${error.message}`);
    return null;
  }
}

/**
 * Получает список NFT из коллекции Mutant Ape
 */
async function getMutantApeNFTs(collectionId) {
  log(`🔍 Получаем список NFT из коллекции Mutant Ape (ID: ${collectionId})...`);
  
  try {
    const result = await pool.query(`
      SELECT * FROM nfts 
      WHERE collection_id = $1
    `, [collectionId]);
    
    log(`✅ Получено ${result.rows.length} NFT из коллекции Mutant Ape`);
    return result.rows;
  } catch (error) {
    log(`❌ Ошибка при получении NFT: ${error.message}`);
    return [];
  }
}

/**
 * Получает список файлов изображений из директории Mutant Ape
 */
function getMutantApeImages() {
  log(`🔍 Сканируем директорию изображений Mutant Ape: ${MUTANT_APE_DIR}`);
  
  if (!fs.existsSync(MUTANT_APE_DIR)) {
    log(`❌ Директория ${MUTANT_APE_DIR} не существует`);
    return [];
  }
  
  const files = fs.readdirSync(MUTANT_APE_DIR)
    .filter(file => file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.avif'));
  
  log(`✅ Найдено ${files.length} изображений Mutant Ape`);
  return files;
}

/**
 * Проверяет соответствие изображений и записей NFT
 */
function matchImagesAndNFTs(images, nfts) {
  log('🔍 Проверяем соответствие изображений и записей NFT...');
  
  const matches = [];
  const mismatches = [];
  
  // Создаем словарь для быстрого поиска
  const imageMap = {};
  images.forEach(image => {
    // Извлекаем номер токена из имени файла
    const tokenIdMatch = image.match(/mutant_ape_(\d+)\.png/i);
    if (tokenIdMatch) {
      const tokenId = parseInt(tokenIdMatch[1], 10);
      imageMap[tokenId] = image;
    }
  });
  
  // Проверяем каждый NFT
  nfts.forEach(nft => {
    const correctPath = `/mutant_ape_nft/mutant_ape_${nft.token_id.toString().padStart(4, '0')}.png`;
    const currentPath = nft.image_url;
    
    // Проверяем соответствие токен ID и имени файла
    const expectedFileName = `mutant_ape_${nft.token_id.toString().padStart(4, '0')}.png`;
    
    if (currentPath !== correctPath) {
      mismatches.push({
        nft,
        currentPath,
        correctPath,
        expectedFileName,
        fileExists: imageMap[nft.token_id] !== undefined
      });
    } else {
      matches.push({
        nft,
        currentPath
      });
    }
  });
  
  log(`✅ Результаты проверки:`);
  log(`   - ${matches.length} NFT с корректными путями к изображениям`);
  log(`   - ${mismatches.length} NFT требуют исправления путей`);
  
  return { matches, mismatches };
}

/**
 * Исправляет пути к изображениям в базе данных
 */
async function fixImagePaths(mismatches) {
  if (mismatches.length === 0) {
    log('✅ Все пути к изображениям корректны, исправление не требуется');
    return;
  }
  
  log(`🔧 Исправляем пути к изображениям для ${mismatches.length} NFT...`);
  
  // Группировка NFT по 50 для пакетного обновления
  const batchSize = 50;
  const batches = [];
  
  for (let i = 0; i < mismatches.length; i += batchSize) {
    batches.push(mismatches.slice(i, i + batchSize));
  }
  
  log(`🔧 Разбито на ${batches.length} пакетов по ~${batchSize} NFT`);
  
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    log(`🔧 Обработка пакета ${i+1}/${batches.length} (${batch.length} NFT)...`);
    
    for (const mismatch of batch) {
      try {
        await pool.query(`
          UPDATE nfts 
          SET image_url = $1
          WHERE id = $2
        `, [mismatch.correctPath, mismatch.nft.id]);
        
        log(`   ✅ Исправлено NFT ID ${mismatch.nft.id}, Token ID ${mismatch.nft.token_id}:`);
        log(`      ${mismatch.currentPath} -> ${mismatch.correctPath}`);
      } catch (error) {
        log(`   ❌ Ошибка при обновлении NFT ID ${mismatch.nft.id}: ${error.message}`);
      }
    }
    
    log(`✅ Пакет ${i+1}/${batches.length} обработан`);
  }
}

/**
 * Проверяет результаты исправления
 */
async function validateFixes(collectionId) {
  log('🔍 Проверяем результаты исправления...');
  
  try {
    const result = await pool.query(`
      SELECT image_url, COUNT(*) as count
      FROM nfts
      WHERE collection_id = $1
      GROUP BY image_url
    `, [collectionId]);
    
    log('📊 Статистика путей изображений после исправления:');
    result.rows.forEach(row => {
      log(`   ${row.image_url}: ${row.count} NFT`);
    });
    
    // Проверяем, все ли пути начинаются с /mutant_ape_nft/
    const correctPathsCount = result.rows
      .filter(row => row.image_url.startsWith('/mutant_ape_nft/'))
      .reduce((sum, row) => sum + parseInt(row.count), 0);
    
    const totalNFTs = result.rows
      .reduce((sum, row) => sum + parseInt(row.count), 0);
    
    log(`📊 ${correctPathsCount} из ${totalNFTs} NFT (${(correctPathsCount/totalNFTs*100).toFixed(2)}%) имеют корректные пути`);
    
    if (correctPathsCount === totalNFTs) {
      log('✅ Все пути к изображениям исправлены успешно');
    } else {
      log('⚠️ Не все пути к изображениям удалось исправить');
    }
  } catch (error) {
    log(`❌ Ошибка при проверке результатов: ${error.message}`);
  }
}

/**
 * Создает резервную копию коллекции перед изменениями
 */
async function backupMutantApeCollection(collectionId) {
  log('🔄 Создаем резервную копию коллекции Mutant Ape перед изменениями...');
  
  try {
    // Получаем все NFT коллекции
    const nftsResult = await pool.query(`
      SELECT * FROM nfts 
      WHERE collection_id = $1
    `, [collectionId]);
    
    // Сохраняем в JSON файл
    const backupData = {
      timestamp: new Date().toISOString(),
      collection_id: collectionId,
      nfts: nftsResult.rows
    };
    
    const backupDir = path.join(process.cwd(), 'backup');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    const backupPath = path.join(backupDir, `mutant_ape_nfts_backup_${Date.now()}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
    
    log(`✅ Резервная копия создана: ${backupPath}`);
    return backupPath;
  } catch (error) {
    log(`❌ Ошибка при создании резервной копии: ${error.message}`);
    return null;
  }
}

/**
 * Главная функция
 */
async function main() {
  try {
    log('🚀 Запуск скрипта исправления путей к изображениям Mutant Ape NFT...');
    
    // Создаем файл лога
    fs.writeFileSync(TEMP_LOG_FILE, `=== Лог исправлений Mutant Ape ${new Date().toISOString()} ===\n`);
    
    // Получаем информацию о коллекции
    const mutantApeCollection = await getMutantApeCollection();
    if (!mutantApeCollection) {
      log('❌ Коллекция Mutant Ape не найдена, завершаем работу');
      return;
    }
    
    // Создаем резервную копию коллекции
    const backupPath = await backupMutantApeCollection(mutantApeCollection.id);
    
    // Получаем список NFT
    const mutantApeNFTs = await getMutantApeNFTs(mutantApeCollection.id);
    
    // Получаем список изображений
    const mutantApeImages = getMutantApeImages();
    
    // Проверяем соответствие
    const { matches, mismatches } = matchImagesAndNFTs(mutantApeImages, mutantApeNFTs);
    
    // Исправляем пути к изображениям
    await fixImagePaths(mismatches);
    
    // Проверяем результаты
    await validateFixes(mutantApeCollection.id);
    
    log(`✅ Скрипт завершил работу успешно. Лог сохранен в ${TEMP_LOG_FILE}`);
    
    // Закрываем соединение с базой данных
    await pool.end();
  } catch (error) {
    log(`❌ Критическая ошибка: ${error.message}`);
    
    // Закрываем соединение с базой данных
    try {
      await pool.end();
    } catch (e) {
      // Игнорируем ошибки закрытия соединения
    }
  }
}

// Запускаем скрипт
main().catch(error => {
  console.error('Критическая ошибка при выполнении скрипта:', error);
  process.exit(1);
});
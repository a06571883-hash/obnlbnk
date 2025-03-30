/**
 * Скрипт для запуска исправления атрибутов NFT пакетами
 * Позволяет обрабатывать NFT по частям, чтобы избежать тайм-аутов
 */

import { exec } from 'child_process';
import fs from 'fs';

// Создаем скрипт для обработки определенного диапазона NFT
function createBatchScript(startId, endId) {
  const scriptContent = `
/**
 * Временный скрипт для исправления атрибутов NFT (пакет ${startId}-${endId})
 */

import pg from 'pg';
import dotenv from 'dotenv';

// Загружаем переменные окружения
dotenv.config();

// Подключение к базе данных
const dbConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? 
    { rejectUnauthorized: false } : false
};

const client = new pg.Client(dbConfig);

/**
 * Определяет редкость NFT на основе его ID
 * @param {number} tokenId ID токена NFT
 * @returns {string} Редкость NFT (common, uncommon, rare, epic, legendary)
 */
function determineRarity(tokenId) {
  const randomValue = (tokenId * 13) % 100;
  
  if (randomValue < 79) return 'common';
  if (randomValue < 93) return 'uncommon';
  if (randomValue < 98) return 'rare';
  if (randomValue < 99.5) return 'epic';
  return 'legendary';
}

/**
 * Генерирует атрибуты для NFT на основе его ID и редкости
 * @param {number} tokenId ID токена NFT
 * @param {string} rarity Редкость NFT
 * @returns {Object} Объект с атрибутами NFT
 */
function generateNFTAttributes(tokenId, rarity) {
  const seed = tokenId * 13;
  
  // Базовые значения на основе редкости
  let powerBase = 0;
  let wisdomBase = 0;
  let luckBase = 0;
  let agilityBase = 0;
  
  switch (rarity) {
    case 'common':
      powerBase = 30;
      wisdomBase = 30;
      luckBase = 30;
      agilityBase = 30;
      break;
    case 'uncommon':
      powerBase = 40;
      wisdomBase = 40;
      luckBase = 40;
      agilityBase = 40;
      break;
    case 'rare':
      powerBase = 50;
      wisdomBase = 50;
      luckBase = 50;
      agilityBase = 50;
      break;
    case 'epic':
      powerBase = 65;
      wisdomBase = 65;
      luckBase = 65;
      agilityBase = 65;
      break;
    case 'legendary':
      powerBase = 80;
      wisdomBase = 80;
      luckBase = 80;
      agilityBase = 80;
      break;
  }
  
  // Генерация атрибутов с небольшой случайностью на основе seed
  function generateAttributeValue(seed, attributeIndex, min, max) {
    const value = (seed * (attributeIndex + 1)) % (max - min) + min;
    return Math.floor(value);
  }
  
  const power = generateAttributeValue(seed, 1, powerBase - 10, powerBase + 10);
  const wisdom = generateAttributeValue(seed, 2, wisdomBase - 10, wisdomBase + 10);
  const luck = generateAttributeValue(seed, 3, luckBase - 10, luckBase + 10);
  const agility = generateAttributeValue(seed, 4, agilityBase - 10, agilityBase + 10);
  
  // Формируем объект с атрибутами, используя ключи, соответствующие фронтенду
  return {
    power,
    wisdom,
    luck,
    agility
  };
}

/**
 * Обновляет атрибуты для набора NFT в базе данных
 */
async function fixNFTAttributesBatch() {
  try {
    console.log('Подключение к базе данных...');
    await client.connect();
    console.log('Успешное подключение к базе данных');
    
    // Получаем список всех NFT с проблемными атрибутами или без атрибутов
    const { rows: nfts } = await client.query(\`
      SELECT id, token_id, name, attributes, rarity
      FROM nfts
      WHERE (attributes IS NULL OR 
             attributes::text = '{}' OR
             attributes::text = 'null' OR
             attributes::text LIKE '%NaN%' OR
             (attributes ? 'power') = false OR
             (attributes ? 'agility') = false OR
             (attributes ? 'wisdom') = false OR
             (attributes ? 'luck') = false) AND
             id BETWEEN ${startId} AND ${endId}
      LIMIT 500
    \`);
    
    console.log(\`Найдено \${nfts.length} NFT с проблемными атрибутами в диапазоне ${startId}-${endId}\`);
    
    // Обновляем атрибуты для каждого NFT
    let updatedCount = 0;
    let errorCount = 0;
    
    for (const nft of nfts) {
      try {
        const tokenId = parseInt(nft.token_id);
        let rarity = nft.rarity || determineRarity(tokenId);
        
        // Нормализуем редкость
        rarity = rarity.toLowerCase();
        
        // Генерируем атрибуты
        const attributes = generateNFTAttributes(tokenId, rarity);
        
        // Обновляем запись в базе данных
        await client.query(\`
          UPDATE nfts
          SET attributes = $1,
              rarity = $2
          WHERE id = $3
        \`, [JSON.stringify(attributes), rarity, nft.id]);
        
        updatedCount++;
        if (updatedCount % 50 === 0) {
          console.log(\`Обновлено \${updatedCount} NFT из \${nfts.length}\`);
        }
      } catch (nftError) {
        console.error(\`Ошибка при обновлении NFT ID \${nft.id}:\`, nftError.message);
        errorCount++;
      }
    }
    
    console.log(\`\nОбновление завершено! Успешно обновлено: \${updatedCount}, ошибок: \${errorCount}\`);
    
  } catch (error) {
    console.error('Ошибка при работе с базой данных:', error.message);
  } finally {
    await client.end();
    console.log('Соединение с базой данных закрыто');
  }
}

// Запускаем скрипт
fixNFTAttributesBatch().catch(console.error);
  `;
  
  const filename = `fix-attributes-batch-${startId}-${endId}.js`;
  fs.writeFileSync(filename, scriptContent);
  return filename;
}

// Выполнение скрипта с ожиданием завершения
function executeScript(scriptPath) {
  return new Promise((resolve, reject) => {
    console.log(`Запуск скрипта: ${scriptPath}`);
    
    const childProcess = exec(`node ${scriptPath}`, (error, stdout, stderr) => {
      if (error) {
        console.error(`Ошибка выполнения скрипта: ${error.message}`);
        reject(error);
        return;
      }
      
      if (stderr) {
        console.error(`Ошибки скрипта: ${stderr}`);
      }
      
      console.log(`Результат выполнения: ${stdout}`);
      resolve(stdout);
    });
    
    // Выводим информацию о выполнении в реальном времени
    childProcess.stdout.on('data', (data) => {
      process.stdout.write(data);
    });
    
    childProcess.stderr.on('data', (data) => {
      process.stderr.write(data);
    });
  });
}

// Главная функция для запуска пакетного исправления
async function runBatchFixes() {
  try {
    // Запускаем исправление в нескольких пакетах
    const batches = [
      { start: 1, end: 2000 },
      { start: 2001, end: 4000 },
      { start: 4001, end: 6000 },
      { start: 6001, end: 8000 },
      { start: 8001, end: 10000 }
    ];
    
    for (const batch of batches) {
      console.log(`\n------ Обработка NFT с ID ${batch.start} по ${batch.end} ------\n`);
      
      // Создаем временный скрипт для пакета
      const scriptName = createBatchScript(batch.start, batch.end);
      
      try {
        // Выполняем скрипт
        await executeScript(scriptName);
        console.log(`Пакет ${batch.start}-${batch.end} успешно обработан`);
        
        // Удаляем временный скрипт
        fs.unlinkSync(scriptName);
      } catch (error) {
        console.error(`Ошибка обработки пакета ${batch.start}-${batch.end}:`, error.message);
      }
      
      // Делаем короткую паузу между пакетами
      console.log('Пауза перед следующим пакетом (3 секунды)...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    console.log('\n------ Все пакеты успешно обработаны ------\n');
  } catch (error) {
    console.error('Ошибка при запуске пакетного исправления:', error.message);
  }
}

// Запускаем пакетное исправление
runBatchFixes().catch(console.error);
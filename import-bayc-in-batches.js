/**
 * Скрипт для импорта коллекции Bored Ape Yacht Club в пакетном режиме
 * Работает с небольшими пакетами, чтобы избежать таймаута
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Получаем путь к текущему файлу
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Проверяем наличие переменной окружения DATABASE_URL
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL не установлен. Устанавливаем соединение с базой данных невозможно.');
  process.exit(1);
}

// Создаем подключение к PostgreSQL
const client = postgres(process.env.DATABASE_URL, {
  ssl: { rejectUnauthorized: false },
  max: 10,
  idle_timeout: 20,
  connect_timeout: 30
});

// Параметры скрипта
const config = {
  // Начальный ID для импорта
  startId: parseInt(process.argv[2] || "0", 10),
  // Конечный ID для импорта
  endId: parseInt(process.argv[3] || "999", 10),
  // Размер пакета
  batchSize: 50,
  // ID регулятора/админа
  regulatorId: 5,
  // Имя коллекции
  collectionName: 'Bored Ape Yacht Club'
};

function determineRarity(tokenId) {
  // Определение редкости на основе последней цифры ID
  const lastDigit = tokenId % 10;
  
  if (lastDigit === 7 || lastDigit === 9) {
    return 'legendary'; // 20% (2/10) - самые редкие
  } else if (lastDigit === 0 || lastDigit === 5) {
    return 'epic'; // 20% (2/10) - очень редкие
  } else if (lastDigit === 1 || lastDigit === 8) {
    return 'rare'; // 20% (2/10) - редкие
  } else if (lastDigit === 2 || lastDigit === 6) {
    return 'uncommon'; // 20% (2/10) - необычные
  } else {
    return 'common'; // 20% (2/10) - обычные
  }
}

/**
 * Генерирует цену для NFT на основе его идентификатора и редкости
 * @param {number} tokenId ID токена NFT
 * @param {string} rarity Редкость NFT
 * @returns {number} Цена NFT в долларах
 */
function generateNFTPrice(tokenId, rarity) {
  // Базовые цены для разных уровней редкости
  const basePrices = {
    common: 16,               // $16 - $20,000
    uncommon: 251,            // $251 - $50,000
    rare: 2_133,              // $2,133 - $70,000
    epic: 32_678,             // $32,678 - $150,000
    legendary: 189_777        // $189,777 - $291,835
  };
  
  // Множитель на основе ID (чем меньше ID, тем ценнее NFT)
  const idMultiplier = Math.max(0.1, Math.min(1, 1 - (tokenId % 1000) / 1000));
  
  // Расчет модификатора цены (от 1 до 2)
  const priceModifier = 1 + idMultiplier;
  
  // Итоговая цена с учетом редкости и ID
  let price = Math.round(basePrices[rarity] * priceModifier);
  
  // Особая цена для первых 100 NFT (коллекционная ценность)
  if (tokenId < 100) {
    price = Math.round(price * 1.5); 
  }
  
  return price;
}

/**
 * Генерирует описание для NFT
 * @param {number} tokenId ID токена NFT
 * @param {string} rarity Редкость NFT
 * @returns {string} Описание NFT
 */
function generateNFTDescription(tokenId, rarity) {
  const baseDescriptions = {
    common: "Обычная обезьяна из клуба Bored Ape Yacht Club. Обладает стандартными чертами без особых украшений.",
    uncommon: "Необычная обезьяна из клуба Bored Ape Yacht Club. Имеет несколько интересных деталей, выделяющих её среди других.",
    rare: "Редкая обезьяна из клуба Bored Ape Yacht Club. Обладает уникальными чертами и особыми аксессуарами.",
    epic: "Очень редкая обезьяна из клуба Bored Ape Yacht Club. Выделяется исключительными характеристиками и стилем.",
    legendary: "Легендарная обезьяна из клуба Bored Ape Yacht Club. Одна из самых ценных и уникальных во всей коллекции."
  };
  
  // Усиливаем описание для первых 100 NFT
  let specialDescription = "";
  if (tokenId < 100) {
    specialDescription = " Принадлежит к первой сотне выпущенных обезьян, что придаёт ей особую коллекционную ценность.";
  }
  
  return `${baseDescriptions[rarity]}${specialDescription} Токен #${tokenId}`;
}

/**
 * Генерирует атрибуты для NFT на основе его ID и редкости
 * @param {number} tokenId ID токена NFT
 * @param {string} rarity Редкость NFT
 * @returns {Object} Объект с атрибутами NFT
 */
function generateNFTAttributes(tokenId, rarity) {
  // Базовые значения атрибутов в зависимости от редкости
  const rarityBaseStats = {
    common: { min: 30, max: 70 },
    uncommon: { min: 40, max: 80 },
    rare: { min: 50, max: 85 },
    epic: { min: 60, max: 90 },
    legendary: { min: 70, max: 99 }
  };
  
  // Используем ID как семя для генерации псевдо-случайных значений
  const seed = tokenId;
  
  // Функция для генерации псевдо-случайного числа на основе seed и диапазона
  function generateAttributeValue(seed, attributeIndex, min, max) {
    const hash = (seed * 9301 + 49297 + attributeIndex * 233) % 233280;
    return min + Math.floor((hash / 233280) * (max - min + 1));
  }
  
  // Генерируем значения атрибутов
  const baseStats = rarityBaseStats[rarity];
  const attributes = {
    power: generateAttributeValue(seed, 1, baseStats.min, baseStats.max),
    agility: generateAttributeValue(seed, 2, baseStats.min, baseStats.max),
    wisdom: generateAttributeValue(seed, 3, baseStats.min, baseStats.max),
    luck: generateAttributeValue(seed, 4, baseStats.min, baseStats.max)
  };
  
  return attributes;
}

/**
 * Проверяет, существует ли таблица с коллекциями NFT, и либо создает ее, 
 * либо получает существующую коллекцию Bored Ape Yacht Club
 * @returns {Promise<{success: boolean, collectionId: number, error?: string}>}
 */
async function setupBAYCCollection() {
  try {
    // Проверяем, существует ли коллекция BAYC
    const result = await client`
      SELECT id FROM nft_collections 
      WHERE name = ${config.collectionName}
    `;
    
    if (result.length > 0) {
      console.log(`Коллекция ${config.collectionName} найдена с ID ${result[0].id}`);
      return { success: true, collectionId: result[0].id };
    }
    
    // Если коллекция не существует, создаем новую
    const newCollection = await client`
      INSERT INTO nft_collections (name, description, user_id, cover_image, created_at)
      VALUES (
        ${config.collectionName}, 
        'Bored Ape Yacht Club - это коллекция из 10,000 уникальных NFT обезьян, живущих в блокчейне Ethereum.',
        ${config.regulatorId}, 
        '/bayc_official/bayc_1.png',
        NOW()
      )
      RETURNING id
    `;
    
    console.log(`Создана новая коллекция ${config.collectionName} с ID ${newCollection[0].id}`);
    return { success: true, collectionId: newCollection[0].id };
  } catch (error) {
    console.error('Ошибка при настройке коллекции BAYC:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Получает максимальный ID токена NFT, уже существующий в базе данных
 * @returns {Promise<{success: boolean, maxTokenId: number, error?: string}>}
 */
async function getMaxExistingTokenId() {
  try {
    const result = await client`
      SELECT MAX(CAST(token_id AS INTEGER)) as max_token_id 
      FROM nfts
    `;
    
    const maxTokenId = result[0]?.max_token_id || -1;
    console.log(`Максимальный существующий ID токена: ${maxTokenId}`);
    return { success: true, maxTokenId };
  } catch (error) {
    console.error('Ошибка при получении максимального ID токена:', error);
    return { success: false, maxTokenId: -1, error: error.message };
  }
}

/**
 * Импортирует пакет NFT в маркетплейс
 * @param {number} startId Начальный ID токена для импорта
 * @param {number} endId Конечный ID токена для импорта
 * @param {number} collectionId ID коллекции
 * @param {number} regulatorId ID регулятора (владельца)
 * @returns {Promise<{success: boolean, created: number, error?: string}>}
 */
async function importBAYCBatch(startId, endId, collectionId, regulatorId) {
  try {
    console.log(`Импорт пакета NFT с ID от ${startId} до ${endId}...`);
    let createdCount = 0;
    
    for (let tokenId = startId; tokenId <= endId; tokenId++) {
      // Определяем редкость и генерируем свойства
      const rarity = determineRarity(tokenId);
      const price = generateNFTPrice(tokenId, rarity);
      const description = generateNFTDescription(tokenId, rarity);
      const attributes = generateNFTAttributes(tokenId, rarity);
      
      try {
        // Проверяем, существует ли уже такой NFT
        const existingNFT = await client`
          SELECT id FROM nfts WHERE token_id = ${tokenId.toString()}
        `;
        
        if (existingNFT.length > 0) {
          console.log(`NFT с token_id ${tokenId} уже существует, пропускаем...`);
          continue;
        }
        
        // Создаем NFT запись
        await client`
          INSERT INTO nfts (
            collection_id, token_id, name, description, image_path, 
            price, for_sale, owner_id, rarity, attributes, minted_at
          )
          VALUES (
            ${collectionId},
            ${tokenId.toString()},
            ${'Bored Ape #' + tokenId},
            ${description},
            ${'/bayc_official/bayc_' + tokenId + '.png'},
            ${price.toString()},
            ${true},
            ${regulatorId},
            ${rarity},
            ${JSON.stringify(attributes)},
            NOW()
          )
        `;
        
        createdCount++;
      } catch (error) {
        console.error(`Ошибка при создании NFT #${tokenId}:`, error);
      }
    }
    
    console.log(`Создано ${createdCount} NFT`);
    return { success: true, created: createdCount };
  } catch (error) {
    console.error('Ошибка при импорте пакета NFT:', error);
    return { success: false, created: 0, error: error.message };
  }
}

/**
 * Создает заглушку-изображение для NFT, если нет шаблонов
 * @returns {Promise<boolean>}
 */
async function createPlaceholderImage() {
  const placeholderDir = path.join('./public/bayc_official');
  try {
    // Проверяем, существует ли директория
    if (!fs.existsSync(placeholderDir)) {
      fs.mkdirSync(placeholderDir, { recursive: true });
    }
    
    // Проверяем, существуют ли уже изображения
    const placeholderPath = path.join(placeholderDir, 'bayc_placeholder.png');
    
    if (!fs.existsSync(placeholderPath)) {
      // Создаем простой файл-заглушку (пустой)
      fs.writeFileSync(placeholderPath, '');
      console.log(`Создана заглушка ${placeholderPath}`);
    }
    
    return true;
  } catch (error) {
    console.error('Ошибка при создании заглушки:', error);
    return false;
  }
}

/**
 * Основная функция запуска скрипта
 */
async function main() {
  try {
    console.log(`Запуск скрипта для импорта BAYC NFT с ID от ${config.startId} до ${config.endId}...`);
    
    // Создаем заглушку-изображение для проверки
    await createPlaceholderImage();
    
    // Настраиваем коллекцию BAYC
    const { success, collectionId, error } = await setupBAYCCollection();
    
    if (!success) {
      throw new Error(`Ошибка при настройке коллекции: ${error}`);
    }
    
    // Импортируем NFT партиями для избежания таймаута
    let totalCreated = 0;
    const totalToCreate = config.endId - config.startId + 1;
    
    for (let batchStart = config.startId; batchStart <= config.endId; batchStart += config.batchSize) {
      const batchEnd = Math.min(batchStart + config.batchSize - 1, config.endId);
      
      const result = await importBAYCBatch(batchStart, batchEnd, collectionId, config.regulatorId);
      
      if (result.success) {
        totalCreated += result.created;
        console.log(`Прогресс: ${Math.round(totalCreated / totalToCreate * 100)}% (${totalCreated}/${totalToCreate})`);
      } else {
        console.error(`Ошибка при импорте пакета: ${result.error}`);
      }
    }
    
    console.log(`Импорт завершен. Всего создано ${totalCreated} NFT.`);
  } catch (error) {
    console.error('Ошибка при выполнении скрипта:', error);
  } finally {
    // Закрываем соединение с базой данных
    await client.end();
    console.log('Соединение с базой данных закрыто');
  }
}

// Запускаем основную функцию
main();
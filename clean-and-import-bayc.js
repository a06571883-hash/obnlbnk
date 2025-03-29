/**
 * Скрипт для полного удаления всех не-BAYC NFT из базы данных
 * и импорта только уникальных обезьян Bored Ape Yacht Club
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, sql } from 'drizzle-orm';
import { createCanvas } from '@napi-rs/canvas';
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

// Загружаем схему из файла схемы
const schema = {
  nfts: {
    id: 'id',
    collectionId: 'collection_id',
    ownerId: 'owner_id',
    name: 'name',
    description: 'description',
    imagePath: 'image_path',
    attributes: 'attributes',
    rarity: 'rarity',
    price: 'price',
    forSale: 'for_sale',
    mintedAt: 'minted_at',
    tokenId: 'token_id'
  },
  nftCollections: {
    id: 'id',
    name: 'name',
    description: 'description',
    userId: 'user_id',
    coverImage: 'cover_image',
    createdAt: 'created_at'
  }
};

// Инициализируем Drizzle ORM с схемой
const db = drizzle(client);

/**
 * Определяет редкость NFT на основе его ID
 * @param {number} tokenId ID токена NFT
 * @returns {string} Редкость NFT (common, uncommon, rare, epic, legendary)
 */
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
 * Полностью очищает базу данных от всех NFT,
 * которые не являются обезьянами BAYC
 */
async function cleanAllNonBAYCNFT() {
  try {
    console.log("Начинаем удаление всех не-BAYC NFT из базы данных...");
    
    // 1. Находим ID коллекции BAYC
    const baycCollectionResult = await client`
      SELECT id FROM nft_collections 
      WHERE name = 'Bored Ape Yacht Club'
    `;
    
    // 2. Если коллекция не существует, удаляем все NFT
    if (baycCollectionResult.length === 0) {
      console.log("Коллекция BAYC не найдена, удаляем все существующие NFT и коллекции...");
      
      // Удаляем все NFT
      const deletedNfts = await client`DELETE FROM nfts RETURNING id`;
      console.log(`Удалено ${deletedNfts.length} NFT`);
      
      // Удаляем все коллекции
      const deletedCollections = await client`DELETE FROM nft_collections RETURNING id`;
      console.log(`Удалено ${deletedCollections.length} коллекций NFT`);
    } else {
      // 3. Если коллекция BAYC существует, удаляем только NFT из других коллекций
      const baycCollectionId = baycCollectionResult[0].id;
      console.log(`Коллекция BAYC найдена с ID ${baycCollectionId}`);
      
      // Удаляем только NFT, не относящиеся к коллекции BAYC
      const deletedNfts = await client`
        DELETE FROM nfts 
        WHERE collection_id <> ${baycCollectionId}
        RETURNING id
      `;
      console.log(`Удалено ${deletedNfts.length} не-BAYC NFT`);
      
      // Удаляем другие коллекции, кроме BAYC
      const deletedCollections = await client`
        DELETE FROM nft_collections 
        WHERE id <> ${baycCollectionId}
        RETURNING id
      `;
      console.log(`Удалено ${deletedCollections.length} других коллекций NFT`);
    }
    
    console.log("Очистка завершена успешно.");
    return true;
  } catch (error) {
    console.error("Ошибка при очистке NFT:", error);
    return false;
  }
}

/**
 * Импортирует изображения обезьян BAYC в маркетплейс
 */
async function importBoredApesToMarketplace() {
  try {
    console.log("Начинаем импорт обезьян BAYC в маркетплейс...");
    
    // 1. Создаем коллекцию BAYC, если она не существует
    const baycCollectionResult = await client`
      SELECT id FROM nft_collections 
      WHERE name = 'Bored Ape Yacht Club'
    `;
    
    let baycCollectionId;
    
    if (baycCollectionResult.length === 0) {
      // Создаем новую коллекцию
      const newCollection = await client`
        INSERT INTO nft_collections (name, description, user_id, cover_image, created_at)
        VALUES (
          'Bored Ape Yacht Club', 
          'Bored Ape Yacht Club - это коллекция из 10,000 уникальных NFT обезьян, живущих в блокчейне Ethereum.',
          5, 
          '/bayc_official/bayc_1.png',
          NOW()
        )
        RETURNING id
      `;
      
      baycCollectionId = newCollection[0].id;
      console.log(`Создана новая коллекция BAYC с ID ${baycCollectionId}`);
    } else {
      baycCollectionId = baycCollectionResult[0].id;
      console.log(`Использование существующей коллекции BAYC с ID ${baycCollectionId}`);
    }
    
    // 2. Импортируем NFT
    const totalNFTCount = 10000;
    const batchSize = 200;
    let importedCount = 0;
    
    for (let batchStart = 0; batchStart < totalNFTCount; batchStart += batchSize) {
      const batchEnd = Math.min(batchStart + batchSize, totalNFTCount) - 1;
      console.log(`Импорт пакета NFT с ID от ${batchStart} до ${batchEnd}...`);
      
      // Для каждого NFT в пакете
      for (let tokenId = batchStart; tokenId <= batchEnd; tokenId++) {
        try {
          // Определяем редкость и генерируем свойства
          const rarity = determineRarity(tokenId);
          const price = generateNFTPrice(tokenId, rarity);
          const description = generateNFTDescription(tokenId, rarity);
          const attributes = generateNFTAttributes(tokenId, rarity);
          
          // Создаем NFT запись
          await client`
            INSERT INTO nfts (
              collection_id, token_id, name, description, image_path, 
              price, for_sale, owner_id, rarity, attributes, minted_at
            )
            VALUES (
              ${baycCollectionId},
              ${tokenId.toString()},
              ${'Bored Ape #' + tokenId},
              ${description},
              ${'/bayc_official/bayc_' + tokenId + '.png'},
              ${price.toString()},
              ${true},
              ${5},
              ${rarity},
              ${JSON.stringify(attributes)},
              NOW()
            )
            ON CONFLICT (id) DO NOTHING
          `;
          
          importedCount++;
        } catch (error) {
          console.error(`Ошибка при импорте NFT #${tokenId}:`, error);
        }
      }
      
      console.log(`Прогресс: ${Math.round(importedCount / totalNFTCount * 100)}% (${importedCount}/${totalNFTCount})`);
    }
    
    console.log(`Импорт завершен. Всего создано ${importedCount} NFT.`);
    return true;
  } catch (error) {
    console.error("Ошибка при импорте обезьян BAYC:", error);
    return false;
  }
}

/**
 * Удаляет дубликаты NFT
 */
async function removeDuplicateNFTs() {
  try {
    console.log("Удаление дубликатов NFT...");
    
    // Находим дубликаты по tokenId
    const duplicates = await client`
      WITH duplicates AS (
        SELECT token_id, collection_id, COUNT(*) as count
        FROM nfts
        GROUP BY token_id, collection_id
        HAVING COUNT(*) > 1
      )
      SELECT n.id, n.token_id, n.collection_id
      FROM nfts n
      JOIN duplicates d ON n.token_id = d.token_id AND n.collection_id = d.collection_id
      ORDER BY n.token_id, n.id DESC
    `;
    
    if (duplicates.length === 0) {
      console.log("Дубликаты NFT не найдены");
      return true;
    }
    
    console.log(`Найдено ${duplicates.length} дубликатов NFT`);
    
    // Группируем дубликаты по tokenId и collectionId
    const duplicateGroups = {};
    
    for (const duplicate of duplicates) {
      const key = `${duplicate.token_id}_${duplicate.collection_id}`;
      if (!duplicateGroups[key]) {
        duplicateGroups[key] = [];
      }
      duplicateGroups[key].push(duplicate.id);
    }
    
    // Оставляем только первый NFT из каждой группы дубликатов
    for (const key in duplicateGroups) {
      const ids = duplicateGroups[key];
      
      // Сортируем ID, чтобы оставить первый (с наименьшим ID)
      ids.sort((a, b) => a - b);
      
      // Оставляем первый и удаляем остальные
      const toDelete = ids.slice(1);
      
      if (toDelete.length > 0) {
        await client`
          DELETE FROM nfts
          WHERE id IN (${toDelete.join(',')})
        `;
        
        console.log(`Удалено ${toDelete.length} дубликатов для tokenId ${key}`);
      }
    }
    
    console.log("Удаление дубликатов завершено");
    return true;
  } catch (error) {
    console.error("Ошибка при удалении дубликатов:", error);
    return false;
  }
}

/**
 * Основная функция запуска скрипта
 */
async function main() {
  try {
    console.log("Запуск скрипта для очистки и импорта обезьян BAYC...");
    
    // 1. Очищаем базу данных от не-BAYC NFT
    await cleanAllNonBAYCNFT();
    
    // 2. Импортируем обезьян BAYC в маркетплейс
    await importBoredApesToMarketplace();
    
    // 3. Удаляем дубликаты NFT
    await removeDuplicateNFTs();
    
    console.log("Скрипт успешно выполнен");
  } catch (error) {
    console.error("Ошибка при выполнении скрипта:", error);
  } finally {
    // Закрываем соединение с базой данных
    await client.end();
    console.log("Соединение с базой данных закрыто");
  }
}

// Запускаем основную функцию
main();
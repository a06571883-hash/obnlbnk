/**
 * Скрипт для полного удаления всех не-BAYC NFT из базы данных
 * и импорта только уникальных обезьян Bored Ape Yacht Club
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';

const { Pool } = pkg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Подключение к PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

/**
 * Определяет редкость NFT на основе его ID
 * @param {number} tokenId ID токена NFT
 * @returns {string} Редкость NFT (common, uncommon, rare, epic, legendary)
 */
function determineRarity(tokenId) {
  // Используем ID токена для определения редкости
  // Чем меньше вероятность, тем выше редкость
  const random = Math.sin(tokenId) * 10000;
  const normalizedRandom = Math.abs(random) % 100;

  if (normalizedRandom < 5) {
    return 'legendary'; // 5% - легендарные
  } else if (normalizedRandom < 15) {
    return 'epic'; // 10% - эпические
  } else if (normalizedRandom < 35) {
    return 'rare'; // 20% - редкие
  } else if (normalizedRandom < 65) {
    return 'uncommon'; // 30% - необычные
  } else {
    return 'common'; // 35% - обычные
  }
}

/**
 * Генерирует цену для NFT на основе его идентификатора и редкости
 * @param {number} tokenId ID токена NFT
 * @param {string} rarity Редкость NFT
 * @returns {number} Цена NFT в долларах
 */
function generateNFTPrice(tokenId, rarity) {
  // Базовая цена зависит от редкости
  let basePrice = 0;
  switch (rarity) {
    case 'legendary':
      basePrice = 200000;
      break;
    case 'epic':
      basePrice = 40000;
      break;
    case 'rare':
      basePrice = 5000;
      break;
    case 'uncommon':
      basePrice = 500;
      break;
    case 'common':
      basePrice = 20;
      break;
    default:
      basePrice = 10;
  }

  // Вариация цены на основе ID токена (±20%)
  const variationFactor = 0.8 + (Math.abs(Math.sin(tokenId * 13)) * 0.4);
  return Math.round(basePrice * variationFactor);
}

/**
 * Генерирует описание для NFT
 * @param {number} tokenId ID токена NFT
 * @param {string} rarity Редкость NFT
 * @returns {string} Описание NFT
 */
function generateNFTDescription(tokenId, rarity) {
  const descriptions = {
    legendary: [
      "Невероятно редкий экземпляр из коллекции Bored Ape Yacht Club. Этот NFT представляет собой уникальное произведение цифрового искусства с исключительными чертами, делающими его одним из самых ценных в коллекции.",
      "Эксклюзивный Bored Ape с легендарным статусом. Владение этим NFT открывает доступ к элитному сообществу коллекционеров и мероприятиям BAYC.",
      "Один из самых редких и ценных Bored Ape в существовании. Уникальная комбинация признаков делает эту обезьяну настоящим сокровищем цифрового искусства.",
    ],
    epic: [
      "Эпический Bored Ape с редкими характеристиками, выделяющими его среди других. Этот NFT является частью знаменитой коллекции BAYC, известной своей эксклюзивностью и культовым статусом.",
      "Необычайно редкий экземпляр из коллекции Bored Ape Yacht Club с выдающимися чертами. Владение этим NFT дает доступ к эксклюзивному сообществу BAYC.",
      "Высоко ценимый Bored Ape с редкими атрибутами. Этот NFT представляет собой значительную инвестицию в пространстве цифрового искусства.",
    ],
    rare: [
      "Редкий Bored Ape с уникальной комбинацией черт. Этот NFT является частью престижной коллекции BAYC, одной из самых известных в мире криптоискусства.",
      "Ценный экземпляр из коллекции Bored Ape Yacht Club с необычными характеристиками. Этот NFT отражает культурное влияние BAYC в пространстве цифрового искусства.",
      "Редкий Bored Ape с отличительными чертами. Этот NFT представляет собой отличную возможность для коллекционеров и энтузиастов криптоискусства.",
    ],
    uncommon: [
      "Необычный Bored Ape с интересной комбинацией характеристик. Этот NFT из знаменитой коллекции BAYC имеет свой уникальный характер и стиль.",
      "Отличительный Bored Ape с примечательными чертами. Часть культовой коллекции BAYC, изменившей представление о цифровом искусстве и NFT.",
      "Уникальный Bored Ape с выразительным характером. Этот NFT представляет возможность стать частью сообщества BAYC, одного из самых влиятельных в NFT пространстве.",
    ],
    common: [
      "Классический Bored Ape из знаменитой коллекции BAYC. Даже будучи более распространенным, этот NFT представляет собой входной билет в легендарное сообщество Bored Ape Yacht Club.",
      "Традиционный Bored Ape с характерными чертами коллекции. Этот NFT является частью культурного феномена BAYC, ставшего синонимом элитного статуса в мире NFT.",
      "Стандартный, но стильный Bored Ape. Этот NFT из коллекции BAYC представляет собой отличную начальную точку для коллекционеров криптоискусства.",
    ]
  };

  // Выбираем случайное описание из соответствующей категории редкости
  const descArray = descriptions[rarity] || descriptions.common;
  const randomIndex = Math.abs(Math.floor(Math.sin(tokenId * 7) * descArray.length)) % descArray.length;
  return descArray[randomIndex];
}

/**
 * Генерирует атрибуты для NFT на основе его ID и редкости
 * @param {number} tokenId ID токена NFT
 * @param {string} rarity Редкость NFT
 * @returns {Object} Объект с атрибутами NFT
 */
function generateNFTAttributes(tokenId, rarity) {
  // Базовые значения атрибутов зависят от редкости
  let baseValue;
  switch (rarity) {
    case 'legendary':
      baseValue = 85;
      break;
    case 'epic':
      baseValue = 75;
      break;
    case 'rare':
      baseValue = 65;
      break;
    case 'uncommon':
      baseValue = 55;
      break;
    case 'common':
      baseValue = 45;
      break;
    default:
      baseValue = 40;
  }

  // Генерируем атрибуты с некоторой вариацией
  const generateAttribute = (seed) => {
    const variation = 15; // ±15 от базового значения
    const value = baseValue + Math.floor((Math.sin(tokenId * seed) * variation));
    return Math.max(1, Math.min(100, value)); // Ограничиваем значение диапазоном 1-100
  };

  return {
    power: generateAttribute(11),
    agility: generateAttribute(23),
    wisdom: generateAttribute(37),
    luck: generateAttribute(59)
  };
}

/**
 * Полностью очищает базу данных от всех NFT,
 * которые не являются обезьянами BAYC
 */
async function cleanAllNonBAYCNFT() {
  const client = await pool.connect();
  try {
    console.log('Начинаем транзакцию для очистки NFT...');
    await client.query('BEGIN');
    
    // Функция для определения, является ли NFT обезьяной BAYC
    const isBAYC = (name, imagePath, collectionName) => {
      const nameCheck = name?.toLowerCase().includes('ape') || 
                         name?.toLowerCase().includes('bayc') || 
                         name?.toLowerCase().includes('bored');
      
      const imageCheck = imagePath?.includes('bayc_') || 
                         imagePath?.includes('official_bayc_');
      
      const collectionCheck = collectionName?.toLowerCase?.().includes('bored') || 
                              collectionName?.toLowerCase?.().includes('ape') || 
                              collectionName?.toLowerCase?.().includes('bayc');
      
      return nameCheck || imageCheck || collectionCheck;
    };

    // 1. Сначала получаем все NFT
    const { rows: allNFTs } = await client.query('SELECT * FROM nfts');
    console.log(`Всего найдено ${allNFTs.length} NFT в таблице nfts`);
    
    // Фильтруем только не-BAYC NFT
    const nonBaycIds = allNFTs
      .filter(nft => !isBAYC(nft.name, nft.image_path, nft.collection_id))
      .map(nft => nft.id);
    
    console.log(`Найдено ${nonBaycIds.length} не-BAYC NFT для удаления из таблицы nfts`);
    
    if (nonBaycIds.length > 0) {
      // Удаляем все переводы NFT, связанные с не-BAYC
      await client.query('DELETE FROM nft_transfers WHERE nft_id = ANY($1)', [nonBaycIds]);
      console.log(`Удалены записи переводов для не-BAYC NFT`);
      
      // Удаляем сами не-BAYC NFT
      await client.query('DELETE FROM nfts WHERE id = ANY($1)', [nonBaycIds]);
      console.log(`Удалены не-BAYC NFT из таблицы nfts`);
    }
    
    // 2. Теперь очищаем старую таблицу nft от не-BAYC
    try {
      const { rows: legacyNFTs } = await client.query('SELECT * FROM nft');
      console.log(`Всего найдено ${legacyNFTs.length} NFT в устаревшей таблице nft`);
      
      // Фильтруем только не-BAYC NFT в legacy таблице
      const nonBaycLegacyIds = legacyNFTs
        .filter(nft => !isBAYC(nft.name, nft.image_url, nft.collection_name))
        .map(nft => nft.id);
      
      console.log(`Найдено ${nonBaycLegacyIds.length} не-BAYC NFT для удаления из устаревшей таблицы nft`);
      
      if (nonBaycLegacyIds.length > 0) {
        // Удаляем все не-BAYC NFT из legacy таблицы
        await client.query('DELETE FROM nft WHERE id = ANY($1)', [nonBaycLegacyIds]);
        console.log(`Удалены не-BAYC NFT из устаревшей таблицы nft`);
      }
    } catch (err) {
      console.log("Старая таблица nft не существует или иная ошибка:", err.message);
    }
    
    await client.query('COMMIT');
    console.log('Транзакция успешно завершена');
    
    return {
      success: true,
      removedFromNfts: nonBaycIds.length,
      removedFromLegacy: 0
    };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Ошибка при очистке NFT:', error);
    return {
      success: false,
      error: error.message
    };
  } finally {
    client.release();
  }
}

/**
 * Импортирует изображения обезьян BAYC в маркетплейс
 */
async function importBoredApesToMarketplace() {
  const client = await pool.connect();
  try {
    console.log('Начинаем импорт обезьян Bored Ape Yacht Club...');
    
    // Получаем информацию о регуляторе (админе)
    const { rows: adminUsers } = await client.query(
      "SELECT * FROM users WHERE username = 'admin' OR username = 'regulator' LIMIT 1"
    );
    
    if (adminUsers.length === 0) {
      throw new Error('Не удалось найти пользователя admin или regulator');
    }
    
    const regulator = adminUsers[0];
    console.log(`Найден регулятор: ${regulator.username} (id: ${regulator.id})`);
    
    // Получаем ID коллекции BAYC или создаем новую
    let collectionId;
    const { rows: collections } = await client.query(
      "SELECT * FROM nft_collections WHERE name LIKE '%Bored Ape%' OR name LIKE '%BAYC%' LIMIT 1"
    );
    
    if (collections.length > 0) {
      collectionId = collections[0].id;
      console.log(`Найдена коллекция BAYC: ${collections[0].name} (id: ${collectionId})`);
    } else {
      const { rows: newCollection } = await client.query(
        "INSERT INTO nft_collections (name, description, creator_id) VALUES ($1, $2, $3) RETURNING id",
        ['Bored Ape Yacht Club', 'Официальная коллекция Bored Ape Yacht Club - эксклюзивные NFT обезьян', regulator.id]
      );
      collectionId = newCollection[0].id;
      console.log(`Создана новая коллекция BAYC (id: ${collectionId})`);
    }
    
    // Путь к директории с изображениями
    const imagesDir = path.join(__dirname, 'public/bayc_official');
    
    // Проверяем, что директория существует
    if (!fs.existsSync(imagesDir)) {
      throw new Error(`Директория с изображениями не найдена: ${imagesDir}`);
    }
    
    // Получаем все PNG файлы
    const imageFiles = fs.readdirSync(imagesDir)
      .filter(file => file.startsWith('bayc_') && file.endsWith('.png'))
      .sort((a, b) => {
        const numA = parseInt(a.replace('bayc_', '').replace('.png', ''));
        const numB = parseInt(b.replace('bayc_', '').replace('.png', ''));
        return numA - numB;
      });
    
    console.log(`Найдено ${imageFiles.length} изображений BAYC`);
    
    // Начинаем транзакцию для импорта
    await client.query('BEGIN');
    
    // Получаем уже существующие NFT для проверки дубликатов
    const { rows: existingNFTs } = await client.query(
      "SELECT * FROM nfts WHERE name LIKE '%Bored Ape%' OR name LIKE '%BAYC%' OR image_path LIKE '%bayc_%'"
    );
    console.log(`В базе уже есть ${existingNFTs.length} NFT BAYC`);
    
    // Создаем Set с уже импортированными ID токенов
    const existingTokenIds = new Set(existingNFTs.map(nft => nft.token_id));
    
    // Счетчики для статистики
    let created = 0;
    let skipped = 0;
    
    // Импортируем каждое изображение
    for (const imageFile of imageFiles) {
      const tokenId = imageFile.replace('bayc_', '').replace('.png', '');
      
      // Проверяем, существует ли уже этот токен
      if (existingTokenIds.has(`BAYC-${tokenId}`)) {
        console.log(`Пропуск токена BAYC-${tokenId} - уже существует`);
        skipped++;
        continue;
      }
      
      // Определяем редкость на основе ID
      const rarity = determineRarity(parseInt(tokenId));
      
      // Генерируем цену в зависимости от редкости
      const price = generateNFTPrice(parseInt(tokenId), rarity);
      
      // Генерируем описание
      const description = generateNFTDescription(parseInt(tokenId), rarity);
      
      // Генерируем атрибуты
      const attributes = generateNFTAttributes(parseInt(tokenId), rarity);
      
      // Путь к изображению
      const imagePath = `/bayc_official/${imageFile}`;
      
      // Создаем имя для NFT
      const name = `Bored Ape #${tokenId}`;
      
      // Вставляем NFT в базу данных
      await client.query(
        `INSERT INTO nfts (
          token_id, name, description, image_path, price, for_sale, 
          owner_id, collection_id, rarity, attributes, minted_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          `BAYC-${tokenId}`, name, description, imagePath, price.toString(), true, 
          regulator.id, collectionId, rarity, JSON.stringify(attributes), new Date()
        ]
      );
      
      console.log(`Создан NFT ${name} с ID BAYC-${tokenId}, редкость: ${rarity}, цена: $${price}`);
      created++;
    }
    
    await client.query('COMMIT');
    console.log('Транзакция успешно завершена');
    
    return {
      success: true,
      created,
      skipped
    };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Ошибка при импорте NFT:', error);
    return {
      success: false,
      error: error.message
    };
  } finally {
    client.release();
  }
}

/**
 * Удаляет дубликаты NFT
 */
async function removeDuplicateNFTs() {
  const client = await pool.connect();
  try {
    console.log('Начинаем поиск и удаление дубликатов NFT...');
    
    // Начинаем транзакцию для удаления дубликатов
    await client.query('BEGIN');
    
    // Находим дубликаты по token_id
    const { rows: duplicates } = await client.query(`
      WITH duplicates AS (
        SELECT token_id, MIN(id) as keep_id, 
               array_agg(id) as all_ids
        FROM nfts 
        GROUP BY token_id
        HAVING COUNT(*) > 1
      )
      SELECT token_id, keep_id, all_ids FROM duplicates
    `);
    
    console.log(`Найдено ${duplicates.length} групп дубликатов NFT`);
    
    // Счетчик удаленных NFT
    let removed = 0;
    
    // Обрабатываем каждую группу дубликатов
    for (const duplicate of duplicates) {
      const keepId = duplicate.keep_id;
      // Преобразуем строку array_agg в массив JS
      const allIds = duplicate.all_ids.replace('{', '').replace('}', '').split(',').map(id => parseInt(id.trim()));
      
      // Получаем ID NFT, которые нужно удалить (все кроме keepId)
      const removeIds = allIds.filter(id => id !== keepId);
      
      // Удаляем переводы NFT, связанные с дубликатами
      await client.query('DELETE FROM nft_transfers WHERE nft_id = ANY($1)', [removeIds]);
      
      // Удаляем сами дубликаты
      await client.query('DELETE FROM nfts WHERE id = ANY($1)', [removeIds]);
      
      console.log(`Удалены дубликаты для токена ${duplicate.token_id}: оставлен ID ${keepId}, удалены ID ${removeIds.join(', ')}`);
      removed += removeIds.length;
    }
    
    // Делаем то же самое для устаревшей таблицы nft
    try {
      const { rows: legacyDuplicates } = await client.query(`
        WITH duplicates AS (
          SELECT token_id, MIN(id) as keep_id, 
                array_agg(id) as all_ids
          FROM nft 
          GROUP BY token_id
          HAVING COUNT(*) > 1
        )
        SELECT token_id, keep_id, all_ids FROM duplicates
      `);
      
      console.log(`Найдено ${legacyDuplicates.length} групп дубликатов в устаревшей таблице nft`);
      
      // Обрабатываем каждую группу дубликатов в устаревшей таблице
      for (const duplicate of legacyDuplicates) {
        const keepId = duplicate.keep_id;
        // Преобразуем строку array_agg в массив JS
        const allIds = duplicate.all_ids.replace('{', '').replace('}', '').split(',').map(id => parseInt(id.trim()));
        
        // Получаем ID NFT, которые нужно удалить (все кроме keepId)
        const removeIds = allIds.filter(id => id !== keepId);
        
        // Удаляем сами дубликаты
        await client.query('DELETE FROM nft WHERE id = ANY($1)', [removeIds]);
        
        console.log(`Удалены дубликаты в устаревшей таблице для токена ${duplicate.token_id}: оставлен ID ${keepId}, удалены ID ${removeIds.join(', ')}`);
        removed += removeIds.length;
      }
    } catch (err) {
      console.log("Старая таблица nft не существует или иная ошибка:", err.message);
    }
    
    await client.query('COMMIT');
    console.log('Транзакция успешно завершена');
    
    return {
      success: true,
      removed
    };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Ошибка при удалении дубликатов NFT:', error);
    return {
      success: false,
      error: error.message
    };
  } finally {
    client.release();
  }
}

/**
 * Основная функция запуска скрипта
 */
async function main() {
  try {
    console.log('Запуск скрипта очистки и импорта BAYC NFT...');
    
    // Шаг 1: Удаляем все не-BAYC NFT
    console.log('\n===== ШАГ 1: УДАЛЕНИЕ НЕ-BAYC NFT =====');
    const cleanResult = await cleanAllNonBAYCNFT();
    console.log('Результат очистки:', cleanResult);
    
    // Шаг 2: Удаляем дубликаты
    console.log('\n===== ШАГ 2: УДАЛЕНИЕ ДУБЛИКАТОВ =====');
    const dedupeResult = await removeDuplicateNFTs();
    console.log('Результат удаления дубликатов:', dedupeResult);
    
    // Шаг 3: Импортируем обезьян BAYC
    console.log('\n===== ШАГ 3: ИМПОРТ ОБЕЗЬЯН BAYC =====');
    const importResult = await importBoredApesToMarketplace();
    console.log('Результат импорта:', importResult);
    
    console.log('\nСкрипт успешно завершен');
  } catch (error) {
    console.error('Критическая ошибка при выполнении скрипта:', error);
  } finally {
    // Закрываем пул соединений
    pool.end();
  }
}

// Запускаем скрипт
main();
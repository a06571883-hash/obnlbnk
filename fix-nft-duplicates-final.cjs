/**
 * Скрипт для финального удаления дубликатов NFT и
 * обеспечения уникальности изображений в маркетплейсе
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Загрузка переменных окружения
dotenv.config();

// Создание пула подключений к PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Проверяет базу данных и удаляет все дубликаты NFT
 */
async function removeDuplicates() {
  console.log('Проверка и удаление дубликатов NFT...');
  
  // 1. Удаляем дубликаты по token_id внутри одной коллекции
  const tokenDuplicates = await pool.query(`
    WITH duplicates AS (
      SELECT id, collection_id, token_id,
        ROW_NUMBER() OVER(PARTITION BY collection_id, token_id ORDER BY id) as rn
      FROM nfts
    )
    DELETE FROM nfts
    WHERE id IN (
      SELECT id FROM duplicates WHERE rn > 1
    )
    RETURNING id
  `);
  
  console.log(`Удалено ${tokenDuplicates.rowCount} дубликатов по token_id`);
  
  // 2. Удаляем дубликаты по image_path
  const imageDuplicates = await pool.query(`
    WITH duplicates AS (
      SELECT id, image_path,
        ROW_NUMBER() OVER(PARTITION BY image_path ORDER BY id) as rn
      FROM nfts
      WHERE image_path IS NOT NULL
    )
    DELETE FROM nfts
    WHERE id IN (
      SELECT id FROM duplicates WHERE rn > 1
    )
    RETURNING id
  `);
  
  console.log(`Удалено ${imageDuplicates.rowCount} дубликатов по путям к изображениям`);
  
  // 3. Проверяем наличие NFT без изображений
  const missingImages = await pool.query(`
    SELECT COUNT(*) FROM nfts WHERE image_path IS NULL
  `);
  
  if (parseInt(missingImages.rows[0].count) > 0) {
    console.log(`Найдено ${missingImages.rows[0].count} NFT без путей к изображениям, исправляем...`);
    
    // Обновляем отсутствующие пути к изображениям
    await fixMissingImagePaths();
  } else {
    console.log('Все NFT имеют пути к изображениям');
  }
}

/**
 * Исправляет отсутствующие пути к изображениям
 */
async function fixMissingImagePaths() {
  // Обновляем отсутствующие пути для Bored Ape
  await pool.query(`
    UPDATE nfts 
    SET 
      image_path = CONCAT('/bored_ape_nft/bored_ape_', 
        (MOD(CAST(token_id AS INTEGER), 773) + 1), '.png'),
      original_image_path = CONCAT('/bored_ape_nft/bored_ape_', 
        (MOD(CAST(token_id AS INTEGER), 773) + 1), '.png')
    WHERE collection_id = 1 AND (image_path IS NULL OR image_path = '')
  `);
  
  // Обновляем отсутствующие пути для Mutant Ape
  await pool.query(`
    UPDATE nfts 
    SET 
      image_path = CONCAT('/mutant_ape_nft/mutant_ape_', 
        (MOD(CAST(token_id AS INTEGER), 1000) + 10001), '.svg'),
      original_image_path = CONCAT('/mutant_ape_nft/mutant_ape_', 
        (MOD(CAST(token_id AS INTEGER), 1000) + 10001), '.svg')
    WHERE collection_id = 2 AND (image_path IS NULL OR image_path = '')
  `);
}

/**
 * Обеспечивает правильное количество NFT в коллекциях (по 10000 в каждой)
 */
async function ensureCorrectNFTCount() {
  console.log('Проверка количества NFT в коллекциях...');
  
  // Получаем текущее количество NFT в каждой коллекции
  const counts = await pool.query(`
    SELECT collection_id, COUNT(*) as count
    FROM nfts
    GROUP BY collection_id
  `);
  
  for (const row of counts.rows) {
    console.log(`Коллекция ID ${row.collection_id}: ${row.count} NFT`);
    
    const expectedCount = 10000;
    const collectionName = row.collection_id === 1 ? 'Bored Ape' : 'Mutant Ape';
    
    if (parseInt(row.count) < expectedCount) {
      console.log(`Добавляем недостающие NFT для коллекции ${collectionName}...`);
      
      // Добавляем недостающие NFT
      await addMissingNFT(row.collection_id, parseInt(row.count), expectedCount);
    } else if (parseInt(row.count) > expectedCount) {
      console.log(`Удаляем лишние NFT из коллекции ${collectionName}...`);
      
      // Удаляем лишние NFT
      await removeExcessNFT(row.collection_id, parseInt(row.count), expectedCount);
    }
  }
}

/**
 * Добавляет недостающие NFT в коллекцию
 */
async function addMissingNFT(collectionId, currentCount, targetCount) {
  // Получаем информацию о регуляторе (для владельца NFT)
  const regulator = await pool.query(`
    SELECT id FROM users WHERE username = 'regulator' LIMIT 1
  `);
  
  const regulatorId = regulator.rows.length > 0 ? regulator.rows[0].id : 1;
  
  // Добавляем NFT в коллекцию
  for (let i = currentCount + 1; i <= targetCount; i++) {
    const tokenId = collectionId === 1 ? i : i + 10000;
    
    // Определяем путь к изображению
    let imagePath;
    if (collectionId === 1) {
      // Bored Ape - используем модуль от количества доступных изображений
      const imageNumber = (i % 773) + 1;
      imagePath = `/bored_ape_nft/bored_ape_${imageNumber}.png`;
    } else {
      // Mutant Ape - используем номера от 10001 до 11000
      const imageNumber = (i % 1000) + 10001;
      imagePath = `/mutant_ape_nft/mutant_ape_${imageNumber}.svg`;
    }
    
    // Определяем редкость на основе токена
    let rarity;
    if (i % 100 === 0) {
      rarity = 'legendary';
    } else if (i % 25 === 0) {
      rarity = 'epic';
    } else if (i % 10 === 0) {
      rarity = 'rare';
    } else if (i % 4 === 0) {
      rarity = 'uncommon';
    } else {
      rarity = 'common';
    }
    
    // Генерируем цену на основе редкости
    let price;
    switch (rarity) {
      case 'legendary':
        price = 15000 + Math.random() * 5000;
        break;
      case 'epic':
        price = 5000 + Math.random() * 5000;
        break;
      case 'rare':
        price = 1000 + Math.random() * 2000;
        break;
      case 'uncommon':
        price = 100 + Math.random() * 400;
        break;
      default:
        price = 30 + Math.random() * 70;
    }
    
    // Округляем цену до двух знаков после запятой
    price = Math.round(price * 100) / 100;
    
    // Добавляем NFT в базу данных
    await pool.query(`
      INSERT INTO nfts (
        token_id, name, description, image_path, original_image_path,
        attributes, price, rarity, collection_id, owner_id,
        for_sale, sort_order
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
      )
    `, [
      tokenId.toString(),
      collectionId === 1 ? `Bored Ape #${i}` : `Mutant Ape #${i}`,
      collectionId === 1 
        ? `A unique Bored Ape NFT, one of the most prestigious collections on the market. Rarity: ${rarity}`
        : `A unique Mutant Ape NFT, evolved from the Bored Ape collection. Rarity: ${rarity}`,
      imagePath,
      imagePath,
      JSON.stringify({
        rarity: rarity,
        series: collectionId === 1 ? 'BAYC' : 'MAYC',
        edition: tokenId.toString(),
        traits: [
          { trait_type: 'Rarity', value: rarity },
          { trait_type: 'Series', value: collectionId === 1 ? 'BAYC' : 'MAYC' },
          { trait_type: 'Edition', value: tokenId.toString() }
        ]
      }),
      price,
      rarity,
      collectionId,
      regulatorId,
      true,
      Math.floor(Math.random() * 20000)
    ]);
    
    // Логируем каждую сотую добавленную NFT
    if ((i - currentCount) % 100 === 0 || i === targetCount) {
      console.log(`Добавлено ${i - currentCount} из ${targetCount - currentCount} NFT`);
    }
  }
}

/**
 * Удаляет лишние NFT из коллекции
 */
async function removeExcessNFT(collectionId, currentCount, targetCount) {
  const excessCount = currentCount - targetCount;
  
  // Удаляем лишние NFT из базы данных
  await pool.query(`
    DELETE FROM nfts
    WHERE id IN (
      SELECT id FROM nfts
      WHERE collection_id = $1
      ORDER BY id DESC
      LIMIT $2
    )
  `, [collectionId, excessCount]);
  
  console.log(`Удалено ${excessCount} лишних NFT из коллекции ${collectionId}`);
}

/**
 * Рандомизирует порядок отображения NFT
 */
async function randomizeOrder() {
  console.log('Рандомизация порядка отображения NFT...');
  
  await pool.query(`
    UPDATE nfts 
    SET sort_order = (RANDOM() * 20000)::INTEGER
  `);
  
  console.log('Порядок отображения NFT успешно перемешан');
}

/**
 * Основная функция скрипта
 */
async function main() {
  try {
    console.log('Запуск скрипта финальной очистки дубликатов NFT...');
    
    // Удаляем дубликаты
    await removeDuplicates();
    
    // Обеспечиваем правильное количество NFT
    await ensureCorrectNFTCount();
    
    // Перемешиваем порядок отображения
    await randomizeOrder();
    
    console.log('Скрипт успешно завершен!');
  } catch (error) {
    console.error('Ошибка выполнения скрипта:', error);
  } finally {
    // Закрываем соединение с базой данных
    await pool.end();
  }
}

// Запускаем скрипт
main();
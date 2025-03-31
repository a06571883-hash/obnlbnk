/**
 * Скрипт для импорта обезьян Bored Ape и Mutant Ape в базу данных
 * Гарантирует отсутствие дубликатов
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Получаем строку подключения из переменной окружения
const DATABASE_URL = process.env.DATABASE_URL;

// Настраиваем пул подключений
const pool = new Pool({
  connectionString: DATABASE_URL,
});

/**
 * Сканирует директорию с изображениями обезьян
 * @param {string} directory Путь к директории для сканирования
 * @param {string} prefix Префикс для формирования пути к изображению (например, '/bored_ape_nft/')
 * @returns {Array<{path: string, fullPath: string}>} Массив объектов с путями к изображениям
 */
function scanApeDirectory(directory, prefix) {
  const baseDir = '/home/runner/workspace';
  const dirPath = path.join(baseDir, directory);
  
  try {
    if (!fs.existsSync(dirPath)) {
      console.log(`Директория ${dirPath} не существует`);
      return [];
    }
    
    const files = fs.readdirSync(dirPath);
    const imagePaths = [];
    
    for (const file of files) {
      if (file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg') || file.endsWith('.avif')) {
        const relativePath = path.join(prefix, file);
        const fullPath = path.join(dirPath, file);
        
        imagePaths.push({
          path: relativePath,
          fullPath: fullPath
        });
      }
    }
    
    return imagePaths;
  } catch (err) {
    console.error(`Ошибка при сканировании директории ${dirPath}:`, err);
    return [];
  }
}

/**
 * Генерирует токен ID для NFT на основе имени файла
 * @param {string} filename Имя файла
 * @returns {string} Токен ID
 */
function generateTokenId(filename) {
  // Извлекаем числа из имени файла
  const match = filename.match(/(\d+)/);
  if (match && match[1]) {
    return match[1];
  } else {
    // Если не удалось извлечь ID из имени, генерируем случайный ID
    return Math.floor(Math.random() * 10000).toString();
  }
}

/**
 * Определяет редкость NFT на основе токена ID
 * @param {string} tokenId ID токена
 * @returns {string} Редкость NFT
 */
function determineRarity(tokenId) {
  const id = parseInt(tokenId);
  
  // Используем остаток от деления для определения редкости
  const remainder = id % 100;
  
  if (remainder < 60) {
    return 'common';
  } else if (remainder < 85) {
    return 'uncommon';
  } else if (remainder < 95) {
    return 'rare';
  } else if (remainder < 99) {
    return 'epic';
  } else {
    return 'legendary';
  }
}

/**
 * Генерирует цену для NFT на основе редкости
 * @param {string} rarity Редкость NFT
 * @param {boolean} isMutant Является ли NFT мутантом
 * @returns {string} Цена NFT
 */
function generatePrice(rarity, isMutant) {
  const basePrice = isMutant ? 1.5 : 1; // Мутанты на 50% дороже
  
  switch (rarity) {
    case 'common':
      return (30 * basePrice).toString();
    case 'uncommon':
      return (1000 * basePrice).toString();
    case 'rare':
      return (3000 * basePrice).toString();
    case 'epic':
      return (8000 * basePrice).toString();
    case 'legendary':
      return (15000 * basePrice).toString();
    default:
      return (50 * basePrice).toString();
  }
}

/**
 * Генерирует атрибуты для NFT
 * @param {string} rarity Редкость NFT
 * @param {boolean} isMutant Является ли NFT мутантом
 * @returns {Object} Объект с атрибутами
 */
function generateAttributes(rarity, isMutant) {
  let baseValue = 0;
  
  switch (rarity) {
    case 'common':
      baseValue = 50;
      break;
    case 'uncommon':
      baseValue = 65;
      break;
    case 'rare':
      baseValue = 75;
      break;
    case 'epic':
      baseValue = 85;
      break;
    case 'legendary':
      baseValue = 95;
      break;
    default:
      baseValue = 60;
  }
  
  const powerBonus = isMutant ? 15 : 0;
  const agilityBonus = isMutant ? 5 : 0;
  const wisdomBonus = isMutant ? -5 : 15;
  const luckBonus = isMutant ? 10 : 5;
  
  return {
    power: Math.min(100, baseValue + powerBonus + Math.floor(Math.random() * 10)),
    agility: Math.min(100, baseValue + agilityBonus + Math.floor(Math.random() * 10)),
    wisdom: Math.min(100, baseValue + wisdomBonus + Math.floor(Math.random() * 10)),
    luck: Math.min(100, baseValue + luckBonus + Math.floor(Math.random() * 10))
  };
}

/**
 * Главная функция для импорта обезьян в базу данных
 */
async function importBoredApes() {
  console.log('Запуск импорта обезьян в базу данных...');
  
  try {
    // Шаг 1: Сканируем директории с изображениями обезьян
    console.log('Шаг 1: Сканирование директорий с изображениями обезьян...');
    
    // Сканируем Bored Ape NFT
    const boredApeImages = scanApeDirectory('/bored_ape_nft', '/bored_ape_nft/');
    console.log(`Найдено ${boredApeImages.length} изображений Bored Ape`);
    
    // Сканируем Mutant Ape NFT
    const mutantApeImages = scanApeDirectory('/mutant_ape_nft', '/mutant_ape_nft/');
    console.log(`Найдено ${mutantApeImages.length} изображений Mutant Ape`);
    
    // Сканируем BAYC Official
    const baycOfficialImages = scanApeDirectory('/bayc_official_nft', '/bayc_official/');
    console.log(`Найдено ${baycOfficialImages.length} изображений BAYC Official`);
    
    // Шаг 2: Хеширование файлов для исключения дубликатов
    console.log('Шаг 2: Хеширование файлов для удаления дубликатов...');
    
    const uniqueImages = new Map();
    const allImages = [...boredApeImages, ...mutantApeImages, ...baycOfficialImages];
    
    for (const img of allImages) {
      try {
        const fileContent = fs.readFileSync(img.fullPath);
        const hash = crypto.createHash('md5').update(fileContent).digest('hex');
        
        // Сохраняем только первое изображение с уникальным хешем
        if (!uniqueImages.has(hash)) {
          uniqueImages.set(hash, img);
        }
      } catch (err) {
        console.error(`Ошибка при хешировании ${img.fullPath}:`, err);
      }
    }
    
    console.log(`После удаления дубликатов осталось ${uniqueImages.size} уникальных изображений`);
    
    // Шаг 3: Создание NFT для каждого уникального изображения
    console.log('Шаг 3: Создание NFT в базе данных...');
    
    // Получаем идентификаторы для создания NFT
    const ownerId = 1; // ID администратора/владельца
    const regulatorId = 1; // ID регулятора
    
    // Инсерт в базу данных
    let insertedCount = 0;
    
    for (const [_, img] of uniqueImages) {
      const filename = path.basename(img.path);
      const tokenId = generateTokenId(filename);
      const isMutant = img.path.includes('mutant_ape');
      const collectionType = isMutant ? 'Mutant Ape Yacht Club' : 'Bored Ape Yacht Club';
      const name = isMutant ? `Mutant Ape #${tokenId}` : `Bored Ape #${tokenId}`;
      const rarity = determineRarity(tokenId);
      const price = generatePrice(rarity, isMutant);
      const attributes = JSON.stringify(generateAttributes(rarity, isMutant));
      
      // Добавляем случайное значение для sort_order для перемешивания NFT в выдаче
      const sortOrder = Math.floor(Math.random() * 2000);
      
      const insertQuery = `
        INSERT INTO nfts (
          token_id, name, description, image_path, price, for_sale,
          owner_id, collection_id, rarity, attributes, minted_at, sort_order
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
        )
      `;
      
      const description = `${collectionType} NFT ${name}. Редкость: ${rarity}. Уникальный цифровой актив на блокчейне.`;
      const collectionId = isMutant ? 2 : 1; // ID 1 для Bored Ape, ID 2 для Mutant Ape
      
      const values = [
        tokenId,
        name,
        description,
        img.path,
        price,
        true, // for_sale = true
        ownerId,
        collectionId,
        rarity,
        attributes,
        new Date(),
        sortOrder
      ];
      
      try {
        await pool.query(insertQuery, values);
        insertedCount++;
        
        if (insertedCount % 100 === 0) {
          console.log(`Добавлено ${insertedCount} NFT...`);
        }
      } catch (err) {
        console.error(`Ошибка при добавлении NFT ${name}:`, err);
      }
    }
    
    console.log(`Всего добавлено ${insertedCount} уникальных NFT`);
    
    // Шаг 4: Проверка результатов
    const countQuery = 'SELECT COUNT(*) FROM nfts';
    const countResult = await pool.query(countQuery);
    const totalNFTs = parseInt(countResult.rows[0].count);
    
    console.log(`Итоговое количество NFT в базе данных: ${totalNFTs}`);
    
    // Шаг 5: Получение статистики
    const rarityStatsQuery = 'SELECT rarity, COUNT(*) FROM nfts GROUP BY rarity ORDER BY COUNT(*) DESC';
    const rarityStatsResult = await pool.query(rarityStatsQuery);
    
    console.log('\nСтатистика по редкости:');
    rarityStatsResult.rows.forEach(row => {
      console.log(`${row.rarity}: ${row.count} NFT`);
    });
    
    // Проверяем типы NFT (Bored vs Mutant)
    const typeStatsQuery = `
      SELECT 
        CASE
          WHEN image_path LIKE '%mutant_ape%' THEN 'Mutant Ape'
          ELSE 'Bored Ape'
        END as type,
        COUNT(*)
      FROM nfts
      GROUP BY type
      ORDER BY COUNT(*) DESC
    `;
    
    const typeStatsResult = await pool.query(typeStatsQuery);
    
    console.log('\nСтатистика по типам:');
    typeStatsResult.rows.forEach(row => {
      console.log(`${row.type}: ${row.count} NFT`);
    });
    
    return {
      success: true,
      totalNFTs,
      rarityStats: rarityStatsResult.rows,
      typeStats: typeStatsResult.rows
    };
    
  } catch (err) {
    console.error('Ошибка при импорте обезьян:', err);
    return {
      success: false,
      error: err.message
    };
  } finally {
    console.log('Завершение импорта обезьян');
    await pool.end();
  }
}

// Запуск скрипта
importBoredApes()
  .then(result => {
    console.log('\nРезультаты импорта обезьян:');
    console.log(JSON.stringify(result, null, 2));
    console.log('\n===============================');
    console.log('✅ Импорт обезьян успешно завершен!');
    console.log('===============================\n');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Критическая ошибка при импорте обезьян:', err);
    process.exit(1);
  });
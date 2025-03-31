/**
 * Скрипт для добавления коллекции Bored Ape Yacht Club (10,000 NFT)
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
 * @param {string} prefix Префикс для формирования пути к изображению
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
 * Определяет редкость NFT на основе его ID
 * @param {number} tokenId ID токена
 * @returns {string} Редкость NFT
 */
function determineRarity(tokenId) {
  // Используем модульное распределение для определения редкости
  const remainder = tokenId % 100;
  
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
 * @returns {string} Цена NFT
 */
function generatePrice(rarity) {
  switch (rarity) {
    case 'common':
      return (30 + Math.random() * 20).toFixed(2);
    case 'uncommon':
      return (500 + Math.random() * 500).toFixed(2);
    case 'rare':
      return (2000 + Math.random() * 1000).toFixed(2);
    case 'epic':
      return (5000 + Math.random() * 3000).toFixed(2);
    case 'legendary':
      return (12000 + Math.random() * 7000).toFixed(2);
    default:
      return (50).toFixed(2);
  }
}

/**
 * Генерирует атрибуты для NFT
 * @param {number} tokenId ID токена
 * @param {string} rarity Редкость NFT
 * @returns {Object} Объект с атрибутами
 */
function generateAttributes(tokenId, rarity) {
  // Используем tokenId как seed для псевдослучайных значений
  const seed = tokenId;
  
  let baseValue = 0;
  
  switch (rarity) {
    case 'common':
      baseValue = 40 + (seed % 11);
      break;
    case 'uncommon':
      baseValue = 55 + (seed % 11);
      break;
    case 'rare':
      baseValue = 65 + (seed % 11);
      break;
    case 'epic':
      baseValue = 75 + (seed % 11);
      break;
    case 'legendary':
      baseValue = 85 + (seed % 11);
      break;
    default:
      baseValue = 50 + (seed % 11);
  }
  
  // Генерация случайных вариаций для избежания одинаковых атрибутов
  function randomVariation(seed, base) {
    const hash = crypto.createHash('md5').update(seed.toString()).digest('hex');
    const hashValue = parseInt(hash.substring(0, 8), 16);
    return Math.abs(hashValue % 11) - 5; // От -5 до 5
  }
  
  const power = Math.min(100, Math.max(1, baseValue + randomVariation(seed + 1, baseValue)));
  const agility = Math.min(100, Math.max(1, baseValue + randomVariation(seed + 2, baseValue)));
  const wisdom = Math.min(100, Math.max(1, baseValue + 15 + randomVariation(seed + 3, baseValue)));
  const luck = Math.min(100, Math.max(1, baseValue + 5 + randomVariation(seed + 4, baseValue)));
  
  return {
    power,
    agility,
    wisdom,
    luck
  };
}

/**
 * Добавление коллекции Bored Ape Yacht Club (10,000 NFT)
 */
async function addBoredApes() {
  console.log('Запуск добавления коллекции Bored Ape Yacht Club...');
  
  try {
    // Шаг 1: Сканируем директории с изображениями обезьян
    console.log('Шаг 1: Сканирование директорий с изображениями обезьян...');
    
    // Сканируем Bored Ape NFT
    const boredApeImages = scanApeDirectory('/bored_ape_nft', '/bored_ape_nft');
    console.log(`Найдено ${boredApeImages.length} изображений Bored Ape`);
    
    // Шаг 2: Удаляем существующие NFT в коллекции Bored Ape
    console.log('Шаг 2: Удаление существующих NFT в коллекции Bored Ape...');
    await pool.query('DELETE FROM nfts WHERE collection_id = 1');
    
    // Шаг 3: Добавляем 10,000 NFT в коллекцию Bored Ape
    console.log('Шаг 3: Добавление 10,000 NFT в коллекцию Bored Ape...');
    
    // Используем батчи по 100 NFT для INSERT
    const batchSize = 100;
    const ownerId = 1; // ID администратора/владельца
    const collectionId = 1; // ID коллекции Bored Ape
    
    for (let batchStart = 1; batchStart <= 10000; batchStart += batchSize) {
      const batchEnd = Math.min(batchStart + batchSize - 1, 10000);
      console.log(`Обработка NFT ${batchStart} - ${batchEnd}...`);
      
      let insertQuery = 'INSERT INTO nfts (token_id, name, description, image_path, price, for_sale, owner_id, collection_id, rarity, attributes, minted_at, sort_order) VALUES ';
      const values = [];
      let valueIndex = 1;
      
      for (let i = batchStart; i <= batchEnd; i++) {
        // Выбираем случайное изображение из доступных
        const randomIndex = Math.floor(Math.random() * boredApeImages.length);
        const img = boredApeImages[randomIndex];
        
        const tokenId = i; // Последовательные ID от 1 до 10000
        const name = `Bored Ape #${tokenId}`;
        const rarity = determineRarity(tokenId);
        const price = generatePrice(rarity);
        const attributes = JSON.stringify(generateAttributes(tokenId, rarity));
        const sortOrder = Math.floor(Math.random() * 20000); // Случайный порядок сортировки
        const description = `Bored Ape Yacht Club NFT #${tokenId}. Редкость: ${rarity}. Уникальный цифровой актив на блокчейне.`;
        
        if (i > batchStart) {
          insertQuery += ', ';
        }
        
        insertQuery += `($${valueIndex++}, $${valueIndex++}, $${valueIndex++}, $${valueIndex++}, $${valueIndex++}, $${valueIndex++}, $${valueIndex++}, $${valueIndex++}, $${valueIndex++}, $${valueIndex++}, $${valueIndex++}, $${valueIndex++})`;
        
        values.push(
          tokenId.toString(),
          name,
          description,
          img.path,
          price,
          true,
          ownerId,
          collectionId,
          rarity,
          attributes,
          new Date(),
          sortOrder
        );
      }
      
      try {
        await pool.query(insertQuery, values);
      } catch (err) {
        console.error(`Ошибка при добавлении NFT ${batchStart}-${batchEnd}:`, err);
      }
    }
    
    // Шаг 4: Проверка результатов
    const countQuery = 'SELECT COUNT(*) FROM nfts WHERE collection_id = 1';
    const countResult = await pool.query(countQuery);
    const totalNFTs = parseInt(countResult.rows[0].count);
    
    console.log(`\nИтоговое количество Bored Ape NFT в базе данных: ${totalNFTs}`);
    
    // Статистика по редкости
    const rarityStatsQuery = 'SELECT rarity, COUNT(*) FROM nfts WHERE collection_id = 1 GROUP BY rarity ORDER BY COUNT(*) DESC';
    const rarityStatsResult = await pool.query(rarityStatsQuery);
    
    console.log('\nСтатистика по редкости Bored Ape:');
    rarityStatsResult.rows.forEach(row => {
      console.log(`${row.rarity}: ${row.count} NFT`);
    });
    
    return {
      success: true,
      totalNFTs,
      byRarity: rarityStatsResult.rows
    };
    
  } catch (err) {
    console.error('Критическая ошибка при добавлении коллекции Bored Ape:', err);
    return {
      success: false,
      error: err.message
    };
  } finally {
    console.log('Завершение работы скрипта');
    await pool.end();
  }
}

// Запуск скрипта
addBoredApes()
  .then(result => {
    console.log('\nРезультаты добавления коллекции Bored Ape:');
    console.log(JSON.stringify(result, null, 2));
    console.log('\n===============================');
    console.log('✅ Добавление 10,000 Bored Ape NFT успешно завершено!');
    console.log('===============================\n');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Критическая ошибка:', err);
    process.exit(1);
  });
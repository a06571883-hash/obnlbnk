/**
 * Скрипт для добавления полных коллекций NFT (20,000 шт)
 * Распределяет 10,000 NFT на коллекцию Bored Ape и 10,000 NFT на коллекцию Mutant Ape
 * Использует существующие изображения с повторами, но с уникальными token_id
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
 * @param {boolean} isMutant Является ли NFT мутантом
 * @returns {string} Цена NFT
 */
function generatePrice(rarity, isMutant) {
  const basePrice = isMutant ? 1.5 : 1; // Мутанты на 50% дороже
  
  switch (rarity) {
    case 'common':
      return (30 * basePrice + Math.random() * 20).toFixed(2);
    case 'uncommon':
      return (500 * basePrice + Math.random() * 500).toFixed(2);
    case 'rare':
      return (2000 * basePrice + Math.random() * 1000).toFixed(2);
    case 'epic':
      return (5000 * basePrice + Math.random() * 3000).toFixed(2);
    case 'legendary':
      return (12000 * basePrice + Math.random() * 7000).toFixed(2);
    default:
      return (50 * basePrice).toFixed(2);
  }
}

/**
 * Генерирует атрибуты для NFT
 * @param {number} tokenId ID токена
 * @param {string} rarity Редкость NFT
 * @param {boolean} isMutant Является ли NFT мутантом
 * @returns {Object} Объект с атрибутами
 */
function generateAttributes(tokenId, rarity, isMutant) {
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
  
  const powerBonus = isMutant ? 15 : 0;
  const agilityBonus = isMutant ? 5 : 0;
  const wisdomBonus = isMutant ? -5 : 15;
  const luckBonus = isMutant ? 10 : 5;
  
  // Генерация случайных вариаций для избежания одинаковых атрибутов
  function randomVariation(seed, base) {
    const hash = crypto.createHash('md5').update(seed.toString()).digest('hex');
    const hashValue = parseInt(hash.substring(0, 8), 16);
    return Math.abs(hashValue % 11) - 5; // От -5 до 5
  }
  
  const power = Math.min(100, Math.max(1, baseValue + powerBonus + randomVariation(seed + 1, baseValue)));
  const agility = Math.min(100, Math.max(1, baseValue + agilityBonus + randomVariation(seed + 2, baseValue)));
  const wisdom = Math.min(100, Math.max(1, baseValue + wisdomBonus + randomVariation(seed + 3, baseValue)));
  const luck = Math.min(100, Math.max(1, baseValue + luckBonus + randomVariation(seed + 4, baseValue)));
  
  return {
    power,
    agility,
    wisdom,
    luck
  };
}

/**
 * Очищает базу данных от существующих NFT
 */
async function clearExistingNFTs() {
  try {
    console.log('Очистка существующих NFT...');
    await pool.query('DELETE FROM nfts');
    console.log('База данных успешно очищена');
  } catch (err) {
    console.error('Ошибка при очистке базы данных:', err);
    throw err;
  }
}

/**
 * Добавление больших коллекций NFT в базу данных
 */
async function addFullCollections() {
  console.log('Запуск добавления полных коллекций NFT...');
  
  try {
    // Шаг 1: Сканируем директории с изображениями обезьян
    console.log('Шаг 1: Сканирование директорий с изображениями обезьян...');
    
    // Сканируем Bored Ape NFT
    const boredApeImages = scanApeDirectory('/bored_ape_nft', '/bored_ape_nft');
    console.log(`Найдено ${boredApeImages.length} изображений Bored Ape`);
    
    // Сканируем Mutant Ape NFT
    const mutantApeImages = scanApeDirectory('/mutant_ape_nft', '/mutant_ape_nft');
    console.log(`Найдено ${mutantApeImages.length} изображений Mutant Ape`);
    
    // Если мутантов мало или нет, используем Bored Ape как запасной вариант
    if (mutantApeImages.length < 100) {
      console.log('Недостаточно изображений Mutant Ape, будем использовать Bored Ape с модификацией');
    }
    
    // Шаг 2: Создание NFT для коллекции Bored Ape
    console.log('Шаг 2: Создание 10,000 NFT для коллекции Bored Ape...');
    
    // Получаем идентификаторы для создания NFT
    const ownerId = 1; // ID администратора/владельца по умолчанию
    const boredApeCollectionId = 1;
    
    // Массив для хранения запросов
    const boredApePromises = [];
    
    // Создаем 10,000 Bored Ape NFT
    for (let i = 1; i <= 10000; i++) {
      // Выбираем случайное изображение из доступных
      const randomIndex = Math.floor(Math.random() * boredApeImages.length);
      const img = boredApeImages[randomIndex];
      
      const tokenId = i; // Последовательные ID от 1 до 10000
      const name = `Bored Ape #${tokenId}`;
      const rarity = determineRarity(tokenId);
      const price = generatePrice(rarity, false);
      const attributes = JSON.stringify(generateAttributes(tokenId, rarity, false));
      const sortOrder = Math.floor(Math.random() * 20000); // Случайный порядок сортировки
      
      const insertQuery = `
        INSERT INTO nfts (
          token_id, name, description, image_path, price, for_sale,
          owner_id, collection_id, rarity, attributes, minted_at, sort_order
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
        )
      `;
      
      const description = `Bored Ape Yacht Club NFT #${tokenId}. Редкость: ${rarity}. Уникальный цифровой актив на блокчейне.`;
      
      const values = [
        tokenId.toString(),
        name,
        description,
        img.path,
        price,
        true, // for_sale = true
        ownerId,
        boredApeCollectionId,
        rarity,
        attributes,
        new Date(),
        sortOrder
      ];
      
      // Добавляем запрос в массив промисов
      boredApePromises.push(pool.query(insertQuery, values));
      
      // Логируем прогресс каждые 1000 NFT
      if (i % 1000 === 0) {
        console.log(`Подготовлено ${i} Bored Ape NFT...`);
      }
    }
    
    // Шаг 3: Создание NFT для коллекции Mutant Ape
    console.log('Шаг 3: Создание 10,000 NFT для коллекции Mutant Ape...');
    
    const mutantApeCollectionId = 2;
    const mutantApePromises = [];
    
    // Создаем 10,000 Mutant Ape NFT
    for (let i = 1; i <= 10000; i++) {
      // Выбираем случайное изображение из доступных Mutant Ape или Bored Ape, если мутантов недостаточно
      const imageArray = mutantApeImages.length >= 100 ? mutantApeImages : boredApeImages;
      const randomIndex = Math.floor(Math.random() * imageArray.length);
      const img = imageArray[randomIndex];
      
      const tokenId = i + 10000; // ID от 10001 до 20000
      const name = `Mutant Ape #${i}`; // ID мутантов начинаются с 1, но token_id с 10001
      const rarity = determineRarity(tokenId);
      const price = generatePrice(rarity, true);
      const attributes = JSON.stringify(generateAttributes(tokenId, rarity, true));
      const sortOrder = Math.floor(Math.random() * 20000); // Случайный порядок сортировки
      
      const insertQuery = `
        INSERT INTO nfts (
          token_id, name, description, image_path, price, for_sale,
          owner_id, collection_id, rarity, attributes, minted_at, sort_order
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
        )
      `;
      
      const description = `Mutant Ape Yacht Club NFT #${i}. Редкость: ${rarity}. Уникальный цифровой актив на блокчейне.`;
      
      const values = [
        tokenId.toString(),
        name,
        description,
        img.path,
        price,
        true, // for_sale = true
        ownerId,
        mutantApeCollectionId,
        rarity,
        attributes,
        new Date(),
        sortOrder
      ];
      
      // Добавляем запрос в массив промисов
      mutantApePromises.push(pool.query(insertQuery, values));
      
      // Логируем прогресс каждые 1000 NFT
      if (i % 1000 === 0) {
        console.log(`Подготовлено ${i} Mutant Ape NFT...`);
      }
    }
    
    // Шаг 4: Выполнение всех запросов
    console.log('Шаг 4: Добавление всех NFT в базу данных...');
    
    // Сначала чистим базу
    await clearExistingNFTs();
    
    // Выполняем все запросы для Bored Ape
    console.log('Добавление Bored Ape NFT в базу данных...');
    let completedBoredApes = 0;
    
    for (let i = 0; i < boredApePromises.length; i++) {
      try {
        await boredApePromises[i];
        completedBoredApes++;
        
        if (completedBoredApes % 1000 === 0) {
          console.log(`Добавлено ${completedBoredApes} Bored Ape NFT в базу данных...`);
        }
      } catch (err) {
        console.error(`Ошибка при добавлении Bored Ape NFT #${i + 1}:`, err);
      }
    }
    
    // Выполняем все запросы для Mutant Ape
    console.log('Добавление Mutant Ape NFT в базу данных...');
    let completedMutantApes = 0;
    
    for (let i = 0; i < mutantApePromises.length; i++) {
      try {
        await mutantApePromises[i];
        completedMutantApes++;
        
        if (completedMutantApes % 1000 === 0) {
          console.log(`Добавлено ${completedMutantApes} Mutant Ape NFT в базу данных...`);
        }
      } catch (err) {
        console.error(`Ошибка при добавлении Mutant Ape NFT #${i + 1}:`, err);
      }
    }
    
    // Шаг 5: Проверка результатов
    const countQuery = 'SELECT COUNT(*) FROM nfts';
    const countResult = await pool.query(countQuery);
    const totalNFTs = parseInt(countResult.rows[0].count);
    
    console.log(`\nИтоговое количество NFT в базе данных: ${totalNFTs}`);
    
    // Проверка количества по коллекциям
    const collectionCountsQuery = 'SELECT collection_id, COUNT(*) FROM nfts GROUP BY collection_id';
    const collectionCounts = await pool.query(collectionCountsQuery);
    
    console.log('\nРаспределение по коллекциям:');
    for (const row of collectionCounts.rows) {
      const collectionName = row.collection_id === 1 ? 'Bored Ape Yacht Club' : 'Mutant Ape Yacht Club';
      console.log(`${collectionName} (ID: ${row.collection_id}): ${row.count} NFT`);
    }
    
    // Статистика по редкости
    const rarityStatsQuery = 'SELECT rarity, COUNT(*) FROM nfts GROUP BY rarity ORDER BY COUNT(*) DESC';
    const rarityStatsResult = await pool.query(rarityStatsQuery);
    
    console.log('\nСтатистика по редкости:');
    rarityStatsResult.rows.forEach(row => {
      console.log(`${row.rarity}: ${row.count} NFT`);
    });
    
    return {
      success: true,
      totalNFTs,
      byCollection: collectionCounts.rows,
      byRarity: rarityStatsResult.rows
    };
    
  } catch (err) {
    console.error('Критическая ошибка при добавлении коллекций:', err);
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
addFullCollections()
  .then(result => {
    console.log('\nРезультаты добавления коллекций:');
    console.log(JSON.stringify(result, null, 2));
    console.log('\n===============================');
    console.log('✅ Добавление 20,000 NFT успешно завершено!');
    console.log('===============================\n');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Критическая ошибка:', err);
    process.exit(1);
  });
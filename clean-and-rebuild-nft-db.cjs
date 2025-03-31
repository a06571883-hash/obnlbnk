/**
 * Скрипт для полного очищения базы данных NFT и создания только правильных обезьян
 * ВНИМАНИЕ: Этот скрипт полностью удаляет все NFT и создает только качественные NFT без дубликатов
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
 * Генерирует случайные атрибуты для NFT
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
 * Главная функция для очистки и перестроения базы данных NFT
 */
async function cleanAndRebuildNFTDatabase() {
  console.log('Запуск полной очистки и перестроения базы данных NFT...');
  
  try {
    // Шаг 1: Очистка связанных таблиц и NFT
    console.log('Шаг 1: Очистка связанных таблиц и NFT...');
    
    // Сначала удаляем записи из таблицы nft_transfers, которая ссылается на nfts
    console.log('Удаление записей из таблицы nft_transfers...');
    const deleteTransfersQuery = 'DELETE FROM nft_transfers';
    await pool.query(deleteTransfersQuery);
    
    // Теперь удаляем все существующие NFT
    console.log('Удаление всех записей из таблицы nfts...');
    const deleteQuery = 'DELETE FROM nfts';
    await pool.query(deleteQuery);
    
    console.log('Все NFT удалены из базы данных');
    
    // Шаг 2: Сканируем директории с изображениями обезьян
    console.log('Шаг 2: Сканирование директорий с изображениями обезьян...');
    
    // Сканируем Bored Ape NFT
    const boredApeImages = scanApeDirectory('/bored_ape_nft', '/bored_ape_nft/');
    console.log(`Найдено ${boredApeImages.length} изображений Bored Ape`);
    
    // Сканируем Mutant Ape NFT
    const mutantApeImages = scanApeDirectory('/mutant_ape_nft', '/mutant_ape_nft/');
    console.log(`Найдено ${mutantApeImages.length} изображений Mutant Ape`);
    
    // Сканируем BAYC Official
    const baycOfficialImages = scanApeDirectory('/bayc_official_nft', '/bayc_official/');
    console.log(`Найдено ${baycOfficialImages.length} изображений BAYC Official`);
    
    // Шаг 3: Хеширование файлов для исключения дубликатов
    console.log('Шаг 3: Хеширование файлов для удаления дубликатов...');
    
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
    
    // Шаг 4: Создание NFT для каждого уникального изображения
    console.log('Шаг 4: Создание NFT в базе данных...');
    
    // Получаем идентификаторы для создания NFT
    const ownerId = 1; // ID администратора/владельца
    const regulatorId = 1; // ID регулятора
    
    // Инсерт в базу данных
    let insertedCount = 0;
    let id = 1; // Начальный ID для NFT
    
    for (const [_, img] of uniqueImages) {
      const filename = path.basename(img.path);
      const tokenId = generateTokenId(filename);
      const isMutant = img.path.includes('mutant_ape');
      const collectionType = isMutant ? 'Mutant Ape Yacht Club' : 'Bored Ape Yacht Club';
      const name = isMutant ? `Mutant Ape #${tokenId}` : `Bored Ape #${tokenId}`;
      const rarity = determineRarity(tokenId);
      const price = generatePrice(rarity, isMutant);
      const attributes = JSON.stringify(generateAttributes(rarity, isMutant));
      
      const insertQuery = `
        INSERT INTO nfts (
          id, token_id, name, description, image_path, price, for_sale,
          owner_id, creator_id, regulator_id, rarity, attributes, created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
        )
      `;
      
      const description = `${collectionType} NFT ${name}. Редкость: ${rarity}. Уникальный цифровой актив на блокчейне.`;
      
      const values = [
        id,
        tokenId,
        name,
        description,
        img.path,
        price,
        true, // for_sale = true
        ownerId,
        ownerId, // creatorId = ownerId
        regulatorId,
        rarity,
        attributes,
        new Date()
      ];
      
      try {
        await pool.query(insertQuery, values);
        insertedCount++;
        id++;
        
        if (insertedCount % 100 === 0) {
          console.log(`Добавлено ${insertedCount} NFT...`);
        }
      } catch (err) {
        console.error(`Ошибка при добавлении NFT ${name}:`, err);
      }
    }
    
    console.log(`Всего добавлено ${insertedCount} уникальных NFT`);
    
    // Шаг 5: Проверка результатов
    const countQuery = 'SELECT COUNT(*) FROM nfts';
    const countResult = await pool.query(countQuery);
    const totalNFTs = parseInt(countResult.rows[0].count);
    
    console.log(`Итоговое количество NFT в базе данных: ${totalNFTs}`);
    
    // Шаг 6: Получение статистики
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
    console.error('Ошибка при очистке и перестроении базы данных NFT:', err);
    return {
      success: false,
      error: err.message
    };
  } finally {
    console.log('Завершение очистки и перестроения базы данных NFT');
    await pool.end();
  }
}

// Запуск скрипта
cleanAndRebuildNFTDatabase()
  .then(result => {
    console.log('\nРезультаты очистки и перестроения базы данных NFT:');
    console.log(JSON.stringify(result, null, 2));
    console.log('\n===============================');
    console.log('✅ Очистка и перестроение базы данных NFT успешно завершены!');
    console.log('===============================\n');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Критическая ошибка при очистке и перестроении базы данных NFT:', err);
    process.exit(1);
  });
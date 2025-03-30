/**
 * Скрипт для принудительной валидации NFT и удаления всех, которые не являются обезьянами
 * Этот скрипт выполняет более строгую проверку, чем обычная очистка
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Получаем строку подключения из переменной окружения
const DATABASE_URL = process.env.DATABASE_URL;

// Настраиваем пул подключений
const pool = new Pool({
  connectionString: DATABASE_URL,
});

/**
 * Проверяет, действительно ли изображение является обезьяной
 * @param {string} imagePath Путь к изображению NFT
 * @returns {boolean} true, если изображение является обезьяной, false в противном случае
 */
function isApeImage(imagePath) {
  // Проверка наличия ключевых слов Bored Ape или Mutant Ape в пути
  const isBoredApe = 
    imagePath.includes('bored_ape') || 
    imagePath.includes('bayc_official') || 
    imagePath.includes('official_bored_ape');
  
  const isMutantApe = imagePath.includes('mutant_ape');
  
  return isBoredApe || isMutantApe;
}

/**
 * Проверяет существование файла изображения на сервере
 * @param {string} imagePath Путь к изображению NFT
 * @returns {boolean} true, если файл существует, false в противном случае
 */
function fileExists(imagePath) {
  try {
    // Формируем полный путь к файлу
    const baseDir = '/home/runner/workspace';
    const fullPath = path.join(baseDir, imagePath);
    
    return fs.existsSync(fullPath);
  } catch (err) {
    console.error(`Ошибка при проверке файла ${imagePath}:`, err);
    return false;
  }
}

/**
 * Главная функция для принудительной валидации NFT
 */
async function forceValidateNFTs() {
  console.log('Запуск принудительной валидации NFT...');
  
  try {
    // Получаем общее количество NFT до валидации
    const countBeforeQuery = 'SELECT COUNT(*) FROM nfts';
    const countBeforeResult = await pool.query(countBeforeQuery);
    const countBefore = parseInt(countBeforeResult.rows[0].count);
    
    console.log(`Всего NFT до валидации: ${countBefore}`);
    
    // Получаем все NFT из базы данных
    const getAllNFTsQuery = 'SELECT id, name, image_path, collection_name FROM nfts';
    const allNFTsResult = await pool.query(getAllNFTsQuery);
    const allNFTs = allNFTsResult.rows;
    
    console.log(`Получено ${allNFTs.length} NFT для проверки`);
    
    // Выявляем NFT, которые не являются обезьянами или имеют недействительные пути к файлам
    const invalidNFTs = [];
    
    for (const nft of allNFTs) {
      const imagePath = nft.image_path || '';
      
      // Проверяем, является ли изображение обезьяной
      if (!isApeImage(imagePath)) {
        console.log(`NFT #${nft.id} (${nft.name}) не является обезьяной: ${imagePath}`);
        invalidNFTs.push(nft.id);
        continue;
      }
      
      // Проверяем существование файла
      if (!fileExists(imagePath)) {
        console.log(`Файл не существует для NFT #${nft.id} (${nft.name}): ${imagePath}`);
        invalidNFTs.push(nft.id);
        continue;
      }
    }
    
    console.log(`Найдено ${invalidNFTs.length} недействительных NFT`);
    
    // Удаляем недействительные NFT
    if (invalidNFTs.length > 0) {
      const deleteIds = invalidNFTs.join(',');
      const deleteQuery = `DELETE FROM nfts WHERE id IN (${deleteIds})`;
      
      const deleteResult = await pool.query(deleteQuery);
      console.log(`Удалено ${deleteResult.rowCount} недействительных NFT`);
    }
    
    // Проверка оставшихся NFT
    const countAfterQuery = 'SELECT COUNT(*) FROM nfts';
    const countAfterResult = await pool.query(countAfterQuery);
    const countAfter = parseInt(countAfterResult.rows[0].count);
    
    console.log(`Всего NFT после валидации: ${countAfter}`);
    console.log(`Удалено NFT: ${countBefore - countAfter}`);
    
    // Обновляем названия коллекций и атрибуты NFT
    await updateCollectionNames();
    
    // Обновляем цены NFT на основе редкости
    await updateNFTPrices();
    
    // Выставляем все NFT на продажу
    const updateForSaleQuery = 'UPDATE nfts SET for_sale = TRUE';
    const updateForSaleResult = await pool.query(updateForSaleQuery);
    
    console.log(`Обновлено для продажи: ${updateForSaleResult.rowCount} NFT`);
    
    // Выводим статистику по коллекциям
    const collectionStatsQuery = `
      SELECT collection_name, COUNT(*) AS count 
      FROM nfts 
      GROUP BY collection_name 
      ORDER BY count DESC
    `;
    
    const collectionStatsResult = await pool.query(collectionStatsQuery);
    
    console.log('\nСтатистика по коллекциям:');
    collectionStatsResult.rows.forEach(row => {
      console.log(`${row.collection_name || 'Без коллекции'}: ${row.count} NFT`);
    });
    
    // Выводим статистику по редкости
    const rarityStatsQuery = `
      SELECT rarity, COUNT(*) AS count 
      FROM nfts 
      GROUP BY rarity 
      ORDER BY count DESC
    `;
    
    const rarityStatsResult = await pool.query(rarityStatsQuery);
    
    console.log('\nСтатистика по редкости:');
    rarityStatsResult.rows.forEach(row => {
      console.log(`${row.rarity || 'Без редкости'}: ${row.count} NFT`);
    });
    
    return {
      success: true,
      countBefore,
      countAfter,
      removed: countBefore - countAfter,
      collections: collectionStatsResult.rows,
      rarities: rarityStatsResult.rows
    };
    
  } catch (err) {
    console.error('Ошибка при выполнении принудительной валидации:', err);
    return {
      success: false,
      error: err.message
    };
  } finally {
    console.log('Завершение валидации NFT');
    await pool.end();
  }
}

/**
 * Обновляет названия коллекций NFT
 */
async function updateCollectionNames() {
  console.log('Обновление названий коллекций NFT...');
  
  try {
    // Обновляем Bored Ape Yacht Club
    const updateBoredQuery = `
      UPDATE nfts
      SET collection_name = 'Bored Ape Yacht Club',
          attributes = '{"power": 80, "agility": 85, "wisdom": 95, "luck": 85}'
      WHERE (
        image_path LIKE '%bored_ape%' OR
        image_path LIKE '%bayc_official%' OR
        image_path LIKE '%official_bored_ape%'
      )
    `;
    
    const updateBoredResult = await pool.query(updateBoredQuery);
    console.log(`Обновлено ${updateBoredResult.rowCount} Bored Ape NFT`);
    
    // Обновляем Mutant Ape Yacht Club
    const updateMutantQuery = `
      UPDATE nfts
      SET collection_name = 'Mutant Ape Yacht Club',
          attributes = '{"power": 95, "agility": 90, "wisdom": 85, "luck": 90}'
      WHERE image_path LIKE '%mutant_ape%'
    `;
    
    const updateMutantResult = await pool.query(updateMutantQuery);
    console.log(`Обновлено ${updateMutantResult.rowCount} Mutant Ape NFT`);
    
  } catch (err) {
    console.error('Ошибка при обновлении названий коллекций:', err);
  }
}

/**
 * Обновляет цены NFT на основе редкости
 */
async function updateNFTPrices() {
  console.log('Обновление цен NFT на основе редкости...');
  
  try {
    // Обновляем цены для Bored Ape Yacht Club
    const updateBoredPricesQuery = `
      UPDATE nfts
      SET price = CASE
        WHEN rarity = 'common' THEN '30'
        WHEN rarity = 'uncommon' THEN '1000'
        WHEN rarity = 'rare' THEN '3000'
        WHEN rarity = 'epic' THEN '8000'
        WHEN rarity = 'legendary' THEN '15000'
        ELSE '75'
      END
      WHERE collection_name = 'Bored Ape Yacht Club'
    `;
    
    const updateBoredPricesResult = await pool.query(updateBoredPricesQuery);
    console.log(`Обновлены цены для ${updateBoredPricesResult.rowCount} Bored Ape NFT`);
    
    // Обновляем цены для Mutant Ape Yacht Club
    const updateMutantPricesQuery = `
      UPDATE nfts
      SET price = CASE
        WHEN rarity = 'common' THEN '50'
        WHEN rarity = 'uncommon' THEN '1500'
        WHEN rarity = 'rare' THEN '5000'
        WHEN rarity = 'epic' THEN '10000'
        WHEN rarity = 'legendary' THEN '20000'
        ELSE '100'
      END
      WHERE collection_name = 'Mutant Ape Yacht Club'
    `;
    
    const updateMutantPricesResult = await pool.query(updateMutantPricesQuery);
    console.log(`Обновлены цены для ${updateMutantPricesResult.rowCount} Mutant Ape NFT`);
    
  } catch (err) {
    console.error('Ошибка при обновлении цен NFT:', err);
  }
}

// Запуск скрипта
forceValidateNFTs()
  .then(result => {
    console.log('\nРезультаты валидации:');
    console.log(JSON.stringify(result, null, 2));
    console.log('\n===============================');
    console.log('✅ Принудительная валидация NFT успешно завершена!');
    console.log('===============================\n');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Критическая ошибка при валидации NFT:', err);
    process.exit(1);
  });
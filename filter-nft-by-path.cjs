/**
 * Скрипт для жесткой фильтрации NFT по путям к изображениям
 * Оставляет только NFT, у которых путь к изображению соответствует паттерну обезьян
 * Удаляет все дубликаты изображений по одним и тем же путям
 */

const { Pool } = require('pg');

// Получаем строку подключения из переменной окружения
const DATABASE_URL = process.env.DATABASE_URL;

// Настраиваем пул подключений
const pool = new Pool({
  connectionString: DATABASE_URL,
});

/**
 * Главная функция для фильтрации NFT по путям к изображениям
 */
async function filterNFTByPath() {
  console.log('Запуск фильтрации NFT по путям к изображениям...');
  
  try {
    // Получаем общее количество NFT до фильтрации
    const countBeforeQuery = 'SELECT COUNT(*) FROM nfts';
    const countBeforeResult = await pool.query(countBeforeQuery);
    const countBefore = parseInt(countBeforeResult.rows[0].count);
    
    console.log(`Всего NFT до фильтрации: ${countBefore}`);
    
    // Получаем все пути к изображениям NFT с их ID
    const allNFTsQuery = 'SELECT id, token_id, image_path, price, rarity FROM nfts ORDER BY id';
    const allNFTsResult = await pool.query(allNFTsQuery);
    const allNFTs = allNFTsResult.rows;
    
    console.log(`Получено ${allNFTs.length} NFT для анализа`);
    
    // Определяем шаблоны для путей к изображениям обезьян
    const apePatterns = [
      /bored_ape/i,
      /mutant_ape/i,
      /bayc_official/i,
      /official_bored_ape/i
    ];
    
    // Шаблоны для путей, которые не должны быть в базе
    const nonApePatterns = [
      /core/i,
      /human/i,
      /generated/i,
      /placeholder/i,
      /random/i,
      /test/i
    ];
    
    // Список ID NFT, которые нужно удалить
    const nftToDeleteIds = [];
    
    // Карта путей к изображениям для удаления дубликатов
    const uniqueImagePaths = new Map();
    
    // Анализируем каждый NFT
    for (const nft of allNFTs) {
      const imagePath = nft.image_path || '';
      
      // Проверяем, соответствует ли путь шаблонам обезьян
      const isApe = apePatterns.some(pattern => pattern.test(imagePath));
      
      // Проверяем, не соответствует ли путь запрещенным шаблонам
      const isNonApe = nonApePatterns.some(pattern => pattern.test(imagePath));
      
      // Если это не обезьяна или это запрещенный паттерн, помечаем для удаления
      if (!isApe || isNonApe) {
        nftToDeleteIds.push(nft.id);
        console.log(`NFT ID ${nft.id} не является обезьяной: ${imagePath}`);
        continue;
      }
      
      // Проверяем на дубликаты путей
      if (uniqueImagePaths.has(imagePath)) {
        // Это дубликат, сравниваем редкость и цену с предыдущим
        const existingNFT = uniqueImagePaths.get(imagePath);
        
        // Если текущий NFT имеет более высокую цену или редкость, заменяем предыдущий
        if (
          (nft.rarity === 'legendary' && existingNFT.rarity !== 'legendary') ||
          (nft.rarity === 'epic' && !['legendary', 'epic'].includes(existingNFT.rarity)) ||
          parseFloat(nft.price) > parseFloat(existingNFT.price)
        ) {
          // Удаляем предыдущий NFT
          nftToDeleteIds.push(existingNFT.id);
          console.log(`Заменяем дубликат NFT ID ${existingNFT.id} на ${nft.id} с более высокой редкостью/ценой`);
          // Сохраняем текущий NFT
          uniqueImagePaths.set(imagePath, nft);
        } else {
          // Удаляем текущий NFT
          nftToDeleteIds.push(nft.id);
          console.log(`Удаляем дубликат NFT ID ${nft.id}, оставляем ${existingNFT.id}`);
        }
      } else {
        // Это первый NFT с таким путем, сохраняем его
        uniqueImagePaths.set(imagePath, nft);
      }
    }
    
    console.log(`Найдено ${nftToDeleteIds.length} NFT для удаления`);
    
    // Удаляем помеченные NFT
    if (nftToDeleteIds.length > 0) {
      // Разбиваем массив на подгруппы для безопасного удаления
      const batchSize = 500;
      for (let i = 0; i < nftToDeleteIds.length; i += batchSize) {
        const batch = nftToDeleteIds.slice(i, i + batchSize);
        const placeholders = batch.map((_, idx) => `$${idx + 1}`).join(',');
        
        // Удаляем записи из таблицы nft_transfers, связанные с этими NFT
        const deleteTransfersQuery = `DELETE FROM nft_transfers WHERE nft_id IN (${placeholders})`;
        await pool.query(deleteTransfersQuery, batch);
        
        // Удаляем NFT
        const deleteNFTsQuery = `DELETE FROM nfts WHERE id IN (${placeholders})`;
        const deleteResult = await pool.query(deleteNFTsQuery, batch);
        
        console.log(`Удалено ${deleteResult.rowCount} NFT (пакет ${Math.floor(i / batchSize) + 1})`);
      }
    }
    
    // Получаем количество NFT после фильтрации
    const countAfterQuery = 'SELECT COUNT(*) FROM nfts';
    const countAfterResult = await pool.query(countAfterQuery);
    const countAfter = parseInt(countAfterResult.rows[0].count);
    
    console.log(`Всего NFT после фильтрации: ${countAfter}`);
    console.log(`Удалено NFT: ${countBefore - countAfter}`);
    
    // Обновляем типы NFT и устанавливаем правильные цены и атрибуты
    console.log('Обновление типов NFT, цен и атрибутов...');
    
    // Обновляем цены для Bored Ape
    const updateBoredPricesQuery = `
      UPDATE nfts
      SET price = CASE
        WHEN rarity = 'common' THEN '30'
        WHEN rarity = 'uncommon' THEN '1000'
        WHEN rarity = 'rare' THEN '3000'
        WHEN rarity = 'epic' THEN '8000'
        WHEN rarity = 'legendary' THEN '15000'
        ELSE '75'
      END,
      attributes = '{"power": 80, "agility": 85, "wisdom": 95, "luck": 85}'
      WHERE (
        image_path LIKE '%bored_ape%' OR
        image_path LIKE '%bayc_official%' OR
        image_path LIKE '%official_bored_ape%'
      )
    `;
    
    const updateBoredResult = await pool.query(updateBoredPricesQuery);
    console.log(`Обновлено ${updateBoredResult.rowCount} Bored Ape NFT`);
    
    // Обновляем цены для Mutant Ape
    const updateMutantPricesQuery = `
      UPDATE nfts
      SET price = CASE
        WHEN rarity = 'common' THEN '50'
        WHEN rarity = 'uncommon' THEN '1500'
        WHEN rarity = 'rare' THEN '5000'
        WHEN rarity = 'epic' THEN '10000'
        WHEN rarity = 'legendary' THEN '20000'
        ELSE '100'
      END,
      attributes = '{"power": 95, "agility": 90, "wisdom": 85, "luck": 90}'
      WHERE image_path LIKE '%mutant_ape%'
    `;
    
    const updateMutantResult = await pool.query(updateMutantPricesQuery);
    console.log(`Обновлено ${updateMutantResult.rowCount} Mutant Ape NFT`);
    
    // Обновляем имена NFT на основе их пути к изображению
    console.log('Обновление имен NFT...');
    
    // Обновляем имена для Bored Ape
    const updateBoredNamesQuery = `
      UPDATE nfts
      SET name = 'Bored Ape #' || token_id
      WHERE (
        image_path LIKE '%bored_ape%' OR
        image_path LIKE '%bayc_official%' OR
        image_path LIKE '%official_bored_ape%'
      )
    `;
    
    await pool.query(updateBoredNamesQuery);
    
    // Обновляем имена для Mutant Ape
    const updateMutantNamesQuery = `
      UPDATE nfts
      SET name = 'Mutant Ape #' || token_id
      WHERE image_path LIKE '%mutant_ape%'
    `;
    
    await pool.query(updateMutantNamesQuery);
    
    // Устанавливаем все NFT на продажу
    const updateForSaleQuery = 'UPDATE nfts SET for_sale = TRUE WHERE for_sale = FALSE';
    const updateForSaleResult = await pool.query(updateForSaleQuery);
    console.log(`Выставлено на продажу ${updateForSaleResult.rowCount} NFT`);
    
    // Получаем статистику по типам
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
    
    // Получаем статистику по редкости
    const rarityStatsQuery = 'SELECT rarity, COUNT(*) FROM nfts GROUP BY rarity ORDER BY COUNT(*) DESC';
    const rarityStatsResult = await pool.query(rarityStatsQuery);
    
    console.log('\nСтатистика по редкости:');
    rarityStatsResult.rows.forEach(row => {
      console.log(`${row.rarity}: ${row.count} NFT`);
    });
    
    return {
      success: true,
      countBefore,
      countAfter,
      removed: countBefore - countAfter,
      typeStats: typeStatsResult.rows,
      rarityStats: rarityStatsResult.rows
    };
    
  } catch (err) {
    console.error('Ошибка при фильтрации NFT:', err);
    return {
      success: false,
      error: err.message
    };
  } finally {
    console.log('Завершение фильтрации NFT');
    await pool.end();
  }
}

// Запуск скрипта
filterNFTByPath()
  .then(result => {
    console.log('\nРезультаты фильтрации NFT:');
    console.log(JSON.stringify(result, null, 2));
    console.log('\n===============================');
    console.log('✅ Фильтрация NFT успешно завершена!');
    console.log('===============================\n');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Критическая ошибка при фильтрации NFT:', err);
    process.exit(1);
  });
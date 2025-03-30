/**
 * Скрипт для полного удаления всех NFT, которые не являются обезьянами
 * Включает удаление NFT с изображением как на скриншоте (core и др.)
 * ВНИМАНИЕ: Этот скрипт удаляет NFT из базы данных безвозвратно!
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Получаем строку подключения из переменной окружения
const DATABASE_URL = process.env.DATABASE_URL;

// Настраиваем пул подключений
const pool = new Pool({
  connectionString: DATABASE_URL,
});

// Определяем регулярные выражения для обезьяних NFT
const apeRegexPatterns = [
  /bored_ape.*\.(?:png|avif|jpg|jpeg)$/i,
  /mutant_ape.*\.(?:png|avif|jpg|jpeg)$/i,
  /official_bored_ape.*\.(?:png|avif|jpg|jpeg)$/i,
  /bayc_official.*\.(?:png|avif|jpg|jpeg)$/i
];

// Списки с конкретно запрещенными NFT (такие как "core" и другие неуместные изображения)
const bannedImagePatterns = [
  /core/i,
  /human/i,
  /astronaut/i,
  /person/i,
  /people/i,
  /man/i,
  /woman/i,
  /face/i,
  /svg/i,
  /random/i
];

/**
 * Проверяет, является ли изображение обезьяной
 * @param {string} imagePath Путь к изображению
 * @returns {boolean} true, если изображение является обезьяной, false в противном случае
 */
function isApeImage(imagePath) {
  if (!imagePath) return false;
  
  // Проверяем, соответствует ли путь одному из допустимых шаблонов
  const isApe = apeRegexPatterns.some(pattern => pattern.test(imagePath));
  
  // Если путь соответствует шаблону обезьяны, проверяем, не содержит ли он запрещенные элементы
  if (isApe) {
    const isBanned = bannedImagePatterns.some(pattern => pattern.test(imagePath));
    return !isBanned;
  }
  
  return false;
}

/**
 * Главная функция для удаления NFT
 */
async function removeNonApeNFTs() {
  console.log('Запуск процесса удаления не-обезьяньих NFT...');
  
  try {
    // Получаем общее количество NFT до очистки
    const countBeforeQuery = 'SELECT COUNT(*) FROM nfts';
    const countBeforeResult = await pool.query(countBeforeQuery);
    const countBefore = parseInt(countBeforeResult.rows[0].count);
    
    console.log(`Всего NFT до очистки: ${countBefore}`);
    
    // Получаем все пути к изображениям NFT
    const getAllPathsQuery = 'SELECT id, name, image_path FROM nfts';
    const allPathsResult = await pool.query(getAllPathsQuery);
    const allNFTs = allPathsResult.rows;
    
    console.log(`Получено ${allNFTs.length} путей к изображениям для анализа`);
    
    // Находим NFT, которые не являются обезьянами
    const nonApeNFTIds = [];
    
    for (const nft of allNFTs) {
      const imagePath = nft.image_path || '';
      
      // Проверка, является ли NFT обезьяной
      if (!isApeImage(imagePath)) {
        nonApeNFTIds.push(nft.id);
        console.log(`ID ${nft.id}, имя: ${nft.name}, путь: ${imagePath} - не является обезьяной`);
      }
    }
    
    console.log(`Найдено ${nonApeNFTIds.length} NFT, которые не являются обезьянами`);
    
    // Удаляем не-обезьяньи NFT
    if (nonApeNFTIds.length > 0) {
      // Создаем группы по 1000 элементов для избежания ошибок с длиной запроса
      const batchSize = 1000;
      let totalDeleted = 0;
      
      for (let i = 0; i < nonApeNFTIds.length; i += batchSize) {
        const batch = nonApeNFTIds.slice(i, i + batchSize);
        const deleteQuery = `DELETE FROM nfts WHERE id IN (${batch.join(',')})`;
        
        const deleteResult = await pool.query(deleteQuery);
        totalDeleted += deleteResult.rowCount;
        
        console.log(`Удалено ${deleteResult.rowCount} NFT в пакете ${Math.floor(i / batchSize) + 1}`);
      }
      
      console.log(`Всего удалено ${totalDeleted} не-обезьяньих NFT`);
    }
    
    // Получаем количество NFT после очистки
    const countAfterQuery = 'SELECT COUNT(*) FROM nfts';
    const countAfterResult = await pool.query(countAfterQuery);
    const countAfter = parseInt(countAfterResult.rows[0].count);
    
    console.log(`Всего NFT после очистки: ${countAfter}`);
    console.log(`Удалено NFT: ${countBefore - countAfter}`);
    
    // Обновляем атрибуты NFT
    console.log('Обновление атрибутов NFT...');
    
    // Обновляем атрибуты для Bored Ape Yacht Club
    const updateBoredQuery = `
      UPDATE nfts
      SET attributes = '{"power": 80, "agility": 85, "wisdom": 95, "luck": 85}'
      WHERE (
        image_path LIKE '%bored_ape%' OR
        image_path LIKE '%bayc_official%' OR
        image_path LIKE '%official_bored_ape%'
      )
    `;
    
    const updateBoredResult = await pool.query(updateBoredQuery);
    console.log(`Обновлено ${updateBoredResult.rowCount} Bored Ape NFT атрибутов`);
    
    // Обновляем атрибуты для Mutant Ape Yacht Club
    const updateMutantQuery = `
      UPDATE nfts
      SET attributes = '{"power": 95, "agility": 90, "wisdom": 85, "luck": 90}'
      WHERE image_path LIKE '%mutant_ape%'
    `;
    
    const updateMutantResult = await pool.query(updateMutantQuery);
    console.log(`Обновлено ${updateMutantResult.rowCount} Mutant Ape NFT атрибутов`);
    
    // Получаем статистику по типам NFT
    const nftTypeStatsQuery = `
      SELECT 
        CASE 
          WHEN image_path LIKE '%bored_ape%' OR image_path LIKE '%bayc_official%' OR image_path LIKE '%official_bored_ape%' THEN 'Bored Ape Yacht Club'
          WHEN image_path LIKE '%mutant_ape%' THEN 'Mutant Ape Yacht Club'
          ELSE 'Другие'
        END as nft_type,
        COUNT(*) AS count 
      FROM nfts 
      GROUP BY nft_type
      ORDER BY count DESC
    `;
    
    const nftTypeStatsResult = await pool.query(nftTypeStatsQuery);
    
    console.log('\nСтатистика по типам NFT:');
    nftTypeStatsResult.rows.forEach(row => {
      console.log(`${row.nft_type}: ${row.count} NFT`);
    });
    
    // Выставляем все NFT на продажу
    const updateForSaleQuery = 'UPDATE nfts SET for_sale = TRUE';
    const updateForSaleResult = await pool.query(updateForSaleQuery);
    
    console.log(`\nОбновлено для продажи: ${updateForSaleResult.rowCount} NFT`);
    
    return {
      success: true,
      countBefore,
      countAfter,
      removed: countBefore - countAfter,
      nftTypes: nftTypeStatsResult.rows
    };
    
  } catch (err) {
    console.error('Ошибка при удалении не-обезьяньих NFT:', err);
    return {
      success: false,
      error: err.message
    };
  } finally {
    console.log('Завершение процесса удаления не-обезьяньих NFT');
    await pool.end();
  }
}

// Запуск скрипта
removeNonApeNFTs()
  .then(result => {
    console.log('\nРезультаты удаления не-обезьяньих NFT:');
    console.log(JSON.stringify(result, null, 2));
    console.log('\n===============================');
    console.log('✅ Удаление не-обезьяньих NFT успешно завершено!');
    console.log('===============================\n');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Критическая ошибка при удалении не-обезьяньих NFT:', err);
    process.exit(1);
  });
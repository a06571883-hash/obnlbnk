/**
 * Скрипт для обновления цен NFT в базе данных частями
 * Устанавливает высокие цены в зависимости от редкости NFT
 */

import pg from 'pg';
const { Pool } = pg;
import { config } from 'dotenv';
config();

// Подключение к базе данных PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Размер пакета для обновления
const BATCH_SIZE = 500;

/**
 * Генерирует новую цену для NFT на основе его редкости
 * @param {string} rarity Редкость NFT
 * @returns {number} Новая цена NFT в долларах
 */
function generateNewPrice(rarity, tokenId) {
  // Seed для консистентной генерации цены на основе ID токена
  const seed = tokenId % 1000 + 1;
  
  // Базовые ценовые диапазоны для каждой редкости
  const priceRanges = {
    common: { min: 1500, max: 8000 }, 
    uncommon: { min: 8000, max: 25000 },
    rare: { min: 25000, max: 80000 },
    epic: { min: 80000, max: 200000 },
    legendary: { min: 200000, max: 300000 }
  };

  // Определение диапазона цен на основе редкости
  const range = priceRanges[rarity?.toLowerCase()] || priceRanges.common;
  
  // Генерация случайной цены в пределах диапазона с использованием seed
  const randomFactor = ((seed * 13) % 100) / 100; // 0.0 - 0.99
  const price = Math.round(range.min + randomFactor * (range.max - range.min));
  
  // Округление цены для более "красивого" представления
  if (price > 100000) {
    return Math.round(price / 10000) * 10000; // Округляем до десятков тысяч
  } else if (price > 10000) {
    return Math.round(price / 1000) * 1000; // Округляем до тысяч
  } else {
    return Math.round(price / 100) * 100; // Округляем до сотен
  }
}

/**
 * Получает диапазон ID для обновления
 */
async function getNftIdRange() {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      'SELECT MIN(id) as min_id, MAX(id) as max_id, COUNT(*) as total FROM nfts'
    );
    return rows[0];
  } finally {
    client.release();
  }
}

/**
 * Обновляет цены NFT по указанным ID
 */
async function updateNFTPricesByIds(ids) {
  if (!ids.length) return { success: 0, error: 0 };
  
  const client = await pool.connect();
  let successCount = 0;
  let errorCount = 0;
  
  try {
    console.log(`Обновляю цены для ${ids.length} NFT...`);
    
    // Получаем данные NFT для указанных ID
    const { rows: nfts } = await client.query(
      `SELECT id, token_id, rarity FROM nfts WHERE id IN (${ids.join(',')})`
    );
    
    // Обновляем цену для каждого NFT
    for (const nft of nfts) {
      try {
        const newPrice = generateNewPrice(nft.rarity, nft.token_id);
        
        await client.query(
          'UPDATE nfts SET price = $1 WHERE id = $2',
          [newPrice, nft.id]
        );
        
        successCount++;
      } catch (updateError) {
        console.error(`Ошибка обновления NFT ID ${nft.id}:`, updateError);
        errorCount++;
      }
    }
    
    return { success: successCount, error: errorCount };
  } finally {
    client.release();
  }
}

/**
 * Получает все ID NFT из базы
 */
async function getAllNftIds() {
  const client = await pool.connect();
  try {
    const { rows } = await client.query('SELECT id FROM nfts ORDER BY id');
    return rows.map(row => row.id);
  } finally {
    client.release();
  }
}

/**
 * Основная функция
 */
async function main() {
  try {
    console.log('Начинаем обновление цен NFT...');
    
    // Получаем информацию о диапазоне ID
    const range = await getNftIdRange();
    console.log(`Диапазон ID NFT: от ${range.min_id} до ${range.max_id}, всего: ${range.total}`);
    
    // Получаем все ID NFT
    const allIds = await getAllNftIds();
    console.log(`Получено ${allIds.length} ID NFT`);
    
    let totalSuccess = 0;
    let totalErrors = 0;
    
    // Обрабатываем ID пакетами
    for (let i = 0; i < allIds.length; i += BATCH_SIZE) {
      const batchIds = allIds.slice(i, i + BATCH_SIZE);
      
      const result = await updateNFTPricesByIds(batchIds);
      
      totalSuccess += result.success;
      totalErrors += result.error;
      
      const progress = Math.round((i + batchIds.length) * 100 / allIds.length);
      console.log(`Прогресс: ${i + batchIds.length}/${allIds.length} (${progress}%), Успешно: ${totalSuccess}, Ошибки: ${totalErrors}`);
    }
    
    console.log('\nИтоговые результаты:');
    console.log(`Успешно обновлено: ${totalSuccess} NFT`);
    console.log(`Ошибки при обновлении: ${totalErrors} NFT`);
    console.log('Обновление цен NFT завершено.');
  } catch (error) {
    console.error('Ошибка при обновлении цен NFT:', error);
  } finally {
    pool.end();
  }
}

// Запускаем скрипт
main();
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
const BATCH_SIZE = 100;

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
 * Обновляет цены NFT пакетно
 * @param {number} startId Начальный ID
 * @param {number} endId Конечный ID
 */
async function updateNFTPricesBatch(startId, endId) {
  const client = await pool.connect();
  
  try {
    console.log(`Обновляю цены для NFT с ID от ${startId} до ${endId}...`);
    
    // Получаем NFT из указанного диапазона ID
    const { rows: nfts } = await client.query(
      'SELECT id, token_id, rarity FROM nfts WHERE id >= $1 AND id <= $2',
      [startId, endId]
    );
    
    console.log(`Найдено ${nfts.length} NFT в текущем пакете.`);
    
    // Счетчики для статистики
    let successCount = 0;
    let errorCount = 0;
    
    // Обновляем цену для каждого NFT в пакете
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
    
    console.log(`Результаты пакета ${startId}-${endId}:`);
    console.log(`Успешно: ${successCount}, Ошибки: ${errorCount}`);
    
    return { 
      success: successCount, 
      error: errorCount,
      total: nfts.length
    };
  } finally {
    client.release();
  }
}

/**
 * Получает максимальный ID NFT в базе
 */
async function getMaxNftId() {
  const client = await pool.connect();
  try {
    const { rows } = await client.query('SELECT MAX(id) as max_id FROM nfts');
    return rows[0]?.max_id || 0;
  } finally {
    client.release();
  }
}

/**
 * Основная функция
 */
async function main() {
  try {
    console.log('Начинаем пакетное обновление цен NFT...');
    
    // Получаем максимальный ID
    const maxId = await getMaxNftId();
    console.log(`Максимальный ID NFT: ${maxId}`);
    
    // Общие счетчики
    let totalSuccess = 0;
    let totalErrors = 0;
    
    // Обрабатываем пакетами по BATCH_SIZE
    for (let startId = 1; startId <= maxId; startId += BATCH_SIZE) {
      const endId = Math.min(startId + BATCH_SIZE - 1, maxId);
      
      const result = await updateNFTPricesBatch(startId, endId);
      
      totalSuccess += result.success;
      totalErrors += result.error;
      
      console.log(`Общий прогресс: ${totalSuccess + totalErrors} из ~${maxId} NFT (${Math.round((totalSuccess + totalErrors) * 100 / maxId)}%)`);
      
      // Пауза между пакетами, чтобы не перегружать базу данных
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('\nОбщие результаты обновления цен:');
    console.log(`Успешно обновлено: ${totalSuccess} NFT`);
    console.log(`Ошибки при обновлении: ${totalErrors} NFT`);
    console.log('Обновление цен NFT завершено.');
  } catch (error) {
    console.error('Ошибка при обновлении цен NFT:', error);
  } finally {
    // Закрываем соединение с базой данных
    pool.end();
  }
}

// Запускаем скрипт
main();
/**
 * Скрипт для обновления цен NFT в базе данных
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
  const range = priceRanges[rarity.toLowerCase()] || priceRanges.common;
  
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
 * Обновляет цены всех NFT в базе данных
 */
async function updateNFTPrices() {
  const client = await pool.connect();
  
  try {
    console.log('Начинаем обновление цен NFT...');
    
    // Получаем все NFT из базы
    const { rows: nfts } = await client.query(
      'SELECT id, token_id, rarity FROM nfts'
    );
    
    console.log(`Найдено ${nfts.length} NFT для обновления.`);
    
    // Счетчики для статистики
    let successCount = 0;
    let errorCount = 0;
    
    // Обновляем цену для каждого NFT
    for (const nft of nfts) {
      try {
        const newPrice = generateNewPrice(nft.rarity, nft.token_id);
        
        await client.query(
          'UPDATE nfts SET price = $1 WHERE id = $2',
          [newPrice, nft.id]
        );
        
        successCount++;
        
        // Выводим прогресс каждые 100 записей
        if (successCount % 100 === 0) {
          console.log(`Обновлено ${successCount} из ${nfts.length} NFT`);
        }
      } catch (updateError) {
        console.error(`Ошибка обновления NFT ID ${nft.id}:`, updateError);
        errorCount++;
      }
    }
    
    console.log('\nРезультаты обновления цен:');
    console.log(`Успешно обновлено: ${successCount} NFT`);
    console.log(`Ошибки при обновлении: ${errorCount} NFT`);
    console.log('Обновление цен NFT завершено.');
  } catch (error) {
    console.error('Ошибка при обновлении цен NFT:', error);
  } finally {
    client.release();
  }
}

// Запуск функции обновления цен
updateNFTPrices().finally(() => {
  pool.end(); // Закрываем соединение с базой данных после завершения
});
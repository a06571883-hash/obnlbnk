/**
 * Скрипт для нормализации token_id в коллекции NFT
 * Обеспечивает последовательную нумерацию без пропусков
 */
import pg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pg;
dotenv.config();

// Подключение к PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Обновляет token_id для обеспечения уникальности и последовательности
 */
async function normalizeTokenIds() {
  console.log('Нормализация token_id для всех NFT...');
  
  try {
    // Подключение к базе данных
    const client = await pool.connect();
    
    try {
      // Получить все уникальные NFT, отсортированные по текущему token_id
      const getNftsQuery = `
        SELECT id, token_id 
        FROM nfts 
        ORDER BY CAST(token_id AS INTEGER) ASC
      `;
      
      const nftsResult = await client.query(getNftsQuery);
      const nfts = nftsResult.rows;
      
      console.log(`Всего NFT для обработки: ${nfts.length}`);
      
      // Обновить каждый NFT с последовательным token_id
      let updateCount = 0;
      
      for (let i = 0; i < nfts.length; i++) {
        const nft = nfts[i];
        const newTokenId = i.toString();
        
        // Обновить token_id, если он отличается
        if (nft.token_id !== newTokenId) {
          const updateQuery = `
            UPDATE nfts 
            SET token_id = $1 
            WHERE id = $2
          `;
          
          await client.query(updateQuery, [newTokenId, nft.id]);
          updateCount++;
          
          if (updateCount % 100 === 0) {
            console.log(`Обновлено ${updateCount} NFT...`);
          }
        }
      }
      
      console.log(`Завершено. Обновлено ${updateCount} NFT для обеспечения последовательности token_id.`);
      return { success: true, updated: updateCount };
      
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Ошибка при нормализации token_id:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Основная функция запуска скрипта
 */
async function main() {
  console.log('Запуск скрипта нормализации token_id...');
  
  try {
    // Нормализовать token_id
    const normalizeResult = await normalizeTokenIds();
    
    if (!normalizeResult.success) {
      console.error('Ошибка при нормализации token_id:', normalizeResult.error);
      return;
    }
    
    // Проверим общее количество NFT
    const client = await pool.connect();
    try {
      const countQuery = `SELECT COUNT(*) as count FROM nfts`;
      const countResult = await client.query(countQuery);
      const totalCount = parseInt(countResult.rows[0].count);
      
      console.log(`Всего уникальных NFT в базе данных: ${totalCount}`);
    } finally {
      client.release();
    }
    
    console.log('Скрипт завершен успешно.');
    
  } catch (error) {
    console.error('Ошибка при выполнении скрипта:', error);
  } finally {
    // Закрыть подключение к базе данных
    pool.end();
  }
}

// Запустить скрипт
main();
/**
 * Скрипт для удаления всех дубликатов NFT
 * Удаляет NFT с одинаковыми token_id, оставляя только уникальные
 */
import pg from 'pg';
import fs from 'fs';
import dotenv from 'dotenv';

const { Pool } = pg;
dotenv.config();

// Подключение к PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Удаляет дублирующиеся NFT с одинаковыми token_id
 */
async function removeDuplicateNFTs() {
  console.log('Поиск и удаление дубликатов NFT...');
  
  try {
    // Подключение к базе данных
    const client = await pool.connect();
    
    try {
      // Найти дубликаты по token_id
      const findDuplicatesQuery = `
        SELECT token_id, COUNT(*) as count
        FROM nfts
        GROUP BY token_id
        HAVING COUNT(*) > 1
        ORDER BY count DESC;
      `;
      
      const duplicatesResult = await client.query(findDuplicatesQuery);
      const duplicates = duplicatesResult.rows;
      
      if (duplicates.length === 0) {
        console.log('Дубликаты NFT не найдены.');
        return { success: true, removed: 0 };
      }
      
      console.log(`Найдено ${duplicates.length} токенов с дубликатами.`);
      
      // Для каждого дубликата оставить только одну запись (с наименьшим id)
      let totalRemoved = 0;
      
      for (const dup of duplicates) {
        const tokenId = dup.token_id;
        const count = parseInt(dup.count);
        
        // Получить все NFT с этим token_id, отсортированные по id
        const getNftsQuery = `
          SELECT id 
          FROM nfts 
          WHERE token_id = $1 
          ORDER BY id ASC
        `;
        
        const nftsResult = await client.query(getNftsQuery, [tokenId]);
        const nfts = nftsResult.rows;
        
        // Оставляем первый (с наименьшим id), удаляем остальные
        const idsToKeep = nfts[0].id;
        const idsToRemove = nfts.slice(1).map(n => n.id);
        
        if (idsToRemove.length > 0) {
          // Удалить дубликаты
          const deleteQuery = `
            DELETE FROM nfts 
            WHERE id = ANY($1::int[])
          `;
          
          const deleteResult = await client.query(deleteQuery, [idsToRemove]);
          const removedCount = deleteResult.rowCount;
          
          totalRemoved += removedCount;
          console.log(`Удалено ${removedCount} дубликатов для token_id ${tokenId}.`);
        }
      }
      
      console.log(`Всего удалено ${totalRemoved} дубликатов NFT.`);
      return { success: true, removed: totalRemoved };
      
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Ошибка при удалении дубликатов NFT:', error);
    return { success: false, error: error.message };
  }
}

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
        }
      }
      
      console.log(`Обновлено ${updateCount} NFT для обеспечения последовательности token_id.`);
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
  console.log('Запуск скрипта очистки дубликатов NFT...');
  
  try {
    // Удалить дубликаты NFT
    const removeResult = await removeDuplicateNFTs();
    
    if (!removeResult.success) {
      console.error('Ошибка при удалении дубликатов:', removeResult.error);
      return;
    }
    
    console.log(`Успешно удалено ${removeResult.removed} дубликатов NFT.`);
    
    // Проверим последний token_id
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
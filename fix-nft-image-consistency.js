/**
 * Скрипт для обеспечения согласованности NFT изображений
 * Проверяет, что каждый NFT имеет корректное поле original_image_path и использует его на фронтенде
 */

import pg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pg;
dotenv.config();

// Создаем подключение к PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

/**
 * Проверяет и обновляет поля оригинальных путей изображений для всех NFT
 */
async function fixNftImageConsistency() {
  const client = await pool.connect();
  
  try {
    // Начинаем транзакцию
    await client.query('BEGIN');
    
    console.log('Проверка и обновление полей original_image_path и sort_order для NFT...');
    
    // 1. Обновляем поле original_image_path, если оно NULL
    const updateOriginalPathResult = await client.query(`
      UPDATE nfts
      SET original_image_path = image_path
      WHERE original_image_path IS NULL
    `);
    
    console.log(`Обновлено ${updateOriginalPathResult.rowCount} NFT с пустыми original_image_path`);
    
    // 2. Обновляем sort_order для NFT, если он NULL
    const updateSortOrderResult = await client.query(`
      UPDATE nfts
      SET sort_order = id
      WHERE sort_order IS NULL
    `);
    
    console.log(`Обновлено ${updateSortOrderResult.rowCount} NFT с пустыми sort_order`);
    
    // 3. Проверяем и исправляем случаи, когда image_path отличается от original_image_path 
    // для NFT, которые не меняли владельца
    const checkNftTransfersResult = await client.query(`
      SELECT nft_id 
      FROM nft_transfers
    `);
    
    // Создаем набор ID NFT, которые имеют историю передач
    const transferredNftIds = new Set();
    for (const row of checkNftTransfersResult.rows) {
      transferredNftIds.add(row.nft_id);
    }
    
    console.log(`Найдено ${transferredNftIds.size} NFT с историей передач`);
    
    // Получаем NFT, у которых оригинальный путь отличается от текущего,
    // но они никогда не передавались другим пользователям
    const nftsWithDiffPathResult = await client.query(`
      SELECT id, image_path, original_image_path 
      FROM nfts 
      WHERE image_path <> original_image_path OR original_image_path IS NULL
    `);
    
    console.log(`Найдено ${nftsWithDiffPathResult.rows.length} NFT с различающимися путями к изображениям`);
    
    // Обрабатываем каждый NFT
    let fixedCount = 0;
    for (const nft of nftsWithDiffPathResult.rows) {
      // Если NFT никогда не передавался и пути различаются, восстанавливаем оригинальный путь
      if (!transferredNftIds.has(nft.id)) {
        // Если original_image_path NULL или пуст, используем текущий image_path
        if (!nft.original_image_path) {
          await client.query(`
            UPDATE nfts
            SET original_image_path = image_path
            WHERE id = $1
          `, [nft.id]);
        } 
        // Иначе восстанавливаем оригинальный путь
        else {
          await client.query(`
            UPDATE nfts
            SET image_path = original_image_path
            WHERE id = $1
          `, [nft.id]);
        }
        fixedCount++;
      }
    }
    
    console.log(`Исправлено ${fixedCount} NFT с непоследовательными путями изображений`);
    
    // Проверяем, что все NFT имеют sort_order
    const checkSortOrderResult = await client.query(`
      SELECT COUNT(*) as missing_count
      FROM nfts
      WHERE sort_order IS NULL
    `);
    
    const missingSortOrderCount = parseInt(checkSortOrderResult.rows[0].missing_count);
    console.log(`NFT с отсутствующим sort_order: ${missingSortOrderCount}`);
    
    if (missingSortOrderCount > 0) {
      console.log('Обновляем оставшиеся NFT без sort_order...');
      await client.query(`
        UPDATE nfts
        SET sort_order = id
        WHERE sort_order IS NULL
      `);
    }
    
    // Завершаем транзакцию
    await client.query('COMMIT');
    
    console.log('Обновление NFT изображений успешно завершено!');
    
    return {
      success: true,
      message: `Обновлено ${updateOriginalPathResult.rowCount} NFT с пустыми original_image_path, ${updateSortOrderResult.rowCount} NFT с пустыми sort_order, и исправлено ${fixedCount} NFT с непоследовательными путями изображений`
    };
  } catch (error) {
    // Откатываем транзакцию в случае ошибки
    await client.query('ROLLBACK');
    console.error('Ошибка при обновлении NFT изображений:', error);
    return {
      success: false,
      error: error.message
    };
  } finally {
    // Освобождаем подключение
    client.release();
  }
}

// Основная функция для запуска скрипта
async function main() {
  try {
    console.log('Запуск скрипта для обеспечения согласованности NFT изображений...');
    const result = await fixNftImageConsistency();
    
    if (result.success) {
      console.log('Скрипт успешно выполнен:', result.message);
    } else {
      console.error('Ошибка при выполнении скрипта:', result.error);
    }
  } catch (error) {
    console.error('Необработанная ошибка:', error);
  } finally {
    // Закрываем пул подключений при завершении
    pool.end();
  }
}

// Запускаем скрипт
main();
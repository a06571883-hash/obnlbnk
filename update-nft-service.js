/**
 * Скрипт для обновления сервиса NFT
 * Обновляет поля originalImagePath во всех NFT, 
 * обеспечивая, что изображения не меняются при передаче
 */

import pg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pg;
dotenv.config();

// Создаем подключение к PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function updateNftService() {
  const client = await pool.connect();
  
  try {
    console.log('Начинаем обновление сервиса NFT...');
    
    // Начинаем транзакцию
    await client.query('BEGIN');
    
    // 1. Обновляем originalImagePath в таблице nfts
    console.log('Обновляем поле original_image_path в таблице nfts...');
    const updateDrizzleResult = await client.query(`
      UPDATE nfts
      SET original_image_path = image_path
      WHERE original_image_path IS NULL
    `);
    console.log(`Обновлено ${updateDrizzleResult.rowCount} NFT в таблице nfts`);
    
    // 2. Пробуем найти такое же поле в legacy таблице nft
    console.log('Проверяем наличие поля original_image_path в таблице nft...');
    
    // Проверяем, существует ли таблица nft
    const checkTableResult = await client.query(`
      SELECT EXISTS (
        SELECT FROM pg_tables
        WHERE tablename = 'nft'
      ) AS exists
    `);
    
    if (checkTableResult.rows[0].exists) {
      // Проверяем, существует ли поле original_image_path
      const checkColumnResult = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns
          WHERE table_name = 'nft' AND column_name = 'original_image_path'
        ) AS exists
      `);
      
      if (!checkColumnResult.rows[0].exists) {
        // Добавляем поле original_image_path в таблицу nft
        console.log('Добавляем поле original_image_path в таблицу nft...');
        await client.query(`
          ALTER TABLE nft
          ADD COLUMN IF NOT EXISTS original_image_path TEXT
        `);
        console.log('Поле original_image_path добавлено в таблицу nft');
      }
      
      // Обновляем поле original_image_path
      console.log('Обновляем поле original_image_path в таблице nft...');
      const updateLegacyResult = await client.query(`
        UPDATE nft
        SET original_image_path = image_url
        WHERE original_image_path IS NULL
      `);
      console.log(`Обновлено ${updateLegacyResult.rowCount} NFT в таблице nft`);
    } else {
      console.log('Таблица nft не существует, пропускаем обновление');
    }
    
    // 3. Создаем и обновляем поле sort_order в legacy таблице nft, если оно существует
    if (checkTableResult.rows[0].exists) {
      // Проверяем, существует ли поле sort_order
      const checkSortOrderResult = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns
          WHERE table_name = 'nft' AND column_name = 'sort_order'
        ) AS exists
      `);
      
      if (!checkSortOrderResult.rows[0].exists) {
        // Добавляем поле sort_order в таблицу nft
        console.log('Добавляем поле sort_order в таблицу nft...');
        await client.query(`
          ALTER TABLE nft
          ADD COLUMN IF NOT EXISTS sort_order INTEGER
        `);
        console.log('Поле sort_order добавлено в таблицу nft');
        
        // Обновляем sort_order для всех NFT
        console.log('Обновляем sort_order в таблице nft...');
        await client.query(`
          UPDATE nft
          SET sort_order = id
          WHERE sort_order IS NULL
        `);
        console.log('Поле sort_order обновлено в таблице nft');
      }
    }
    
    // Завершаем транзакцию
    await client.query('COMMIT');
    
    console.log('Обновление сервиса NFT завершено успешно!');
    return {
      success: true
    };
  } catch (error) {
    // Откатываем транзакцию в случае ошибки
    await client.query('ROLLBACK');
    console.error('Ошибка при обновлении сервиса NFT:', error);
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
    console.log('Запуск скрипта обновления сервиса NFT...');
    const result = await updateNftService();
    
    if (result.success) {
      console.log('Скрипт успешно выполнен');
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
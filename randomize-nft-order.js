/**
 * Скрипт для добавления случайного порядка сортировки для всех NFT
 * Это позволит показывать NFT в случайном порядке вместо сортировки по ID
 */
import pg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pg;
const { config } = dotenv;

// Загружаем переменные окружения
config();

// Подключаемся к базе данных PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Добавляет колонку sort_order в таблицу nfts, если она еще не существует,
 * и заполняет ее случайными значениями.
 */
async function addSortOrderToNftsTable() {
  const client = await pool.connect();
  try {
    // Проверяем существует ли колонка sort_order
    const columnExistsResult = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'nfts' AND column_name = 'sort_order'
    `);
    
    let columnExists = columnExistsResult.rows.length > 0;
    
    // Если колонка не существует, создаем ее
    if (!columnExists) {
      console.log('Добавляем колонку sort_order в таблицу nfts...');
      await client.query(`
        ALTER TABLE nfts 
        ADD COLUMN sort_order FLOAT
      `);
      console.log('Колонка sort_order успешно добавлена в таблицу nfts');
    } else {
      console.log('Колонка sort_order уже существует в таблице nfts');
    }
    
    // Обновляем все записи, заполняя sort_order случайными значениями
    console.log('Заполняем колонку sort_order случайными значениями...');
    await client.query(`
      UPDATE nfts 
      SET sort_order = random()
      WHERE sort_order IS NULL OR sort_order = 0
    `);
    
    // Создаем индекс для ускорения сортировки
    console.log('Проверяем наличие индекса...');
    const indexExists = await client.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'nfts' AND indexname = 'idx_nfts_sort_order'
    `);
    
    if (indexExists.rows.length === 0) {
      console.log('Создаем индекс для ускорения сортировки...');
      await client.query(`
        CREATE INDEX idx_nfts_sort_order ON nfts(sort_order)
      `);
      console.log('Индекс успешно создан');
    } else {
      console.log('Индекс уже существует');
    }
    
    console.log('Случайная сортировка успешно применена к таблице nfts');
  } catch (err) {
    console.error('Ошибка при обновлении таблицы nfts:', err);
  } finally {
    client.release();
  }
}

/**
 * Добавляет колонку sort_order в таблицу nft (старая таблица), если она еще не существует,
 * и заполняет ее случайными значениями.
 */
async function addSortOrderToLegacyNftTable() {
  const client = await pool.connect();
  try {
    // Проверяем существует ли таблица nft
    const tableExistsResult = await client.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' AND tablename = 'nft'
    `);
    
    // Если таблица не существует, выходим
    if (tableExistsResult.rows.length === 0) {
      console.log('Таблица nft не существует, пропускаем...');
      return;
    }
    
    // Проверяем существует ли колонка sort_order
    const columnExistsResult = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'nft' AND column_name = 'sort_order'
    `);
    
    let columnExists = columnExistsResult.rows.length > 0;
    
    // Если колонка не существует, создаем ее
    if (!columnExists) {
      console.log('Добавляем колонку sort_order в таблицу nft (legacy)...');
      await client.query(`
        ALTER TABLE nft 
        ADD COLUMN sort_order FLOAT
      `);
      console.log('Колонка sort_order успешно добавлена в таблицу nft (legacy)');
    } else {
      console.log('Колонка sort_order уже существует в таблице nft (legacy)');
    }
    
    // Обновляем все записи, заполняя sort_order случайными значениями
    console.log('Заполняем колонку sort_order случайными значениями для legacy таблицы...');
    await client.query(`
      UPDATE nft 
      SET sort_order = random()
      WHERE sort_order IS NULL OR sort_order = 0
    `);
    
    // Создаем индекс для ускорения сортировки
    console.log('Проверяем наличие индекса для legacy таблицы...');
    const indexExists = await client.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'nft' AND indexname = 'idx_nft_sort_order'
    `);
    
    if (indexExists.rows.length === 0) {
      console.log('Создаем индекс для ускорения сортировки в legacy таблице...');
      await client.query(`
        CREATE INDEX idx_nft_sort_order ON nft(sort_order)
      `);
      console.log('Индекс успешно создан для legacy таблицы');
    } else {
      console.log('Индекс уже существует для legacy таблицы');
    }
    
    console.log('Случайная сортировка успешно применена к таблице nft (legacy)');
  } catch (err) {
    console.error('Ошибка при обновлении таблицы nft (legacy):', err);
  } finally {
    client.release();
  }
}

/**
 * Выполняет перемешивание порядка NFT
 */
async function main() {
  try {
    // Перемешиваем порядок в основной таблице nfts
    await addSortOrderToNftsTable();
    
    // Перемешиваем порядок в старой таблице nft
    await addSortOrderToLegacyNftTable();
    
    console.log('Операция успешно завершена. Теперь NFT будут отображаться в случайном порядке.');
  } catch (error) {
    console.error('Ошибка при выполнении скрипта:', error);
  } finally {
    // Закрываем соединение с базой данных
    pool.end();
  }
}

// Запускаем основную функцию
main();
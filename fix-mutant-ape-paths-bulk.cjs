/**
 * Скрипт для массового исправления путей к изображениям Mutant Ape NFT
 * в базе данных с использованием одной SQL-транзакции
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Подключение к базе данных PostgreSQL через DATABASE_URL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Получает список всех файлов Mutant Ape из директории
 * @returns {Promise<string[]>} Массив имен файлов
 */
async function getMutantApeFiles() {
  return new Promise((resolve, reject) => {
    fs.readdir('mutant_ape_nft', (err, files) => {
      if (err) {
        reject(err);
        return;
      }
      // Фильтруем только PNG файлы
      const pngFiles = files.filter(file => file.endsWith('.png'));
      resolve(pngFiles);
    });
  });
}

/**
 * Создает SQL-запрос для обновления всех путей одним запросом
 * @param {string[]} files Массив имен файлов
 * @returns {Promise<void>}
 */
async function updateAllPathsBulk(files) {
  if (files.length === 0) {
    console.error('Ошибка: не найдено файлов Mutant Ape');
    return;
  }

  const client = await pool.connect();
  try {
    console.log(`Начинаем массовое обновление путей для Mutant Ape NFT с ${files.length} файлами...`);
    
    // Начинаем транзакцию
    await client.query('BEGIN');
    
    // Создаем временную функцию для циклического выбора файлов
    await client.query(`
      CREATE OR REPLACE FUNCTION get_file_at_index(files text[], idx integer) RETURNS text AS $$
      BEGIN
        RETURN files[(idx % array_length(files, 1)) + 1];
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    // Подготавливаем массив имен файлов для SQL
    const filesArray = files.map(file => `'${file}'`).join(',');
    
    // Выполняем массовое обновление в одном запросе
    const updateResult = await client.query(`
      WITH file_array AS (
        SELECT ARRAY[${filesArray}] AS files
      ),
      nft_with_index AS (
        SELECT 
          id, 
          image_path,
          ROW_NUMBER() OVER (ORDER BY id) - 1 AS idx
        FROM nfts
        WHERE collection_id = 2
      )
      UPDATE nfts n
      SET image_path = '/mutant_ape_nft/' || get_file_at_index((SELECT files FROM file_array), idx)
      FROM nft_with_index ni
      WHERE n.id = ni.id;
    `);
    
    // Удаляем временную функцию
    await client.query('DROP FUNCTION IF EXISTS get_file_at_index(text[], integer);');
    
    // Фиксируем транзакцию
    await client.query('COMMIT');
    
    console.log(`Успешно обновлены пути для Mutant Ape NFT`);
    console.log(`Затронуто строк: ${updateResult.rowCount}`);
  } catch (err) {
    // Откатываем транзакцию в случае ошибки
    await client.query('ROLLBACK');
    console.error('Ошибка при обновлении путей:', err);
  } finally {
    client.release();
  }
}

/**
 * Основная функция скрипта
 */
async function main() {
  try {
    // Получаем список файлов
    const files = await getMutantApeFiles();
    console.log(`Найдено ${files.length} файлов Mutant Ape`);
    
    // Обновляем все пути одним запросом
    await updateAllPathsBulk(files);
    
    console.log('Скрипт успешно завершен!');
  } catch (err) {
    console.error('Ошибка при выполнении скрипта:', err);
  } finally {
    // Закрываем пул соединений
    await pool.end();
  }
}

// Запускаем скрипт
main();
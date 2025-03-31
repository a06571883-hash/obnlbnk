/**
 * Скрипт для быстрого обновления путей к изображениям NFT в базе данных
 * Работает быстрее за счет пакетного обновления без проверки файлов
 */

const { Pool } = require('pg');
const dotenv = require('dotenv');

// Загрузка переменных окружения
dotenv.config();

// Создание пула подключений к PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Быстрое обновление путей Bored Ape одним SQL запросом
 */
async function updateBoredApePaths() {
  console.log('Обновление путей для коллекции Bored Ape Yacht Club...');
  
  // Обновляем все пути одним SQL запросом
  const result = await pool.query(`
    UPDATE nfts 
    SET 
      image_path = CONCAT('/bored_ape_nft/bored_ape_', 
        (MOD(CAST(token_id AS INTEGER), 773) + 1), '.png'),
      original_image_path = CONCAT('/bored_ape_nft/bored_ape_', 
        (MOD(CAST(token_id AS INTEGER), 773) + 1), '.png')
    WHERE collection_id = 1
  `);
  
  console.log(`Обновлено путей для Bored Apes: ${result.rowCount}`);
}

/**
 * Быстрое обновление путей Mutant Ape одним SQL запросом
 */
async function updateMutantApePaths() {
  console.log('Обновление путей для коллекции Mutant Ape Yacht Club...');
  
  // Обновляем все пути одним SQL запросом
  const result = await pool.query(`
    UPDATE nfts 
    SET 
      image_path = CONCAT('/mutant_ape_nft/mutant_ape_', 
        CASE 
          WHEN CAST(token_id AS INTEGER) BETWEEN 10001 AND 11000 THEN CAST(token_id AS INTEGER)
          ELSE (MOD(CAST(token_id AS INTEGER), 1000) + 10001)
        END, '.svg'),
      original_image_path = CONCAT('/mutant_ape_nft/mutant_ape_', 
        CASE 
          WHEN CAST(token_id AS INTEGER) BETWEEN 10001 AND 11000 THEN CAST(token_id AS INTEGER)
          ELSE (MOD(CAST(token_id AS INTEGER), 1000) + 10001)
        END, '.svg')
    WHERE collection_id = 2
  `);
  
  console.log(`Обновлено путей для Mutant Apes: ${result.rowCount}`);
}

/**
 * Перемешивает порядок отображения NFT
 */
async function randomizeNftOrder() {
  console.log('Перемешивание порядка отображения NFT...');
  
  await pool.query(`
    UPDATE nfts 
    SET sort_order = (RANDOM() * 20000)::INTEGER
  `);
  
  console.log('Порядок отображения NFT успешно перемешан');
}

/**
 * Основная функция
 */
async function main() {
  try {
    console.log('Запуск быстрого обновления путей к изображениям NFT...');
    
    // Обновляем пути к изображениям Bored Ape
    await updateBoredApePaths();
    
    // Обновляем пути к изображениям Mutant Ape
    await updateMutantApePaths();
    
    // Перемешиваем порядок отображения
    await randomizeNftOrder();
    
    console.log('\nСкрипт успешно завершен!');
  } catch (error) {
    console.error('Ошибка выполнения скрипта:', error);
  } finally {
    // Закрываем соединение с базой данных
    await pool.end();
  }
}

// Запускаем скрипт
main();
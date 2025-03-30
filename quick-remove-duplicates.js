/**
 * Скрипт для быстрого удаления всех дубликатов NFT в базе данных
 * Использует прямые SQL-запросы для оптимизации производительности
 */

import pg from 'pg';
const { Pool } = pg;

// Подключение к PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Находит и удаляет все дубликаты NFT с одинаковыми token_id
 * Использует единый SQL-запрос для оптимизации производительности
 */
async function removeAllDuplicates() {
  const client = await pool.connect();
  try {
    console.log('Запуск быстрого удаления дубликатов NFT...');
    
    // Сначала проверяем, есть ли дубликаты token_id
    const countResult = await client.query(`
      SELECT COUNT(*) as total_count FROM nfts
    `);
    const totalCount = countResult.rows[0].total_count;
    
    const duplicatesResult = await client.query(`
      SELECT COUNT(DISTINCT token_id) as unique_token_count FROM nfts
    `);
    const uniqueTokenCount = duplicatesResult.rows[0].unique_token_count;
    
    console.log(`Всего NFT в базе данных: ${totalCount}`);
    console.log(`Уникальных token_id: ${uniqueTokenCount}`);
    console.log(`Приблизительное количество дубликатов: ${totalCount - uniqueTokenCount}`);
    
    if (totalCount === uniqueTokenCount) {
      console.log('Дубликаты не обнаружены, база данных уже оптимизирована.');
      return;
    }
    
    console.log('Удаление дубликатов...');
    
    // Создаем временную таблицу с уникальными token_id и выбранным id
    await client.query(`
      CREATE TEMPORARY TABLE unique_nfts AS
      SELECT DISTINCT ON (token_id) id
      FROM nfts
      ORDER BY token_id, minted_at DESC
    `);
    
    // Получаем количество строк в временной таблице
    const tempTableResult = await client.query(`
      SELECT COUNT(*) as count FROM unique_nfts
    `);
    const tempTableCount = tempTableResult.rows[0].count;
    console.log(`Количество уникальных NFT для сохранения: ${tempTableCount}`);
    
    // Удаляем все записи, которые не входят в набор уникальных ID
    const deleteResult = await client.query(`
      DELETE FROM nfts 
      WHERE id NOT IN (SELECT id FROM unique_nfts)
      RETURNING id
    `);
    
    const deletedCount = deleteResult.rowCount;
    console.log(`Удалено ${deletedCount} дубликатов NFT`);
    
    // Проверяем финальное количество NFT
    const finalCountResult = await client.query(`
      SELECT COUNT(*) as final_count FROM nfts
    `);
    const finalCount = finalCountResult.rows[0].final_count;
    
    console.log(`Финальное количество уникальных NFT в базе данных: ${finalCount}`);
    
    // Проверяем, остались ли дубликаты
    const remainingDuplicatesResult = await client.query(`
      SELECT token_id, COUNT(*) 
      FROM nfts 
      GROUP BY token_id 
      HAVING COUNT(*) > 1
    `);
    
    if (remainingDuplicatesResult.rows.length > 0) {
      console.log(`ВНИМАНИЕ: В базе всё еще остались ${remainingDuplicatesResult.rows.length} дубликатов!`);
    } else {
      console.log('Все дубликаты успешно удалены!');
    }
    
  } catch (error) {
    console.error('Ошибка при удалении дубликатов:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Основная функция запуска скрипта
 */
async function main() {
  try {
    // Удаление всех дубликатов
    await removeAllDuplicates();
    
    console.log('Скрипт очистки дубликатов завершен успешно!');
    console.log('Для проверки результатов перезапустите приложение и обновите страницу маркетплейса');
    
  } catch (error) {
    console.error('Ошибка при выполнении скрипта:', error);
  } finally {
    // Закрываем пул соединений
    await pool.end();
    console.log('Подключение к базе данных закрыто.');
  }
}

// Запуск скрипта
main();
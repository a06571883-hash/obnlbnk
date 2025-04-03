/**
 * Скрипт для полного удаления всех NFT из базы данных
 * и подготовки к чистому импорту
 */

const { Client } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

/**
 * Полностью очищает базу данных от всех NFT
 */
async function cleanAllNFT() {
  // Подключаемся к базе данных PostgreSQL
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    await client.connect();
    console.log('Подключение к базе данных установлено');

    // Выполняем транзакцию для безопасного удаления
    await client.query('BEGIN');

    // Получаем общее количество NFT до удаления
    const countResult = await client.query('SELECT COUNT(*) FROM nft');
    const totalCount = parseInt(countResult.rows[0].count, 10);
    console.log(`Всего найдено NFT: ${totalCount}`);

    // Удаляем все записи из таблицы nft
    const deleteResult = await client.query('DELETE FROM nft');
    console.log(`Удалено NFT: ${deleteResult.rowCount}`);

    // Сбрасываем автоинкрементный счетчик
    await client.query('ALTER SEQUENCE nft_id_seq RESTART WITH 1');
    console.log('Счетчик ID сброшен');

    await client.query('COMMIT');
    console.log('Транзакция завершена успешно');

    return { success: true, message: `Удалено ${deleteResult.rowCount} NFT` };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Ошибка при очистке NFT:', error);
    return { success: false, error: error.message };
  } finally {
    await client.end();
    console.log('Соединение с базой данных закрыто');
  }
}

// Запускаем функцию очистки
cleanAllNFT()
  .then(result => {
    if (result.success) {
      console.log('✅ База данных NFT успешно очищена');
    } else {
      console.error('❌ Ошибка очистки базы данных:', result.error);
    }
  })
  .catch(err => {
    console.error('❌ Критическая ошибка:', err);
  });
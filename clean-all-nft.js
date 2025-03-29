/**
 * Скрипт для полного удаления всех NFT из базы данных
 * и подготовки к чистому импорту
 */
import pkg from 'pg';
const { Pool } = pkg;

async function cleanAllNFT() {
  try {
    console.log('Начинаем очистку всех NFT...');
    
    // Создаем подключение к базе данных
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });
    
    // Получаем клиента из пула
    const client = await pool.connect();
    
    try {
      // Начинаем транзакцию
      await client.query('BEGIN');
      
      // 1. Сначала удаляем все записи из nft_transfers
      console.log('Удаляем записи из nft_transfers...');
      const deleteTransfersResult = await client.query('DELETE FROM nft_transfers');
      console.log(`Удалено ${deleteTransfersResult.rowCount} записей из nft_transfers`);
      
      // 2. Удаляем записи из таблицы nfts (новая)
      console.log('Удаляем записи из nfts...');
      const deleteNftsResult = await client.query('DELETE FROM nfts');
      console.log(`Удалено ${deleteNftsResult.rowCount} записей из nfts`);

      // 3. Удаляем записи из таблицы nft (старая)
      console.log('Удаляем записи из nft (legacy)...');
      const deleteLegacyNftResult = await client.query('DELETE FROM nft');
      console.log(`Удалено ${deleteLegacyNftResult.rowCount} записей из nft (legacy)`);
      
      // Важно: не удаляем коллекции, они будут использоваться повторно
      
      // Сбрасываем автоинкремент для новых идентификаторов
      console.log('Сбрасываем автоинкремент для таблиц...');
      await client.query('ALTER SEQUENCE nfts_id_seq RESTART WITH 1');
      await client.query('ALTER SEQUENCE nft_id_seq RESTART WITH 1');
      await client.query('ALTER SEQUENCE nft_transfers_id_seq RESTART WITH 1');
      
      // Фиксируем транзакцию
      await client.query('COMMIT');
      
      console.log('Очистка NFT успешно завершена!');
      console.log('Теперь вы можете запустить import-nft-batched.js заново для чистого импорта.');
    } catch (error) {
      // Откатываем транзакцию в случае ошибки
      await client.query('ROLLBACK');
      console.error('Ошибка при очистке NFT:', error);
    } finally {
      // Освобождаем клиента
      client.release();
    }
    
    // Закрываем пул соединений
    await pool.end();
  } catch (error) {
    console.error('Непредвиденная ошибка:', error);
  }
}

// Запускаем очистку
cleanAllNFT().catch(console.error);
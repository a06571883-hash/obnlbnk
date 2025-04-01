/**
 * Скрипт для полного удаления всех дубликатов NFT
 * Использует прямые SQL-запросы для максимальной эффективности
 */
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client, Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Создаем пул соединений для более эффективной работы
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Удаляем все повторяющиеся NFT по token_id
async function removeAllDuplicateNFTs() {
  const client = await pool.connect();
  
  try {
    console.log('Начинаем полное удаление дубликатов NFT...');
    
    // Начинаем транзакцию
    await client.query('BEGIN');
    
    // 1. Сначала находим все token_id, которые встречаются несколько раз
    const findDuplicatesQuery = `
      SELECT token_id, COUNT(*) as count
      FROM nfts
      GROUP BY token_id
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `;
    
    const duplicates = await client.query(findDuplicatesQuery);
    
    if (duplicates.rows.length === 0) {
      console.log('Дубликаты NFT не найдены');
      await client.query('COMMIT');
      return [];
    }
    
    console.log(`Найдено ${duplicates.rows.length} NFT с дубликатами:`);
    duplicates.rows.slice(0, 10).forEach(dup => {
      console.log(`- Token ID ${dup.token_id}: ${dup.count} дубликатов`);
    });
    
    // Создаем временную таблицу для хранения ID NFT, которые нужно сохранить (по одному для каждого token_id)
    await client.query(`
      CREATE TEMP TABLE nfts_to_keep AS
      SELECT DISTINCT ON (token_id) id
      FROM nfts
      ORDER BY token_id, id DESC
    `);
    
    // 2. Находим все ID связанных записей nft_transfers для дубликатов
    await client.query(`
      CREATE TEMP TABLE transfers_to_update AS
      SELECT t.id, t.nft_id, nk.id as new_nft_id
      FROM nft_transfers t
      JOIN nfts n ON t.nft_id = n.id
      JOIN nfts_to_keep nk ON n.token_id = (SELECT token_id FROM nfts WHERE id = nk.id)
      WHERE t.nft_id != nk.id
    `);
    
    // 3. Обновляем записи в nft_transfers, чтобы они указывали на сохраняемые NFT
    const updateResult = await client.query(`
      UPDATE nft_transfers t
      SET nft_id = tu.new_nft_id
      FROM transfers_to_update tu
      WHERE t.id = tu.id
    `);
    
    console.log(`Обновлено ${updateResult.rowCount} записей в таблице nft_transfers`);
    
    // 4. Удаляем все NFT, кроме тех, которые нужно сохранить
    const deleteResult = await client.query(`
      DELETE FROM nfts
      WHERE id NOT IN (SELECT id FROM nfts_to_keep)
      RETURNING id, token_id, name
    `);
    
    console.log(`Удалено ${deleteResult.rowCount} дубликатов NFT`);
    
    // Сохраняем список удаленных NFT
    const removedNFTs = deleteResult.rows;
    
    // 5. Удаляем временные таблицы
    await client.query('DROP TABLE IF EXISTS nfts_to_keep');
    await client.query('DROP TABLE IF EXISTS transfers_to_update');
    
    // Фиксируем изменения
    await client.query('COMMIT');
    
    console.log('Операция успешно завершена');
    return removedNFTs;
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Ошибка при удалении дубликатов NFT:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Получаем информацию о коллекциях NFT
async function getCollectionStats() {
  try {
    const { rows } = await pool.query(`
      SELECT c.id, c.name, COUNT(*) as count
      FROM nfts n
      JOIN nft_collections c ON n.collection_id = c.id
      GROUP BY c.id, c.name
      ORDER BY count DESC
    `);
    
    console.log('Статистика NFT по коллекциям:');
    rows.forEach(row => {
      console.log(`- ${row.name} (ID ${row.id}): ${row.count} NFT`);
    });
    
    return rows;
  } catch (error) {
    console.error('Ошибка при получении статистики по коллекциям:', error);
    return [];
  }
}

// Проверяем наличие дубликатов по разным атрибутам
async function checkForMoreDuplicates() {
  try {
    // Проверяем дубликаты по token_id
    const tokenIdDuplicates = await pool.query(`
      SELECT token_id, COUNT(*) as count
      FROM nfts
      GROUP BY token_id
      HAVING COUNT(*) > 1
    `);
    
    // Проверяем дубликаты по имени
    const nameDuplicates = await pool.query(`
      SELECT name, COUNT(*) as count
      FROM nfts
      GROUP BY name
      HAVING COUNT(*) > 1
    `);
    
    console.log(`\nДополнительная проверка на дубликаты:`);
    console.log(`- Дубликаты по token_id: ${tokenIdDuplicates.rowCount}`);
    console.log(`- Дубликаты по имени: ${nameDuplicates.rowCount}`);
    
    return {
      tokenIdDuplicates: tokenIdDuplicates.rowCount,
      nameDuplicates: nameDuplicates.rowCount
    };
  } catch (error) {
    console.error('Ошибка при проверке на дополнительные дубликаты:', error);
    return { tokenIdDuplicates: 0, nameDuplicates: 0 };
  }
}

// Главная функция
async function main() {
  try {
    console.log('Запуск скрипта удаления дубликатов NFT...');
    
    // Получаем статистику по коллекциям до удаления
    console.log('\nСтатистика до удаления:');
    const statsBefore = await getCollectionStats();
    
    // Удаляем дубликаты
    const removedNFTs = await removeAllDuplicateNFTs();
    
    // Получаем статистику после удаления
    console.log('\nСтатистика после удаления:');
    const statsAfter = await getCollectionStats();
    
    // Проверяем, остались ли дубликаты
    const remainingDuplicates = await checkForMoreDuplicates();
    
    // Сохраняем лог удаленных NFT
    if (removedNFTs.length > 0) {
      const logContent = removedNFTs.map(nft => 
        `ID: ${nft.id}, Token ID: ${nft.token_id}, Name: ${nft.name}`
      ).join('\n');
      
      fs.writeFileSync('removed_nft_duplicates.log', logContent);
      console.log(`\nСписок удаленных NFT сохранен в файл removed_nft_duplicates.log`);
    }
    
    console.log('\nОперация завершена');
    
  } catch (error) {
    console.error('Ошибка при выполнении скрипта:', error);
  } finally {
    // Закрываем соединение с базой данных
    await pool.end();
  }
}

// Запускаем скрипт
main().catch(console.error);
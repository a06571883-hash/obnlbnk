/**
 * Скрипт для быстрого удаления всех дубликатов NFT одним SQL-запросом
 */
import pg from 'pg';

const { Client } = pg;

// Подключение к базе данных PostgreSQL
const client = new Client({
  connectionString: process.env.DATABASE_URL
});

/**
 * Удаляет все дубликаты NFT с одинаковыми token_id одним SQL-запросом
 */
async function removeDuplicateTokenIds() {
  try {
    console.log('Подключаемся к базе данных...');
    await client.connect();
    
    console.log('Начинаем удаление дубликатов...');
    
    // Используем более оптимизированный запрос для удаления дубликатов
    // Удаляем все, кроме записи с максимальным id для каждого token_id
    const deleteQuery = `
      DELETE FROM nfts
      WHERE id IN (
        SELECT id
        FROM (
          SELECT id,
                 token_id,
                 ROW_NUMBER() OVER (PARTITION BY token_id ORDER BY id DESC) as row_num
          FROM nfts
        ) t
        WHERE t.row_num > 1
      );
    `;
    
    console.log('Выполняем запрос на удаление дубликатов...');
    const result = await client.query(deleteQuery);
    
    console.log(`Удалено ${result.rowCount} дубликатов NFT`);
    
    // Получаем общее количество оставшихся NFT
    const countQuery = `SELECT COUNT(*) FROM nfts`;
    const countResult = await client.query(countQuery);
    
    console.log(`Общее количество NFT после очистки: ${countResult.rows[0].count}`);
    
    // Проверяем распределение по коллекциям
    const collectionsQuery = `
      SELECT c.name, COUNT(*) 
      FROM nfts n 
      JOIN nft_collections c ON n.collection_id = c.id 
      GROUP BY c.name
      ORDER BY count DESC
    `;
    
    const collectionsResult = await client.query(collectionsQuery);
    console.log('Распределение по коллекциям:');
    collectionsResult.rows.forEach(row => {
      console.log(`- ${row.name}: ${row.count}`);
    });
    
    // Проверяем распределение по редкости
    const rarityQuery = `
      SELECT rarity, COUNT(*) 
      FROM nfts 
      GROUP BY rarity
      ORDER BY count DESC
    `;
    
    const rarityResult = await client.query(rarityQuery);
    console.log('Распределение по редкости:');
    rarityResult.rows.forEach(row => {
      console.log(`- ${row.rarity || 'не указано'}: ${row.count}`);
    });
    
    // Проверяем, остались ли дубликаты
    const checkDuplicatesQuery = `
      SELECT token_id, COUNT(*) as count
      FROM nfts
      GROUP BY token_id
      HAVING COUNT(*) > 1
      ORDER BY count DESC
      LIMIT 5
    `;
    
    const checkResult = await client.query(checkDuplicatesQuery);
    
    if (checkResult.rows.length > 0) {
      console.log('⚠️ Оставшиеся дубликаты:');
      checkResult.rows.forEach(row => {
        console.log(`- Token ID ${row.token_id}: ${row.count} дубликатов`);
      });
    } else {
      console.log('✅ Дубликаты полностью удалены!');
    }
  } catch (error) {
    console.error('Ошибка при удалении дубликатов:', error);
  } finally {
    console.log('Завершаем работу...');
    await client.end();
  }
}

// Запускаем функцию удаления дубликатов
removeDuplicateTokenIds().catch(console.error);
/**
 * Скрипт для удаления конкретных NFT по ID
 */

const { Pool } = require('pg');
const { config } = require('dotenv');

// Загрузка переменных окружения из файла .env (если есть)
config();

// Создание соединения с базой данных используя переменные окружения
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Список ID NFT, которые нужно удалить
const NFT_IDS_TO_DELETE = [
  306, 339, 494, 516, 619, 552, 323, 17, 74, 10668, 10655, 10634, 
  589, 1017, 1019, 229, 1877, 996, 483, 20062, 189, 10623, 10619
];

/**
 * Удаляет указанные NFT по ID
 */
async function deleteSpecificNFTs() {
  const client = await pool.connect();
  
  try {
    console.log(`Начинаем удаление ${NFT_IDS_TO_DELETE.length} NFT...`);
    
    // Получаем информацию об NFT перед удалением
    const nftInfoResult = await client.query(`
      SELECT id, name, rarity, price, owner_id, token_id
      FROM nfts
      WHERE id = ANY($1)
    `, [NFT_IDS_TO_DELETE]);
    
    console.log(`Найдено NFT для удаления: ${nftInfoResult.rows.length}`);
    
    // Выводим информацию о каждом найденном NFT
    for (const nft of nftInfoResult.rows) {
      console.log(`ID: ${nft.id}, Имя: ${nft.name}, Токен: ${nft.token_id}, Редкость: ${nft.rarity}, Цена: ${nft.price}`);
    }
    
    // Удаляем указанные NFT
    const deleteResult = await client.query(`
      DELETE FROM nfts
      WHERE id = ANY($1)
      RETURNING id
    `, [NFT_IDS_TO_DELETE]);
    
    console.log(`Успешно удалено ${deleteResult.rowCount} NFT`);
    
    if (deleteResult.rowCount < NFT_IDS_TO_DELETE.length) {
      console.log(`Внимание: не все NFT были найдены и удалены. Запрошено: ${NFT_IDS_TO_DELETE.length}, удалено: ${deleteResult.rowCount}`);
      
      // Находим ID, которые не были удалены
      const deletedIds = deleteResult.rows.map(row => row.id);
      const notFoundIds = NFT_IDS_TO_DELETE.filter(id => !deletedIds.includes(id));
      
      console.log(`Не найдены следующие ID: ${notFoundIds.join(', ')}`);
    }
    
    // Проверка общей статистики NFT после удаления
    const statsResult = await client.query(`
      SELECT COUNT(*) as total
      FROM nfts
    `);
    
    console.log(`\nОбщая статистика после удаления:`);
    console.log(`- Осталось NFT: ${statsResult.rows[0].total}`);
    
    console.log('\nУдаление NFT успешно завершено!');
    
  } catch (error) {
    console.error('Ошибка при удалении NFT:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Запуск основной функции скрипта
deleteSpecificNFTs()
  .then(() => {
    console.log('Скрипт успешно выполнен');
    process.exit(0);
  })
  .catch(error => {
    console.error('Ошибка выполнения скрипта:', error);
    process.exit(1);
  });
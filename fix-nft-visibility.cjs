/**
 * Скрипт для исправления видимости NFT в маркетплейсе
 * - Убеждается, что ваши NFT отображаются в маркетплейсе
 * - Проверяет правильность установки флага for_sale
 * - Логирует данные для диагностики
 */

const { Pool } = require('pg');
const { config } = require('dotenv');

// Загрузка переменных окружения из файла .env (если есть)
config();

// Создание соединения с базой данных используя переменные окружения
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

/**
 * Исправляет видимость NFT в маркетплейсе
 */
async function fixNFTVisibility() {
  const client = await pool.connect();
  
  try {
    console.log('Начинаем проверку видимости NFT...');
    
    // 1. Получаем информацию о пользователях
    const users = await client.query(`
      SELECT id, username 
      FROM users 
      ORDER BY id
    `);
    
    console.log(`Всего пользователей: ${users.rows.length}`);
    users.rows.forEach(user => {
      console.log(`ID: ${user.id}, Имя: ${user.username}`);
    });
    
    // 2. Выводим информацию о NFT по владельцам
    const nftsByOwner = await client.query(`
      SELECT owner_id, COUNT(*) as count
      FROM nfts
      GROUP BY owner_id
      ORDER BY owner_id
    `);
    
    console.log(`\nРаспределение NFT по владельцам:`);
    for (const row of nftsByOwner.rows) {
      const ownerInfo = users.rows.find(user => user.id === row.owner_id) || { username: 'Неизвестный' };
      console.log(`- Владелец ${ownerInfo.username} (ID: ${row.owner_id}): ${row.count} NFT`);
    }
    
    // 3. Проверяем NFT, выставленные на продажу
    const forSaleNFTs = await client.query(`
      SELECT owner_id, COUNT(*) as count
      FROM nfts
      WHERE for_sale = true
      GROUP BY owner_id
      ORDER BY owner_id
    `);
    
    console.log(`\nNFT на продаже по владельцам:`);
    for (const row of forSaleNFTs.rows) {
      const ownerInfo = users.rows.find(user => user.id === row.owner_id) || { username: 'Неизвестный' };
      console.log(`- Владелец ${ownerInfo.username} (ID: ${row.owner_id}): ${row.count} NFT на продаже`);
    }
    
    // 4. Смотрим на каждого пользователя, у которого есть NFT не на продаже
    const result = await client.query(`
      SELECT owner_id, COUNT(*) as count
      FROM nfts
      WHERE for_sale = false
      GROUP BY owner_id
      ORDER BY count DESC
    `);
    
    console.log(`\nNFT НЕ на продаже по владельцам:`);
    for (const row of result.rows) {
      const ownerInfo = users.rows.find(user => user.id === row.owner_id) || { username: 'Неизвестный' };
      console.log(`- Владелец ${ownerInfo.username} (ID: ${row.owner_id}): ${row.count} NFT НЕ на продаже`);
    }
    
    // 5. Получаем NFT пользователя с определенным именем
    const targetUsername = process.argv[2]; // Имя пользователя можно передать как аргумент
    
    if (targetUsername) {
      console.log(`\nПоиск NFT для пользователя: ${targetUsername}`);
      
      const userResult = await client.query(`
        SELECT id FROM users WHERE username = $1
      `, [targetUsername]);
      
      if (userResult.rows.length === 0) {
        console.log(`Пользователь с именем ${targetUsername} не найден`);
      } else {
        const userId = userResult.rows[0].id;
        console.log(`Найден пользователь с ID: ${userId}`);
        
        // Получаем все NFT пользователя
        const userNFTs = await client.query(`
          SELECT id, name, price, for_sale, rarity, collection_id
          FROM nfts
          WHERE owner_id = $1
          ORDER BY id
        `, [userId]);
        
        console.log(`Всего NFT у пользователя: ${userNFTs.rows.length}`);
        
        // Получаем те, которые на продаже
        const userForSaleNFTs = await client.query(`
          SELECT id, name, price, for_sale, rarity
          FROM nfts
          WHERE owner_id = $1 AND for_sale = true
          ORDER BY id
        `, [userId]);
        
        console.log(`NFT на продаже: ${userForSaleNFTs.rows.length}`);
        
        // Выставляем все NFT этого пользователя на продажу
        const updateResult = await client.query(`
          UPDATE nfts
          SET for_sale = true
          WHERE owner_id = $1
          RETURNING id
        `, [userId]);
        
        console.log(`\nВыставлено на продажу: ${updateResult.rowCount} NFT`);
      }
    }
    
    // 6. Общие статистические данные
    const statsResult = await client.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN for_sale = true THEN 1 ELSE 0 END) as for_sale,
        SUM(CASE WHEN for_sale = false THEN 1 ELSE 0 END) as not_for_sale
      FROM nfts
    `);
    
    const stats = statsResult.rows[0];
    console.log(`\nОбщая статистика NFT:`);
    console.log(`- Всего NFT: ${stats.total}`);
    console.log(`- На продаже: ${stats.for_sale} (${Math.round(stats.for_sale / stats.total * 100)}%)`);
    console.log(`- Не на продаже: ${stats.not_for_sale} (${Math.round(stats.not_for_sale / stats.total * 100)}%)`);
    
    console.log('\nПроверка и исправление видимости NFT успешно завершена!');
    
  } catch (error) {
    console.error('Ошибка при проверке видимости NFT:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Запуск основной функции скрипта
fixNFTVisibility()
  .then(() => {
    console.log('Скрипт успешно выполнен');
    process.exit(0);
  })
  .catch(error => {
    console.error('Ошибка выполнения скрипта:', error);
    process.exit(1);
  });
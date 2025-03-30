/**
 * Скрипт для исправления цен NFT в маркетплейсе
 * - Устанавливает минимальную цену на уровне 30$
 * - Устанавливает максимальную цену на уровне 20,000$
 * - Обновляет все цены для соответствия новому диапазону
 */

import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const { Pool } = pg;
const { config } = dotenv;

// Загрузка переменных окружения из файла .env (если есть)
config();

// Создание соединения с базой данных используя переменные окружения
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

/**
 * Обновляет цены NFT в соответствии с новыми правилами
 */
async function updateNFTPrices() {
  const client = await pool.connect();
  
  try {
    console.log('Начинаем обновление цен NFT...');
    
    // 1. Получаем количество NFT с ценами ниже 30$
    const lowPriceResult = await client.query(`
      SELECT COUNT(*) 
      FROM nfts 
      WHERE CAST(price AS DECIMAL) < 30
    `);
    
    const lowPriceCount = parseInt(lowPriceResult.rows[0].count);
    console.log(`Найдено ${lowPriceCount} NFT с ценой ниже 30$`);
    
    // 2. Получаем количество NFT с ценами выше 20,000$
    const highPriceResult = await client.query(`
      SELECT COUNT(*) 
      FROM nfts 
      WHERE CAST(price AS DECIMAL) > 20000
    `);
    
    const highPriceCount = parseInt(highPriceResult.rows[0].count);
    console.log(`Найдено ${highPriceCount} NFT с ценой выше 20,000$`);
    
    // 3. Обновляем NFT с низкими ценами (меньше 30$)
    if (lowPriceCount > 0) {
      const updateLowPriceResult = await client.query(`
        UPDATE nfts
        SET price = '30'
        WHERE CAST(price AS DECIMAL) < 30
        RETURNING id, name, price
      `);
      
      console.log(`Обновлено ${updateLowPriceResult.rowCount} NFT с низкой ценой на минимальную цену 30$`);
    }
    
    // 4. Обновляем NFT с высокими ценами (более 20,000$)
    if (highPriceCount > 0) {
      const updateHighPriceResult = await client.query(`
        UPDATE nfts
        SET price = '20000'
        WHERE CAST(price AS DECIMAL) > 20000
        RETURNING id, name, price
      `);
      
      console.log(`Обновлено ${updateHighPriceResult.rowCount} NFT с высокой ценой на максимальную цену 20,000$`);
    }
    
    // 5. Обновляем цены для NFT на основе редкости
    const updatePricesByRarityResult = await client.query(`
      UPDATE nfts
      SET price = 
        CASE 
          WHEN rarity = 'common' THEN 
            GREATEST(30, LEAST(500, CAST(price AS DECIMAL)))::text
          WHEN rarity = 'uncommon' THEN 
            GREATEST(500, LEAST(2000, CAST(price AS DECIMAL)))::text
          WHEN rarity = 'rare' THEN 
            GREATEST(2000, LEAST(5000, CAST(price AS DECIMAL)))::text
          WHEN rarity = 'epic' THEN 
            GREATEST(5000, LEAST(10000, CAST(price AS DECIMAL)))::text
          WHEN rarity = 'legendary' THEN 
            GREATEST(10000, LEAST(20000, CAST(price AS DECIMAL)))::text
          ELSE price
        END
      RETURNING id
    `);
    
    console.log(`Обновлено ${updatePricesByRarityResult.rowCount} NFT с ценами в соответствии с редкостью`);
    
    // 6. Убедимся, что все NFT выставлены на продажу (forSale = true)
    const updateForSaleResult = await client.query(`
      UPDATE nfts
      SET "forSale" = true
      WHERE "forSale" = false AND "ownerId" = 1
      RETURNING id
    `);
    
    console.log(`Обновлено ${updateForSaleResult.rowCount} NFT, теперь они доступны для продажи на маркетплейсе`);
    
    // 7. Проверяем статистику цен после обновления
    const priceStatsResult = await client.query(`
      SELECT 
        MIN(CAST(price AS DECIMAL)) as min_price,
        MAX(CAST(price AS DECIMAL)) as max_price,
        AVG(CAST(price AS DECIMAL)) as avg_price
      FROM nfts
    `);
    
    const { min_price, max_price, avg_price } = priceStatsResult.rows[0];
    console.log(`Статистика цен NFT после обновления:`);
    console.log(`- Минимальная цена: ${min_price}$`);
    console.log(`- Максимальная цена: ${max_price}$`);
    console.log(`- Средняя цена: ${Math.round(avg_price)}$`);
    
    // 8. Проверяем цены по категориям редкости
    const rarityStatsResult = await client.query(`
      SELECT 
        rarity,
        COUNT(*) as count,
        MIN(CAST(price AS DECIMAL)) as min_price,
        MAX(CAST(price AS DECIMAL)) as max_price,
        AVG(CAST(price AS DECIMAL)) as avg_price
      FROM nfts
      GROUP BY rarity
      ORDER BY 
        CASE 
          WHEN rarity = 'common' THEN 1
          WHEN rarity = 'uncommon' THEN 2
          WHEN rarity = 'rare' THEN 3
          WHEN rarity = 'epic' THEN 4
          WHEN rarity = 'legendary' THEN 5
          ELSE 6
        END
    `);
    
    console.log(`\nРаспределение цен по категориям редкости:`);
    rarityStatsResult.rows.forEach(row => {
      console.log(`- ${row.rarity}: ${row.count} NFT, цены от ${row.min_price}$ до ${row.max_price}$, средняя ${Math.round(row.avg_price)}$`);
    });
    
    // 9. Для пользовательских NFT, не являющихся регулятором, устанавливаем высокие цены
    const updateUserNftsResult = await client.query(`
      UPDATE nfts
      SET price = 
        CASE 
          WHEN rarity = 'common' THEN '500'
          WHEN rarity = 'uncommon' THEN '2000' 
          WHEN rarity = 'rare' THEN '5000'
          WHEN rarity = 'epic' THEN '10000'
          WHEN rarity = 'legendary' THEN '20000'
          ELSE '5000'
        END
      WHERE "ownerId" != 1
      RETURNING id, "ownerId", price, rarity
    `);
    
    console.log(`\nОбновлено ${updateUserNftsResult.rowCount} пользовательских NFT с новыми ценами`);
    
    console.log('\nОбновление цен NFT успешно завершено!');
    
  } catch (error) {
    console.error('Ошибка при обновлении цен NFT:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Запуск основной функции скрипта
try {
  await updateNFTPrices();
  console.log('Скрипт успешно выполнен');
  process.exit(0);
} catch (error) {
  console.error('Ошибка выполнения скрипта:', error);
  process.exit(1);
}
/**
 * Скрипт для обновления цен NFT:
 * - Минимальная цена 30$ (для некрасивых/обычных NFT)
 * - Максимальная цена 20,000$ (для самых редких и красивых NFT)
 * - Распределение цен в соответствии с редкостью
 */

const { Pool } = require('pg');
const { config } = require('dotenv');

// Загрузка переменных окружения из файла .env (если есть)
config();

// Создание соединения с базой данных используя переменные окружения
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Новые диапазоны цен по редкости
const PRICE_RANGES = {
  common: { min: 30, max: 500 },
  uncommon: { min: 300, max: 2000 },
  rare: { min: 1500, max: 8000 },
  epic: { min: 5000, max: 15000 },
  legendary: { min: 12000, max: 20000 }
};

/**
 * Генерирует цену внутри заданного диапазона с учетом редкости
 * @param {string} rarity Редкость NFT
 * @param {number} tokenId ID токена для получения последовательной генерации
 * @returns {number} Цена NFT в долларах
 */
function generatePrice(rarity, tokenId) {
  const range = PRICE_RANGES[rarity.toLowerCase()] || PRICE_RANGES.common;
  const seed = tokenId || Math.random();
  
  // Используем seed для генерации числа в диапазоне
  const randomFactor = (Math.cos(seed * 10000) + 1) / 2; // 0 to 1
  const price = range.min + randomFactor * (range.max - range.min);
  
  // Округляем до красивых чисел
  if (price < 100) {
    return Math.round(price / 5) * 5; // Кратно 5
  } else if (price < 1000) {
    return Math.round(price / 50) * 50; // Кратно 50
  } else {
    return Math.round(price / 100) * 100; // Кратно 100
  }
}

/**
 * Обновляет цены всех NFT в соответствии с их редкостью
 */
async function updateNFTPrices() {
  const client = await pool.connect();
  
  try {
    console.log('Начинаем обновление цен NFT...');
    
    // Получаем статистику по текущим ценам до обновления
    const beforeStatsResult = await client.query(`
      SELECT 
        MIN(CAST(price AS FLOAT)) as min_price, 
        MAX(CAST(price AS FLOAT)) as max_price,
        AVG(CAST(price AS FLOAT)) as avg_price,
        COUNT(*) as total
      FROM nfts
    `);
    
    const beforeStats = beforeStatsResult.rows[0];
    console.log(`\nСтатистика до обновления:`);
    console.log(`- Всего NFT: ${beforeStats.total}`);
    console.log(`- Минимальная цена: $${Math.round(beforeStats.min_price)}`);
    console.log(`- Максимальная цена: $${Math.round(beforeStats.max_price)}`);
    console.log(`- Средняя цена: $${Math.round(beforeStats.avg_price)}`);
    
    // Получаем все NFT для обработки
    const nftsResult = await client.query(`
      SELECT id, name, rarity, token_id 
      FROM nfts 
    `);
    
    const nfts = nftsResult.rows;
    console.log(`\nНайдено NFT для обновления цен: ${nfts.length}`);
    
    // Счетчики для статистики
    const stats = {
      common: 0,
      uncommon: 0,
      rare: 0,
      epic: 0, 
      legendary: 0,
      other: 0
    };
    
    // Быстро обновляем цены одним запросом для каждой редкости
    console.log('Начинаем обновление цен...');
    
    // Обновление цен для Common NFTs (самая низкая цена)
    const commonResult = await client.query(`
      UPDATE nfts
      SET price = (30 + (ABS(MOD(CAST(token_id AS INTEGER), 47)) * 5))::text
      WHERE rarity = 'common'
    `);
    
    const commonCount = await client.query(`
      SELECT COUNT(*) as count FROM nfts WHERE rarity = 'common'
    `);
    
    console.log(`Обновлено ${commonCount.rows[0].count} common NFT`);
    stats.common = parseInt(commonCount.rows[0].count);
    
    // Обновление цен для Uncommon NFTs
    await client.query(`
      UPDATE nfts
      SET price = (300 + (ABS(MOD(CAST(token_id AS INTEGER), 34)) * 50))::text
      WHERE rarity = 'uncommon'
    `);
    
    const uncommonCount = await client.query(`
      SELECT COUNT(*) as count FROM nfts WHERE rarity = 'uncommon'
    `);
    
    console.log(`Обновлено ${uncommonCount.rows[0].count} uncommon NFT`);
    stats.uncommon = parseInt(uncommonCount.rows[0].count);
    
    // Обновление цен для Rare NFTs
    await client.query(`
      UPDATE nfts
      SET price = (1500 + (ABS(MOD(CAST(token_id AS INTEGER), 65)) * 100))::text
      WHERE rarity = 'rare'
    `);
    
    const rareCount = await client.query(`
      SELECT COUNT(*) as count FROM nfts WHERE rarity = 'rare'
    `);
    
    console.log(`Обновлено ${rareCount.rows[0].count} rare NFT`);
    stats.rare = parseInt(rareCount.rows[0].count);
    
    // Обновление цен для Epic NFTs
    await client.query(`
      UPDATE nfts
      SET price = (5000 + (ABS(MOD(CAST(token_id AS INTEGER), 100)) * 100))::text
      WHERE rarity = 'epic'
    `);
    
    const epicCount = await client.query(`
      SELECT COUNT(*) as count FROM nfts WHERE rarity = 'epic'
    `);
    
    console.log(`Обновлено ${epicCount.rows[0].count} epic NFT`);
    stats.epic = parseInt(epicCount.rows[0].count);
    
    // Обновление цен для Legendary NFTs (самая высокая цена)
    await client.query(`
      UPDATE nfts
      SET price = (12000 + (ABS(MOD(CAST(token_id AS INTEGER), 80)) * 100))::text
      WHERE rarity = 'legendary'
    `);
    
    const legendaryCount = await client.query(`
      SELECT COUNT(*) as count FROM nfts WHERE rarity = 'legendary'
    `);
    
    console.log(`Обновлено ${legendaryCount.rows[0].count} legendary NFT`);
    stats.legendary = parseInt(legendaryCount.rows[0].count);
    
    // Если остались NFT без указанной редкости, даем им минимальную цену
    await client.query(`
      UPDATE nfts
      SET price = '30'
      WHERE rarity IS NULL OR rarity NOT IN ('common', 'uncommon', 'rare', 'epic', 'legendary')
    `);
    
    const otherCount = await client.query(`
      SELECT COUNT(*) as count FROM nfts 
      WHERE rarity IS NULL OR rarity NOT IN ('common', 'uncommon', 'rare', 'epic', 'legendary')
    `);
    
    console.log(`Обновлено ${otherCount.rows[0].count} NFT без редкости`);
    stats.other = parseInt(otherCount.rows[0].count);
    
    console.log('Обновление цен завершено!');
    
    // Получаем статистику по новым ценам после обновления
    const afterStatsResult = await client.query(`
      SELECT 
        MIN(CAST(price AS FLOAT)) as min_price, 
        MAX(CAST(price AS FLOAT)) as max_price,
        AVG(CAST(price AS FLOAT)) as avg_price,
        COUNT(*) as total
      FROM nfts
    `);
    
    const afterStats = afterStatsResult.rows[0];
    console.log(`\nСтатистика после обновления:`);
    console.log(`- Всего NFT: ${afterStats.total}`);
    console.log(`- Минимальная цена: $${Math.round(afterStats.min_price)}`);
    console.log(`- Максимальная цена: $${Math.round(afterStats.max_price)}`);
    console.log(`- Средняя цена: $${Math.round(afterStats.avg_price)}`);
    
    console.log(`\nСтатистика по редкости NFT:`);
    console.log(`- Common: ${stats.common}`);
    console.log(`- Uncommon: ${stats.uncommon}`);
    console.log(`- Rare: ${stats.rare}`);
    console.log(`- Epic: ${stats.epic}`);
    console.log(`- Legendary: ${stats.legendary}`);
    console.log(`- Другие: ${stats.other}`);
    
    console.log('\nОбновление цен NFT успешно завершено!');
    
  } catch (error) {
    console.error('Ошибка при обновлении цен NFT:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Запуск основной функции скрипта
updateNFTPrices()
  .then(() => {
    console.log('Скрипт успешно выполнен');
    process.exit(0);
  })
  .catch(error => {
    console.error('Ошибка выполнения скрипта:', error);
    process.exit(1);
  });
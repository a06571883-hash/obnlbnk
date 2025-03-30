/**
 * Скрипт для проверки и исправления отображения NFT различных ценовых категорий
 * в API маркетплейса
 */

const { Pool } = require('pg');
const { config } = require('dotenv');
const fs = require('fs');
const path = require('path');

// Загрузка переменных окружения из файла .env
config();

// Создание соединения с базой данных
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

/**
 * Проверяет распределение NFT по ценовым категориям
 */
async function checkNFTPriceDistribution() {
  const client = await pool.connect();
  
  try {
    console.log('Проверка распределения NFT по ценам...');
    
    // Создаем ценовые категории
    const priceRanges = [
      { min: 30, max: 100, name: '30$-100$' },
      { min: 101, max: 500, name: '101$-500$' },
      { min: 501, max: 1000, name: '501$-1000$' },
      { min: 1001, max: 5000, name: '1001$-5000$' },
      { min: 5001, max: 10000, name: '5001$-10000$' },
      { min: 10001, max: 20000, name: '10001$-20000$' }
    ];
    
    // Получаем статистику по каждой категории
    for (const range of priceRanges) {
      const result = await client.query(`
        SELECT COUNT(*) AS count
        FROM nfts
        WHERE CAST(price AS FLOAT) >= $1 AND CAST(price AS FLOAT) <= $2 AND for_sale = true
      `, [range.min, range.max]);
      
      console.log(`Категория ${range.name}: ${result.rows[0].count} NFT`);
    }
    
    // Проверяем, какие NFT отдаются в API
    console.log('\nПроверка API эндпоинта маркетплейса...');
    console.log('Симуляция запроса к /api/nft/marketplace...');
    
    const marketQuery = `
      SELECT 
        id, name, description, 
        price, rarity, for_sale,
        MIN(CAST(price AS FLOAT)) AS min_price,
        MAX(CAST(price AS FLOAT)) AS max_price
      FROM nfts 
      WHERE for_sale = true
      GROUP BY id, name, description, price, rarity, for_sale
      ORDER BY CAST(price AS FLOAT) ASC
      LIMIT 50
    `;
    
    const marketResult = await client.query(marketQuery);
    
    console.log(`Первые 50 NFT в маркетплейсе:`);
    console.log(`- Минимальная цена: $${marketResult.rows[0]?.min_price || 'N/A'}`);
    console.log(`- Максимальная цена: $${marketResult.rows[0]?.max_price || 'N/A'}`);
    
    console.log('\nПервые 10 NFT в маркетплейсе:');
    for (let i = 0; i < Math.min(marketResult.rows.length, 10); i++) {
      const nft = marketResult.rows[i];
      console.log(`${i+1}. ID: ${nft.id}, Имя: ${nft.name}, Редкость: ${nft.rarity}, Цена: $${nft.price}`);
    }
    
    // Проверяем самые дорогие NFT
    console.log('\nПроверка самых дорогих NFT...');
    
    const expensiveQuery = `
      SELECT id, name, description, price, rarity, for_sale
      FROM nfts 
      WHERE for_sale = true
      ORDER BY CAST(price AS FLOAT) DESC
      LIMIT 10
    `;
    
    const expensiveResult = await client.query(expensiveQuery);
    
    console.log('Топ-10 самых дорогих NFT:');
    for (let i = 0; i < expensiveResult.rows.length; i++) {
      const nft = expensiveResult.rows[i];
      console.log(`${i+1}. ID: ${nft.id}, Имя: ${nft.name}, Редкость: ${nft.rarity}, Цена: $${nft.price}`);
    }
    
    // Проверяем режим пагинации в API
    console.log('\nПроверка работы пагинации...');
    const limitPerPage = 50;
    let totalPages = 0;
    
    // Общее количество NFT
    const countResult = await client.query(`
      SELECT COUNT(*) as total FROM nfts WHERE for_sale = true
    `);
    
    const totalNFTs = parseInt(countResult.rows[0].total);
    totalPages = Math.ceil(totalNFTs / limitPerPage);
    
    console.log(`Всего NFT на продаже: ${totalNFTs}`);
    console.log(`Количество страниц по ${limitPerPage} NFT: ${totalPages}`);
    
    // Проверяем содержимое последней страницы
    const lastPageOffset = (totalPages - 1) * limitPerPage;
    
    const lastPageQuery = `
      SELECT id, name, description, price, rarity, for_sale
      FROM nfts 
      WHERE for_sale = true
      ORDER BY CAST(price AS FLOAT) ASC
      LIMIT ${limitPerPage} OFFSET ${lastPageOffset}
    `;
    
    const lastPageResult = await client.query(lastPageQuery);
    
    console.log(`\nПоследняя страница (${totalPages}) содержит ${lastPageResult.rows.length} NFT.`);
    console.log('Последние 5 NFT:');
    for (let i = Math.max(0, lastPageResult.rows.length - 5); i < lastPageResult.rows.length; i++) {
      const nft = lastPageResult.rows[i];
      console.log(`${i+1}. ID: ${nft.id}, Имя: ${nft.name}, Редкость: ${nft.rarity}, Цена: $${nft.price}`);
    }
    
    // Сохраняем результаты проверки в файл
    const report = {
      timestamp: new Date().toISOString(),
      totalNFTs,
      totalPages,
      priceRanges: await Promise.all(priceRanges.map(async range => {
        const result = await client.query(`
          SELECT COUNT(*) AS count
          FROM nfts
          WHERE CAST(price AS FLOAT) >= $1 AND CAST(price AS FLOAT) <= $2 AND for_sale = true
        `, [range.min, range.max]);
        
        return {
          range: range.name,
          count: parseInt(result.rows[0].count)
        };
      })),
      cheapestNFTs: marketResult.rows.slice(0, 10).map(nft => ({
        id: nft.id,
        name: nft.name,
        rarity: nft.rarity,
        price: nft.price
      })),
      expensiveNFTs: expensiveResult.rows.map(nft => ({
        id: nft.id,
        name: nft.name,
        rarity: nft.rarity,
        price: nft.price
      }))
    };
    
    fs.writeFileSync(
      path.join(__dirname, 'nft-marketplace-report.json'),
      JSON.stringify(report, null, 2)
    );
    
    console.log('\nПроверка NFT маркетплейса завершена!');
    console.log('Детальный отчет сохранен в файле: nft-marketplace-report.json');
    
  } catch (error) {
    console.error('Ошибка при проверке NFT:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Запускает основную функцию проверки
 */
checkNFTPriceDistribution()
  .then(() => {
    console.log('Скрипт выполнен успешно');
    process.exit(0);
  })
  .catch(error => {
    console.error('Ошибка выполнения скрипта:', error);
    process.exit(1);
  });
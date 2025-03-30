/**
 * Скрипт для исправления статуса NFT на маркетплейсе
 * Проверяет все NFT и обновляет статус for_sale для отображения на маркетплейсе
 */

import pg from 'pg';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();
const { Pool } = pg;

// Получаем параметры подключения из переменных окружения
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function fixNFTMarketplaceStatus() {
  const client = await pool.connect();
  
  try {
    console.log('Начинаем исправление статуса NFT на маркетплейсе...');
    
    // 1. Сначала исправляем статусы в таблице nft (legacy)
    console.log('Исправляем статусы в таблице nft (legacy)...');
    const legacyResult = await client.query(`
      UPDATE nft 
      SET for_sale = true 
      WHERE owner_id = 1 AND for_sale = false
      RETURNING id, token_id, name
    `);
    
    console.log(`Обновлено ${legacyResult.rowCount} NFT в legacy таблице`);
    
    if (legacyResult.rows.length > 0) {
      console.log('Примеры обновленных NFT:');
      legacyResult.rows.slice(0, 5).forEach(nft => {
        console.log(`ID: ${nft.id}, Token ID: ${nft.token_id}, Name: ${nft.name}`);
      });
    }
    
    // 2. Теперь исправляем статусы в таблице nfts (новая Drizzle таблица)
    console.log('Исправляем статусы в таблице nfts (Drizzle)...');
    
    const drizzleResult = await client.query(`
      UPDATE nfts 
      SET for_sale = true 
      WHERE owner_id = 1 AND for_sale = false
      RETURNING id, token_id, name
    `);
    
    console.log(`Обновлено ${drizzleResult.rowCount} NFT в Drizzle таблице`);
    
    if (drizzleResult.rows.length > 0) {
      console.log('Примеры обновленных NFT:');
      drizzleResult.rows.slice(0, 5).forEach(nft => {
        console.log(`ID: ${nft.id}, Token ID: ${nft.token_id}, Name: ${nft.name}`);
      });
    }
    
    console.log('Обновление статусов NFT успешно завершено!');
    
    // 3. Проверка общего количества NFT на продаже
    const legacyCountResult = await client.query(`
      SELECT COUNT(*) as count FROM nft WHERE for_sale = true
    `);
    
    const drizzleCountResult = await client.query(`
      SELECT COUNT(*) as count FROM nfts WHERE for_sale = true
    `);
    
    console.log(`Общее количество NFT на продаже:`);
    console.log(`- В legacy таблице: ${legacyCountResult.rows[0].count}`);
    console.log(`- В Drizzle таблице: ${drizzleCountResult.rows[0].count}`);
    console.log(`Всего: ${parseInt(legacyCountResult.rows[0].count) + parseInt(drizzleCountResult.rows[0].count)}`);
    
  } catch (error) {
    console.error('Ошибка при обновлении статусов NFT:', error);
  } finally {
    client.release();
  }
}

// Выполняем функцию
fixNFTMarketplaceStatus().then(() => {
  console.log('Скрипт завершен');
  process.exit(0);
}).catch(err => {
  console.error('Ошибка при выполнении скрипта:', err);
  process.exit(1);
});
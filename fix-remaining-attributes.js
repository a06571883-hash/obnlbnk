/**
 * Скрипт для исправления оставшихся NFT с устаревшими атрибутами
 */

import pg from 'pg';
import dotenv from 'dotenv';

// Загружаем переменные окружения
dotenv.config();

// Подключение к базе данных
const dbConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? 
    { rejectUnauthorized: false } : false
};

const client = new pg.Client(dbConfig);

/**
 * Обновляет имена атрибутов в оставшихся NFT
 */
async function fixRemainingAttributes() {
  try {
    console.log('Подключение к базе данных...');
    await client.connect();
    console.log('Успешное подключение к базе данных');
    
    // Получаем список оставшихся NFT с устаревшими атрибутами
    const { rows: nfts } = await client.query(`
      SELECT id, token_id, attributes
      FROM nfts
      WHERE attributes ? 'strength' OR attributes ? 'intelligence'
    `);
    
    console.log(`Найдено ${nfts.length} NFT с устаревшими названиями атрибутов`);
    
    for (const nft of nfts) {
      try {
        // Получаем текущие атрибуты
        let attrs = nft.attributes;
        
        // Создаем новый объект атрибутов с правильными ключами
        const newAttrs = {
          power: attrs.strength || 0,
          wisdom: attrs.intelligence || 0,
          luck: attrs.luck || 0,
          agility: attrs.agility || 0
        };
        
        console.log(`Обновление NFT ID ${nft.id}:`);
        console.log(`  Старые атрибуты:`, JSON.stringify(attrs));
        console.log(`  Новые атрибуты:`, JSON.stringify(newAttrs));
        
        // Обновляем запись в базе данных
        await client.query(`
          UPDATE nfts
          SET attributes = $1
          WHERE id = $2
        `, [JSON.stringify(newAttrs), nft.id]);
        
        console.log(`  Успешно обновлено!`);
      } catch (error) {
        console.error(`  Ошибка обновления NFT ID ${nft.id}:`, error.message);
      }
    }
    
    // Проверяем, сколько осталось NFT с устаревшими атрибутами
    const { rows: remaining } = await client.query(`
      SELECT COUNT(*) 
      FROM nfts
      WHERE attributes ? 'strength' OR attributes ? 'intelligence'
    `);
    
    console.log(`\nОбновление завершено! Осталось NFT с устаревшими атрибутами: ${remaining[0].count}`);
    
  } catch (error) {
    console.error('Ошибка при работе с базой данных:', error.message);
  } finally {
    await client.end();
    console.log('Соединение с базой данных закрыто');
  }
}

// Запускаем скрипт
fixRemainingAttributes().catch(console.error);
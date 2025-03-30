/**
 * Скрипт для исправления имен атрибутов в последнем пакете NFT (ID 15001-20000)
 * Заменяет старые ключи (strength, intelligence) на новые (power, wisdom)
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
 * Обновляет имена атрибутов в последнем пакете NFT
 */
async function fixLastBatch() {
  try {
    console.log('Подключение к базе данных...');
    await client.connect();
    console.log('Успешное подключение к базе данных');
    
    // Получаем список NFT с устаревшими атрибутами в диапазоне ID
    const { rows: nfts } = await client.query(`
      SELECT id, token_id, attributes
      FROM nfts
      WHERE (attributes ? 'strength' OR attributes ? 'intelligence')
      AND id BETWEEN 15001 AND 20000
      LIMIT 1000
    `);
    
    console.log(`Найдено ${nfts.length} NFT с устаревшими названиями атрибутов`);
    
    let updatedCount = 0;
    
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
        
        // Обновляем запись в базе данных
        await client.query(`
          UPDATE nfts
          SET attributes = $1
          WHERE id = $2
        `, [JSON.stringify(newAttrs), nft.id]);
        
        updatedCount++;
        
        if (updatedCount % 50 === 0) {
          console.log(`Обновлено ${updatedCount} NFT из ${nfts.length}`);
        }
      } catch (error) {
        console.error(`Ошибка обновления NFT ID ${nft.id}:`, error.message);
      }
    }
    
    console.log(`\nОбновление последнего пакета завершено! Всего обновлено: ${updatedCount} NFT`);
    
  } catch (error) {
    console.error('Ошибка при работе с базой данных:', error.message);
  } finally {
    await client.end();
    console.log('Соединение с базой данных закрыто');
  }
}

// Запускаем скрипт
fixLastBatch().catch(console.error);
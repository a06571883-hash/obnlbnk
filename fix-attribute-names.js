/**
 * Скрипт для исправления имен атрибутов NFT
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
 * Обновляет имена атрибутов в NFT
 */
async function fixAttributeNames() {
  try {
    console.log('Подключение к базе данных...');
    await client.connect();
    console.log('Успешное подключение к базе данных');
    
    // Получаем список NFT с устаревшими атрибутами
    const { rows: nfts } = await client.query(`
      SELECT id, token_id, attributes
      FROM nfts
      WHERE attributes ? 'strength' OR attributes ? 'intelligence'
      LIMIT 1500
    `);
    
    console.log(`Найдено ${nfts.length} NFT с устаревшими названиями атрибутов`);
    
    let updatedCount = 0;
    
    for (const nft of nfts) {
      try {
        // Получаем текущие атрибуты
        let attrs = nft.attributes;
        
        // Создаем новый объект атрибутов
        const newAttrs = {};
        
        // Пропускаем те атрибуты, которые уже существуют в нужном формате
        if (!attrs.power && attrs.strength) {
          newAttrs.power = attrs.strength;
        }
        if (!attrs.wisdom && attrs.intelligence) {
          newAttrs.wisdom = attrs.intelligence;
        }
        
        // Сохраняем другие атрибуты
        if (attrs.luck) newAttrs.luck = attrs.luck;
        if (attrs.agility) newAttrs.agility = attrs.agility;
        
        // Обновляем запись в базе данных
        await client.query(`
          UPDATE nfts
          SET attributes = $1
          WHERE id = $2
        `, [JSON.stringify(newAttrs), nft.id]);
        
        updatedCount++;
        
        if (updatedCount % 100 === 0) {
          console.log(`Обновлено ${updatedCount} NFT из ${nfts.length}`);
        }
      } catch (error) {
        console.error(`Ошибка обновления NFT ID ${nft.id}:`, error.message);
      }
    }
    
    console.log(`\nОбновление имен атрибутов завершено! Всего обновлено: ${updatedCount} NFT`);
    
  } catch (error) {
    console.error('Ошибка при работе с базой данных:', error.message);
  } finally {
    await client.end();
    console.log('Соединение с базой данных закрыто');
  }
}

// Запускаем скрипт
fixAttributeNames().catch(console.error);
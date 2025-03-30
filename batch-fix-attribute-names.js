/**
 * Скрипт для пакетного исправления имен атрибутов NFT
 * Заменяет старые ключи (strength, intelligence) на новые (power, wisdom) в нескольких пакетах
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

/**
 * Обновляет имена атрибутов в пакете NFT
 * @param {number} startId Начальный ID пакета
 * @param {number} endId Конечный ID пакета
 */
async function fixAttributeNamesInBatch(startId, endId) {
  const client = new pg.Client(dbConfig);
  
  try {
    console.log(`\n===== Обработка пакета NFT с ID от ${startId} до ${endId} =====\n`);
    
    await client.connect();
    console.log('Подключение к базе данных установлено');
    
    // Получаем список NFT с устаревшими атрибутами в диапазоне ID
    const { rows: nfts } = await client.query(`
      SELECT id, token_id, attributes
      FROM nfts
      WHERE (attributes ? 'strength' OR attributes ? 'intelligence')
      AND id BETWEEN $1 AND $2
      LIMIT 300
    `, [startId, endId]);
    
    console.log(`Найдено ${nfts.length} NFT с устаревшими названиями атрибутов в пакете ${startId}-${endId}`);
    
    let updatedCount = 0;
    
    for (const nft of nfts) {
      try {
        // Получаем текущие атрибуты
        let attrs = nft.attributes;
        
        // Создаем новый объект атрибутов
        const newAttrs = {};
        
        // Заменяем старые атрибуты на новые
        if (attrs.strength) newAttrs.power = attrs.strength;
        if (attrs.intelligence) newAttrs.wisdom = attrs.intelligence;
        
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
        
        if (updatedCount % 50 === 0) {
          console.log(`Обновлено ${updatedCount} NFT из ${nfts.length}`);
        }
      } catch (error) {
        console.error(`Ошибка обновления NFT ID ${nft.id}:`, error.message);
      }
    }
    
    console.log(`\nОбработка пакета ${startId}-${endId} завершена. Обновлено: ${updatedCount} NFT`);
    
  } catch (error) {
    console.error(`Ошибка при обработке пакета ${startId}-${endId}:`, error.message);
  } finally {
    await client.end();
    console.log(`Соединение с базой данных закрыто для пакета ${startId}-${endId}`);
  }
}

/**
 * Запускает пакетное обновление атрибутов
 */
async function batchFixAttributeNames() {
  // Разбиваем на пакеты по ID
  const batches = [
    { start: 1, end: 5000 },
    { start: 5001, end: 10000 },
    { start: 10001, end: 15000 },
    { start: 15001, end: 20000 }
  ];
  
  for (const batch of batches) {
    await fixAttributeNamesInBatch(batch.start, batch.end);
    
    // Небольшая пауза между пакетами
    console.log('Пауза между пакетами (2 секунды)...');
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\n===== Пакетное обновление имен атрибутов завершено =====');
}

// Запускаем пакетное обновление
batchFixAttributeNames().catch(console.error);
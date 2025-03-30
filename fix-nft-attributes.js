/**
 * Скрипт для исправления атрибутов NFT
 * Решает проблему с отображением NaN в значениях атрибутов
 */

import pg from 'pg';
import dotenv from 'dotenv';
import { randomInt } from 'crypto';

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
 * Определяет редкость NFT на основе его ID
 * @param {number} tokenId ID токена NFT
 * @returns {string} Редкость NFT (common, uncommon, rare, epic, legendary)
 */
function determineRarity(tokenId) {
  const randomValue = (tokenId * 13) % 100;
  
  if (randomValue < 79) return 'common';
  if (randomValue < 93) return 'uncommon';
  if (randomValue < 98) return 'rare';
  if (randomValue < 99.5) return 'epic';
  return 'legendary';
}

/**
 * Генерирует атрибуты для NFT на основе его ID и редкости
 * @param {number} tokenId ID токена NFT
 * @param {string} rarity Редкость NFT
 * @returns {Object} Объект с атрибутами NFT
 */
function generateNFTAttributes(tokenId, rarity) {
  const seed = tokenId * 13;
  
  // Базовые значения на основе редкости
  let powerBase = 0;
  let wisdomBase = 0;
  let luckBase = 0;
  let agilityBase = 0;
  
  switch (rarity) {
    case 'common':
      powerBase = 30;
      wisdomBase = 30;
      luckBase = 30;
      agilityBase = 30;
      break;
    case 'uncommon':
      powerBase = 40;
      wisdomBase = 40;
      luckBase = 40;
      agilityBase = 40;
      break;
    case 'rare':
      powerBase = 50;
      wisdomBase = 50;
      luckBase = 50;
      agilityBase = 50;
      break;
    case 'epic':
      powerBase = 65;
      wisdomBase = 65;
      luckBase = 65;
      agilityBase = 65;
      break;
    case 'legendary':
      powerBase = 80;
      wisdomBase = 80;
      luckBase = 80;
      agilityBase = 80;
      break;
  }
  
  // Генерация атрибутов с небольшой случайностью на основе seed
  function generateAttributeValue(seed, attributeIndex, min, max) {
    const value = (seed * (attributeIndex + 1)) % (max - min) + min;
    return Math.floor(value);
  }
  
  const power = generateAttributeValue(seed, 1, powerBase - 10, powerBase + 10);
  const wisdom = generateAttributeValue(seed, 2, wisdomBase - 10, wisdomBase + 10);
  const luck = generateAttributeValue(seed, 3, luckBase - 10, luckBase + 10);
  const agility = generateAttributeValue(seed, 4, agilityBase - 10, agilityBase + 10);
  
  // Формируем объект с атрибутами, используя ключи, соответствующие фронтенду
  return {
    power,
    wisdom,
    luck,
    agility
  };
}

/**
 * Обновляет атрибуты для всех NFT в базе данных
 */
async function fixNFTAttributes() {
  try {
    console.log('Подключение к базе данных...');
    await client.connect();
    console.log('Успешное подключение к базе данных');
    
    // Получаем список всех NFT с проблемными атрибутами или без атрибутов
    const { rows: nfts } = await client.query(`
      SELECT id, token_id, name, attributes, rarity
      FROM nfts
      WHERE attributes IS NULL OR 
            attributes::text = '{}' OR
            attributes::text = 'null' OR
            attributes::text LIKE '%NaN%' OR
            (attributes ? 'power') = false OR
            (attributes ? 'agility') = false OR
            (attributes ? 'wisdom') = false OR
            (attributes ? 'luck') = false
      LIMIT 2000
    `);
    
    console.log(`Найдено ${nfts.length} NFT с проблемными атрибутами`);
    
    // Обновляем атрибуты для каждого NFT
    let updatedCount = 0;
    let errorCount = 0;
    
    for (const nft of nfts) {
      try {
        const tokenId = parseInt(nft.token_id);
        let rarity = nft.rarity || determineRarity(tokenId);
        
        // Нормализуем редкость
        rarity = rarity.toLowerCase();
        
        // Генерируем атрибуты
        const attributes = generateNFTAttributes(tokenId, rarity);
        
        // Обновляем запись в базе данных
        await client.query(`
          UPDATE nfts
          SET attributes = $1,
              rarity = $2
          WHERE id = $3
        `, [JSON.stringify(attributes), rarity, nft.id]);
        
        updatedCount++;
        if (updatedCount % 100 === 0) {
          console.log(`Обновлено ${updatedCount} NFT из ${nfts.length}`);
        }
      } catch (nftError) {
        console.error(`Ошибка при обновлении NFT ID ${nft.id}:`, nftError.message);
        errorCount++;
      }
    }
    
    console.log(`\nОбновление завершено! Успешно обновлено: ${updatedCount}, ошибок: ${errorCount}`);
    
  } catch (error) {
    console.error('Ошибка при работе с базой данных:', error.message);
  } finally {
    await client.end();
    console.log('Соединение с базой данных закрыто');
  }
}

// Запускаем скрипт
fixNFTAttributes().catch(console.error);
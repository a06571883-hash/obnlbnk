/**
 * Скрипт для завершения импорта NFT до 10000 шт.
 * Добавляет оставшиеся NFT для достижения целевого количества
 */
import fs from 'fs';
import path from 'path';
import https from 'https';
import pg from 'pg';
import { fileURLToPath } from 'url';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Подключение к базе данных PostgreSQL
const client = new Client({
  connectionString: process.env.DATABASE_URL
});

/**
 * Определяет редкость NFT на основе его ID
 * @param {number} tokenId ID токена NFT
 * @returns {string} Редкость NFT (common, uncommon, rare, epic, legendary)
 */
function determineRarity(tokenId) {
  // Используем ID для равномерного распределения редкости
  const hash = tokenId * 13907 % 100;
  
  if (hash < 50) return 'common';      // 50% шанс
  if (hash < 75) return 'uncommon';    // 25% шанс
  if (hash < 90) return 'rare';        // 15% шанс
  if (hash < 98) return 'epic';        // 8% шанс
  return 'legendary';                  // 2% шанс
}

/**
 * Генерирует цену для NFT на основе его идентификатора и редкости
 * @param {number} tokenId ID токена NFT
 * @param {string} rarity Редкость NFT
 * @returns {number} Цена NFT в долларах
 */
function generateNFTPrice(tokenId, rarity) {
  const basePrice = {
    'common': 20,
    'uncommon': 100,
    'rare': 500,
    'epic': 2000,
    'legendary': 10000
  };
  
  // Добавляем вариации цен на основе ID токена
  const priceVariation = (tokenId % 100) / 100; // 0-1 вариация
  let price = basePrice[rarity] * (1 + priceVariation);
  
  // Добавляем случайный множитель для некоторых "звездных" NFT
  if (tokenId % 777 === 0) {
    price *= 5; // Супер редкие NFT в 5 раз дороже
  } else if (tokenId % 111 === 0) {
    price *= 3; // Очень редкие NFT в 3 раза дороже
  }
  
  // Для легендарных, даем шанс стать супер-дорогими
  if (rarity === 'legendary' && tokenId % 50 === 1) {
    price = 300000; // Некоторые легендарные до $300,000
  }
  
  return Math.round(price * 100) / 100; // Округляем до 2 знаков
}

/**
 * Генерирует описание для NFT
 * @param {number} tokenId ID токена NFT
 * @param {string} rarity Редкость NFT
 * @returns {string} Описание NFT
 */
function generateNFTDescription(tokenId, rarity) {
  const rarityDescriptions = {
    'common': 'A standard Mutant Ape with basic mutation features.',
    'uncommon': 'A distinctive Mutant Ape with unique characteristics.',
    'rare': 'A rare Mutant Ape showcasing uncommon mutation patterns.',
    'epic': 'An extraordinary Mutant Ape with remarkable features, rarely seen in the MAYC collection.',
    'legendary': 'A legendary Mutant Ape with exceptional and prominent mutation characteristics, truly one of a kind.'
  };
  
  const baseDescription = `Mutant Ape #${tokenId} - ${rarityDescriptions[rarity]}`;
  
  const additionalDetails = [
    'Part of the exclusive Mutant Ape Yacht Club collection.',
    'Created through exposure to mutant serum.',
    'Features unique mutation characteristics.',
    'Grants access to exclusive MAYC community benefits.',
    'Each Mutant Ape has distinctive traits making it unique in the collection.'
  ];
  
  // Выбираем случайные детали на основе tokenId
  const seed = tokenId % additionalDetails.length;
  const extraDetail = additionalDetails[seed];
  
  return `${baseDescription} ${extraDetail}`;
}

/**
 * Генерирует атрибуты для NFT на основе его ID и редкости
 * @param {number} tokenId ID токена NFT
 * @param {string} rarity Редкость NFT
 * @returns {Object} Объект с атрибутами NFT
 */
function generateNFTAttributes(tokenId, rarity) {
  // Функция для генерации конкретного значения атрибута
  function generateAttributeValue(seed, attributeIndex, min, max) {
    const hash = (seed * 13907 * (attributeIndex + 1)) % 1000;
    return min + Math.floor((hash / 1000) * (max - min));
  }

  const rarityMultiplier = {
    'common': 1,
    'uncommon': 1.2,
    'rare': 1.5,
    'epic': 2,
    'legendary': 3
  };

  // Базовые характеристики с учетом редкости
  const strength = generateAttributeValue(tokenId, 0, 10, 70) * rarityMultiplier[rarity];
  const agility = generateAttributeValue(tokenId, 1, 15, 75) * rarityMultiplier[rarity];
  const intelligence = generateAttributeValue(tokenId, 2, 5, 65) * rarityMultiplier[rarity];
  const mutationLevel = generateAttributeValue(tokenId, 3, 1, 10);
  
  // Специальные способности зависят от комбинации идентификатора и редкости
  const specialAbilities = [
    "Acid Resistance", "Telepathy", "Night Vision",
    "Regeneration", "Super Strength", "Shape Shifting",
    "Energy Absorption", "Flight", "Invisibility",
    "Time Manipulation", "Teleportation", "Psychic Powers"
  ];
  
  const specialAbilityIndex = (tokenId * 13 + rarityMultiplier[rarity] * 5) % specialAbilities.length;
  const specialAbility = specialAbilities[specialAbilityIndex];
  
  // Формируем финальный набор атрибутов
  return {
    strength: Math.round(strength),
    agility: Math.round(agility),
    intelligence: Math.round(intelligence),
    mutationLevel: mutationLevel,
    specialAbility: specialAbility,
    rarity: rarity.charAt(0).toUpperCase() + rarity.slice(1) // Capitalize first letter
  };
}

/**
 * Скачивает изображение для Mutant Ape
 * @param {number} tokenId ID токена
 * @returns {Promise<string>} Путь к сохраненному изображению
 */
async function downloadMutantApeImage(tokenId) {
  const imageDir = path.join(__dirname, 'nft_assets');
  
  // Создаем директорию, если не существует
  if (!fs.existsSync(imageDir)) {
    fs.mkdirSync(imageDir, { recursive: true });
  }
  
  const imagePath = path.join(imageDir, `mutant_ape_${tokenId}.png`);
  
  // Проверяем, существует ли уже файл
  if (fs.existsSync(imagePath)) {
    return imagePath;
  }
  
  // Генерируем уникальный URL на основе tokenId
  const imageUrl = `https://mutantapes.s3.amazonaws.com/${tokenId}.png`;
  
  // Создаем заглушку для изображения (генерируем на основе tokenId)
  return new Promise((resolve) => {
    // Создаем временное изображение, которое будет заменено на реальное, когда появится доступ к API
    const colors = ['#FF5733', '#33FF57', '#3357FF', '#F3FF33', '#FF33F3', '#33FFF3'];
    const colorIndex = tokenId % colors.length;
    const size = 350;
    
    const svgContent = `
      <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="${colors[colorIndex]}" />
        <circle cx="${size/2}" cy="${size/2}" r="${size/3}" fill="${colors[(colorIndex + 2) % colors.length]}" />
        <text x="${size/2}" y="${size/2}" font-family="Arial" font-size="24" text-anchor="middle" fill="white">Mutant Ape #${tokenId}</text>
        <text x="${size/2}" y="${size/2 + 30}" font-family="Arial" font-size="18" text-anchor="middle" fill="white">Rarity: ${determineRarity(tokenId).toUpperCase()}</text>
      </svg>
    `;
    
    fs.writeFileSync(imagePath, svgContent);
    resolve(imagePath);
  });
}

/**
 * Импортирует оставшиеся Mutant Ape NFT
 */
async function importRemainingNFT() {
  try {
    await client.connect();
    
    // Получаем текущее количество NFT
    const countResult = await client.query('SELECT COUNT(*) FROM nfts');
    const currentCount = parseInt(countResult.rows[0].count);
    const targetCount = 10000;
    const remainingCount = targetCount - currentCount;
    
    console.log(`Текущее количество NFT в базе данных: ${currentCount}`);
    console.log(`Необходимо добавить еще ${remainingCount} NFT для достижения целевого количества ${targetCount}`);
    
    if (remainingCount <= 0) {
      console.log('Целевое количество NFT уже достигнуто!');
      return;
    }
    
    // Получаем или создаем коллекцию MAYC
    let maycCollectionId = 11; // По умолчанию используем ID 11
    const collectionResult = await client.query('SELECT id FROM nft_collections WHERE name = $1', ['Mutant Ape Yacht Club']);
    
    if (collectionResult.rows.length === 0) {
      // Создаем коллекцию, если не существует
      const insertCollectionResult = await client.query(
        'INSERT INTO nft_collections (name, description, created_at) VALUES ($1, $2, NOW()) RETURNING id',
        ['Mutant Ape Yacht Club', 'The Mutant Ape Yacht Club is a collection of up to 20,000 Mutant Apes that can only be created by exposing an existing Bored Ape to a vial of MUTANT SERUM or by minting a Mutant Ape in the public sale.']
      );
      maycCollectionId = insertCollectionResult.rows[0].id;
      console.log(`Создана новая коллекция Mutant Ape Yacht Club с ID ${maycCollectionId}`);
    } else {
      maycCollectionId = collectionResult.rows[0].id;
      console.log(`Коллекция Mutant Ape Yacht Club уже существует с ID ${maycCollectionId}`);
    }
    
    // Получаем ID регулятора (пользователь с is_regulator = true)
    const regulatorResult = await client.query('SELECT id FROM users WHERE is_regulator = true LIMIT 1');
    
    if (regulatorResult.rows.length === 0) {
      throw new Error('Не найден пользователь-регулятор для создания NFT');
    }
    
    const regulatorId = regulatorResult.rows[0].id;
    
    // Определяем стартовый индекс для новых NFT
    // Используем высокое значение, чтобы избежать конфликтов с существующими
    let startIndex = 15000;
    
    console.log(`Импорт оставшихся ${remainingCount} Mutant Ape NFT, начиная с индекса ${startIndex}...`);
    
    // Добавляем оставшиеся NFT
    let addedCount = 0;
    
    for (let i = 0; i < remainingCount; i++) {
      const tokenId = startIndex + i;
      const rarity = determineRarity(tokenId);
      const price = generateNFTPrice(tokenId, rarity);
      const description = generateNFTDescription(tokenId, rarity);
      const attributes = generateNFTAttributes(tokenId, rarity);
      
      // Скачиваем изображение
      const imagePath = await downloadMutantApeImage(tokenId);
      const relativeImagePath = path.relative(__dirname, imagePath);
      
      // Добавляем NFT в базу данных
      await client.query(
        `INSERT INTO nfts (
          token_id, name, description, image_path, price, collection_id, 
          owner_id, minted_at, attributes, for_sale, rarity
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8, $9, $10)`,
        [
          tokenId,
          `Mutant Ape #${tokenId}`,
          description,
          relativeImagePath,
          price,
          maycCollectionId,
          regulatorId,
          JSON.stringify(attributes),
          true,
          rarity.toUpperCase()
        ]
      );
      
      addedCount++;
      
      if (addedCount % 10 === 0) {
        console.log(`Добавлено ${addedCount}/${remainingCount} NFT`);
      }
    }
    
    console.log(`Успешно добавлено ${addedCount} NFT!`);
    
    // Проверяем итоговое количество
    const finalCountResult = await client.query('SELECT COUNT(*) FROM nfts');
    console.log(`Итоговое количество NFT в базе данных: ${finalCountResult.rows[0].count}`);
    
  } catch (error) {
    console.error('Ошибка при импорте NFT:', error);
  } finally {
    await client.end();
  }
}

/**
 * Основная функция запуска скрипта
 */
async function main() {
  console.log('Запуск импорта оставшихся NFT до 10000...');
  await importRemainingNFT();
  console.log('Завершен импорт оставшихся NFT!');
}

main().catch(console.error);
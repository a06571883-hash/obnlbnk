/**
 * Скрипт для импорта Bored Ape Yacht Club NFT в базу данных пакетно
 * Добавляет указанный пакет NFT без полной очистки коллекции
 */
import pg from 'pg';
import fs from 'fs';
import path from 'path';
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
  // Используем токен ID как источник энтропии для определения редкости
  const randomValue = (tokenId * 17) % 1000;
  
  if (randomValue < 700) return 'common';       // 70.0%
  if (randomValue < 845) return 'uncommon';     // 14.5%
  if (randomValue < 950) return 'rare';         // 10.5%
  if (randomValue < 990) return 'epic';         // 4.0%
  return 'legendary';                           // 1.0%
}

/**
 * Генерирует цену для NFT на основе его идентификатора и редкости
 * @param {number} tokenId ID токена NFT
 * @param {string} rarity Редкость NFT
 * @returns {number} Цена NFT в долларах
 */
function generateNFTPrice(tokenId, rarity) {
  // Используем hash-подобную функцию для генерации псевдослучайного значения
  const baseValue = (tokenId * 13 + 7) % 1000;
  
  // Базовые диапазоны цен для каждой редкости
  const priceRanges = {
    common: { min: 20, max: 500 },
    uncommon: { min: 500, max: 5000 },
    rare: { min: 5000, max: 20000 },
    epic: { min: 20000, max: 100000 },
    legendary: { min: 100000, max: 300000 }
  };
  
  const range = priceRanges[rarity];
  const priceSpread = range.max - range.min;
  const normalizedValue = baseValue / 1000; // от 0 до 1
  
  // Смещаем нормализованное значение в сторону минимума для редких NFT (делаем кривую распределения)
  let adjustedValue;
  if (rarity === 'epic' || rarity === 'legendary') {
    // Более агрессивное смещение к нижней границе для редких NFT
    adjustedValue = normalizedValue ** 2;
  } else if (rarity === 'rare') {
    // Умеренное смещение
    adjustedValue = normalizedValue ** 1.5;
  } else {
    // Небольшое смещение или равномерное распределение
    adjustedValue = normalizedValue;
  }
  
  const price = Math.round(range.min + (priceSpread * adjustedValue));
  return price;
}

/**
 * Генерирует описание для NFT
 * @param {number} tokenId ID токена NFT
 * @param {string} rarity Редкость NFT
 * @returns {string} Описание NFT
 */
function generateNFTDescription(tokenId, rarity) {
  const descriptions = {
    common: [
      "Обычная обезьяна из коллекции Bored Ape Yacht Club. Представляет стандартный дизайн.",
      "Типичный представитель Bored Ape Yacht Club с базовыми характеристиками.",
      "Простая и распространенная обезьяна, популярная среди новичков в мире NFT."
    ],
    uncommon: [
      "Необычная обезьяна с уникальными чертами, выделяющимися среди других.",
      "Обезьяна с редкими комбинациями признаков, привлекающая внимание коллекционеров.",
      "Интересный экземпляр Bored Ape с особенными характеристиками, которые делают его узнаваемым."
    ],
    rare: [
      "Редкая обезьяна с исключительными чертами, сильно отличающимися от обычных представителей.",
      "Ценный экземпляр Bored Ape с необычными атрибутами и выразительным обликом.",
      "Редкая обезьяна с необычными комбинациями признаков, высоко ценимая в сообществе."
    ],
    epic: [
      "Эпическая обезьяна с экстраординарными чертами, крайне редко встречающимися в коллекции.",
      "Исключительно редкий представитель Bored Ape Yacht Club с уникальным сочетанием атрибутов.",
      "Роскошный экземпляр с впечатляющим дизайном и высокой коллекционной ценностью."
    ],
    legendary: [
      "Легендарная обезьяна с уникальными чертами, являющаяся жемчужиной коллекции.",
      "Один из самых редких и ценных экземпляров Bored Ape, обладающий культовым статусом.",
      "Коронная обезьяна с исключительным дизайном, стоящая на вершине иерархии BAYC."
    ]
  };
  
  // Выбираем случайное описание на основе токен ID
  const descriptionIndex = tokenId % descriptions[rarity].length;
  let description = descriptions[rarity][descriptionIndex];
  
  // Добавляем уникальную информацию для каждого NFT
  description += ` Токен ID: ${tokenId}. Редкость: ${rarity.charAt(0).toUpperCase() + rarity.slice(1)}.`;
  
  return description;
}

/**
 * Генерирует атрибуты для NFT на основе его ID и редкости
 * @param {number} tokenId ID токена NFT
 * @param {string} rarity Редкость NFT
 * @returns {Object} Объект с атрибутами NFT
 */
function generateNFTAttributes(tokenId, rarity) {
  // Генерируем псевдослучайное число на основе токен ID
  function generateAttributeValue(seed, attributeIndex, min, max) {
    const hash = (seed * 17 + attributeIndex * 31) % 1000;
    return min + Math.floor((hash / 1000) * (max - min + 1));
  }
  
  const rarityBoost = {
    common: 0,
    uncommon: 10,
    rare: 20,
    epic: 30,
    legendary: 40
  };
  
  // Создаем базовые атрибуты
  const boost = rarityBoost[rarity] || 0;
  
  return {
    strength: generateAttributeValue(tokenId, 1, 10 + boost, 100 + boost),
    agility: generateAttributeValue(tokenId, 2, 10 + boost, 100 + boost),
    intelligence: generateAttributeValue(tokenId, 3, 10 + boost, 100 + boost),
    charisma: generateAttributeValue(tokenId, 4, 10 + boost, 100 + boost),
    luck: generateAttributeValue(tokenId, 5, 10 + boost, 100 + boost),
    rarity_level: rarity
  };
}

/**
 * Генерирует SVG изображение для NFT
 */
function generateNFTImage(tokenId, rarity) {
  // Генерируем цвета на основе токен ID и редкости
  const colors = {
    common: ['#8a8c90', '#d2d5db', '#e5e7eb'],
    uncommon: ['#34d399', '#6ee7b7', '#a7f3d0'],
    rare: ['#60a5fa', '#93c5fd', '#bfdbfe'],
    epic: ['#f87171', '#fca5a5', '#fecaca'],
    legendary: ['#fbbf24', '#fcd34d', '#fde68a']
  };
  
  const colorSet = colors[rarity] || colors.common;
  const baseColor = colorSet[tokenId % colorSet.length];
  
  // Создаем уникальный паттерн для каждого NFT
  const seed = tokenId * 11;
  const shapes = [];
  
  // Генерируем формы
  for (let i = 0; i < 6; i++) {
    const x = ((seed * (i + 1)) % 100);
    const y = ((seed * (i + 2)) % 100);
    const size = ((seed * (i + 3)) % 40) + 10;
    const rotation = ((seed * (i + 4)) % 360);
    const opacity = (((seed * (i + 5)) % 70) + 30) / 100;
    
    shapes.push(`
      <rect 
        x="${x}%" 
        y="${y}%" 
        width="${size}%" 
        height="${size}%" 
        fill="${colorSet[(i + tokenId) % colorSet.length]}"
        opacity="${opacity}"
        transform="rotate(${rotation}, ${x + size/2}%, ${y + size/2}%)"
      />
    `);
  }
  
  // Создаем градиент для фона
  const gradientId = `gradient-${tokenId}`;
  const gradient = `
    <linearGradient id="${gradientId}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${colorSet[0]}" stop-opacity="0.8" />
      <stop offset="50%" stop-color="${colorSet[1]}" stop-opacity="0.5" />
      <stop offset="100%" stop-color="${colorSet[2]}" stop-opacity="0.8" />
    </linearGradient>
  `;
  
  // Добавляем текст с указанием редкости и номера
  const text = `
    <text 
      x="50%" 
      y="85%" 
      font-family="Arial, sans-serif" 
      font-size="14" 
      font-weight="bold"
      text-anchor="middle"
      fill="white"
    >
      BAYC #${tokenId} - ${rarity.toUpperCase()}
    </text>
  `;
  
  // Создаем лицо обезьяны
  const monkeyFace = `
    <g transform="translate(150, 100) scale(0.8)">
      <!-- Голова -->
      <ellipse cx="50" cy="50" rx="45" ry="45" fill="${baseColor}" />
      
      <!-- Глаза -->
      <circle cx="30" cy="40" r="10" fill="white" />
      <circle cx="70" cy="40" r="10" fill="white" />
      <circle cx="30" cy="40" r="5" fill="black" />
      <circle cx="70" cy="40" r="5" fill="black" />
      
      <!-- Нос -->
      <ellipse cx="50" cy="55" rx="10" ry="5" fill="#333" />
      
      <!-- Рот -->
      <path d="M 30 70 Q 50 80 70 70" stroke="black" stroke-width="3" fill="none" />
    </g>
  `;
  
  // Собираем SVG
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
      <defs>
        ${gradient}
      </defs>
      <rect width="100%" height="100%" fill="url(#${gradientId})" />
      ${shapes.join('')}
      ${monkeyFace}
      ${text}
    </svg>
  `;
}

/**
 * Получает список существующих токен ID для избежания дубликатов
 */
async function getExistingTokenIds() {
  const query = 'SELECT token_id FROM nfts';
  const result = await client.query(query);
  return new Set(result.rows.map(row => row.token_id));
}

/**
 * Добавляет пакет NFT Bored Ape в базу данных
 */
async function addBAYCBatch(startTokenId, batchSize) {
  try {
    console.log(`Добавление пакета BAYC NFT начиная с токена ${startTokenId}, размер пакета: ${batchSize}`);
    
    // Получаем ID коллекции Bored Ape Yacht Club
    const collectionQuery = `
      SELECT id FROM nft_collections 
      WHERE name = 'Bored Ape Yacht Club' 
      LIMIT 1
    `;
    
    const collectionResult = await client.query(collectionQuery);
    
    if (collectionResult.rows.length === 0) {
      throw new Error('Коллекция Bored Ape Yacht Club не найдена');
    }
    
    const collectionId = collectionResult.rows[0].id;
    
    // Получаем список существующих токен ID
    const existingTokenIds = await getExistingTokenIds();
    console.log(`Найдено ${existingTokenIds.size} существующих токен ID в общей базе`);
    
    // Создаем директорию для NFT изображений, если она не существует
    const nftImageDir = './public/assets/nft';
    if (!fs.existsSync(nftImageDir)) {
      fs.mkdirSync(nftImageDir, { recursive: true });
    }
    
    // Для многострочной вставки
    let valueStrings = [];
    let valueParams = [];
    let addedCount = 0;
    let paramIndex = 1;
    
    // Проходим по каждому токен ID в пакете
    for (let i = 0; i < batchSize; i++) {
      let tokenId = startTokenId + i;
      
      // Токен ID для обезьян BAYC начинаем с 20000, чтобы избежать конфликтов с MAYC
      const baycTokenId = tokenId + 20000;
      
      // Проверяем, что такого токен ID еще нет
      if (existingTokenIds.has(baycTokenId.toString())) {
        console.log(`Пропускаем существующий токен ID: ${baycTokenId}`);
        continue;
      }
      
      // Добавляем этот токен ID в список существующих, чтобы избежать дубликатов
      existingTokenIds.add(baycTokenId.toString());
      
      // Определяем редкость и другие атрибуты
      const rarity = determineRarity(baycTokenId);
      const price = generateNFTPrice(baycTokenId, rarity);
      const name = `Bored Ape #${baycTokenId}`;
      const description = generateNFTDescription(baycTokenId, rarity);
      const attributes = generateNFTAttributes(baycTokenId, rarity);
      
      // Создаем изображение (SVG)
      const svgContent = generateNFTImage(baycTokenId, rarity);
      const imagePath = `${nftImageDir}/bored_ape_${baycTokenId}.svg`;
      
      fs.writeFileSync(imagePath, svgContent);
      
      // Добавляем значения для многострочной вставки
      valueStrings.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`);
      
      valueParams.push(
        collectionId,                                         // collection_id
        baycTokenId.toString(),                               // token_id
        name,                                                 // name
        description,                                          // description
        `/public/assets/nft/bored_ape_${baycTokenId}.svg`,    // image_path
        price.toString(),                                     // price
        rarity,                                               // rarity
        JSON.stringify(attributes),                           // attributes
        new Date(),                                           // minted_at
        null,                                                 // owner_id
        true                                                  // for_sale
      );
      
      addedCount++;
    }
    
    // Выполняем массовую вставку
    if (valueStrings.length > 0) {
      const insertQuery = `
        INSERT INTO nfts (
          collection_id, token_id, name, description, image_path, 
          price, rarity, attributes, minted_at, owner_id, for_sale
        ) VALUES 
        ${valueStrings.join(', ')}
      `;
      
      await client.query(insertQuery, valueParams);
    }
    
    // Проверяем финальное количество
    const finalCountQuery = `
      SELECT COUNT(*) FROM nfts 
      WHERE collection_id = (
        SELECT id FROM nft_collections 
        WHERE name = 'Bored Ape Yacht Club'
      )
    `;
    const finalCountResult = await client.query(finalCountQuery);
    const finalCount = parseInt(finalCountResult.rows[0].count);
    
    console.log(`Успешно добавлено ${addedCount} BAYC NFT`);
    console.log(`Количество NFT в коллекции BAYC после добавления пакета: ${finalCount}`);
    
    return { success: true, added: addedCount, total: finalCount };
  } catch (error) {
    console.error('Ошибка при добавлении NFT:', error);
    return { success: false, error: error.message };
  }
}

// Получаем аргументы командной строки
const args = process.argv.slice(2);
const startTokenId = parseInt(args[0] || '0');
const batchSize = parseInt(args[1] || '200');

// Запускаем функцию
async function main() {
  try {
    await client.connect();
    console.log('Подключено к базе данных');
    
    const result = await addBAYCBatch(startTokenId, batchSize);
    
    if (result.success) {
      console.log(`Успешно добавлено ${result.added} NFT. Всего в коллекции: ${result.total}`);
    } else {
      console.error('Произошла ошибка:', result.error);
    }
  } catch (error) {
    console.error('Ошибка при выполнении скрипта:', error);
  } finally {
    await client.end();
    console.log('Соединение с базой данных закрыто');
  }
}

// Запускаем скрипт
main().catch(console.error);
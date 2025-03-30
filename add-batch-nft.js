/**
 * Скрипт для добавления NFT небольшими партиями
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
  const randomValue = (tokenId * 13) % 1000;
  
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
  const baseValue = (tokenId * 17 + 3) % 1000;
  
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
      "Обычный мутант из коллекции Mutant Ape Yacht Club. Представляет стандартную мутацию обезьяны.",
      "Типичный представитель Mutant Ape Yacht Club с базовыми мутациями и стандартным дизайном.",
      "Простой и распространенный мутант, популярный среди новичков в мире NFT."
    ],
    uncommon: [
      "Необычный мутант с уникальными чертами, выделяющимися среди других обезьян.",
      "Мутант с редкими комбинациями признаков, привлекающий внимание коллекционеров.",
      "Интересный экземпляр Mutant Ape с особенными мутациями, которые делают его узнаваемым."
    ],
    rare: [
      "Редкий мутант с исключительными чертами, сильно отличающимися от обычных представителей.",
      "Ценный экземпляр Mutant Ape с необычными мутациями и выразительным обликом.",
      "Редкая обезьяна с необычными комбинациями признаков, высоко ценимая в сообществе."
    ],
    epic: [
      "Эпический мутант с экстраординарными чертами, крайне редко встречающимися в коллекции.",
      "Исключительно редкий представитель Mutant Ape Yacht Club с уникальным сочетанием мутаций.",
      "Роскошный экземпляр с впечатляющим дизайном и высокой коллекционной ценностью."
    ],
    legendary: [
      "Легендарный мутант с уникальными чертами, являющийся жемчужиной коллекции.",
      "Один из самых редких и ценных экземпляров Mutant Ape, обладающий культовым статусом.",
      "Коронная обезьяна с исключительным дизайном, стоящая на вершине иерархии MAYC."
    ]
  };
  
  // Выбираем случайное описание на основе токен ID
  const descriptionIndex = tokenId % descriptions[rarity].length;
  let description = descriptions[rarity][descriptionIndex];
  
  // Добавляем уникальную информацию для каждого NFT
  description += ` Токен ID: ${tokenId}. Мутация уровня: ${rarity.charAt(0).toUpperCase() + rarity.slice(1)}.`;
  
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
    mutation_level: rarity
  };
}

/**
 * Генерирует SVG изображение для NFT
 */
function generateNFTImage(tokenId, rarity) {
  // Генерируем цвета на основе токен ID и редкости
  const colors = {
    common: ['#6c757d', '#adb5bd', '#ced4da'],
    uncommon: ['#28a745', '#5cb85c', '#20c997'],
    rare: ['#007bff', '#0dcaf0', '#6610f2'],
    epic: ['#dc3545', '#fd7e14', '#f8f9fa'],
    legendary: ['#ffc107', '#fd7e14', '#e83e8c']
  };
  
  const colorSet = colors[rarity] || colors.common;
  const baseColor = colorSet[tokenId % colorSet.length];
  
  // Создаем уникальный паттерн для каждого NFT
  const seed = tokenId * 13;
  const shapes = [];
  
  // Генерируем формы
  for (let i = 0; i < 5; i++) {
    const x = ((seed * (i + 1)) % 100);
    const y = ((seed * (i + 2)) % 100);
    const size = ((seed * (i + 3)) % 50) + 10;
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
      MAYC #${tokenId} - ${rarity.toUpperCase()}
    </text>
  `;
  
  // Собираем SVG
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
      <defs>
        ${gradient}
      </defs>
      <rect width="100%" height="100%" fill="url(#${gradientId})" />
      ${shapes.join('')}
      <circle cx="200" cy="150" r="100" fill="${baseColor}" opacity="0.7" />
      <circle cx="160" cy="120" r="20" fill="white" opacity="0.8" />
      <circle cx="240" cy="120" r="20" fill="white" opacity="0.8" />
      <circle cx="160" cy="120" r="10" fill="black" />
      <circle cx="240" cy="120" r="10" fill="black" />
      <path d="M 150 200 Q 200 250 250 200" stroke="black" stroke-width="5" fill="none" />
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
  return new Set(result.rows.map(row => Number(row.token_id)));
}

/**
 * Пакетно добавляет NFT в базу данных
 */
async function addNFTBatch(startTokenId, batchSize) {
  try {
    console.log(`Добавление пакета NFT начиная с токена ${startTokenId}, размер пакета: ${batchSize}`);
    
    // Подключаемся к базе данных
    await client.connect();
    
    // Получаем текущее количество NFT
    const countQuery = 'SELECT COUNT(*) FROM nfts';
    const countResult = await client.query(countQuery);
    const currentCount = parseInt(countResult.rows[0].count);
    
    console.log(`Текущее количество NFT: ${currentCount}`);
    
    // Целевое количество NFT
    const targetCount = 10000;
    const remainingToAdd = targetCount - currentCount;
    
    // Сколько NFT мы действительно добавим в этом пакете
    const actualBatchSize = Math.min(batchSize, remainingToAdd);
    
    if (actualBatchSize <= 0) {
      console.log('Уже достигнуто целевое количество NFT');
      return { success: true, added: 0 };
    }
    
    console.log(`Будет добавлено ${actualBatchSize} NFT в этом пакете`);
    
    // Получаем список существующих токен ID
    const existingTokenIds = await getExistingTokenIds();
    console.log(`Найдено ${existingTokenIds.size} существующих токен ID`);
    
    // Получаем ID коллекции Mutant Ape Yacht Club
    const collectionQuery = `
      SELECT id FROM nft_collections 
      WHERE name = 'Mutant Ape Yacht Club' 
      LIMIT 1
    `;
    
    const collectionResult = await client.query(collectionQuery);
    
    if (collectionResult.rows.length === 0) {
      throw new Error('Коллекция Mutant Ape Yacht Club не найдена');
    }
    
    const collectionId = collectionResult.rows[0].id;
    
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
    for (let i = 0; i < actualBatchSize; i++) {
      let tokenId = startTokenId + i;
      
      // Ищем первый свободный токен ID
      while (existingTokenIds.has(tokenId)) {
        tokenId++;
      }
      
      // Добавляем этот токен ID в список существующих, чтобы избежать дубликатов
      existingTokenIds.add(tokenId);
      
      // Определяем редкость и другие атрибуты
      const rarity = determineRarity(tokenId);
      const price = generateNFTPrice(tokenId, rarity);
      const name = `Mutant Ape #${tokenId}`;
      const description = generateNFTDescription(tokenId, rarity);
      const attributes = generateNFTAttributes(tokenId, rarity);
      
      // Создаем изображение (SVG)
      const svgContent = generateNFTImage(tokenId, rarity);
      const imagePath = `${nftImageDir}/mutant_ape_${tokenId}.svg`;
      
      fs.writeFileSync(imagePath, svgContent);
      
      // Добавляем значения для многострочной вставки
      valueStrings.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`);
      
      valueParams.push(
        collectionId,                                        // collection_id
        tokenId.toString(),                                  // token_id
        name,                                                // name
        description,                                         // description
        `/public/assets/nft/mutant_ape_${tokenId}.svg`,      // image_path
        price.toString(),                                    // price
        rarity,                                              // rarity
        JSON.stringify(attributes),                          // attributes
        new Date(),                                          // minted_at
        null,                                                // owner_id
        true                                                 // for_sale
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
    const finalCountQuery = 'SELECT COUNT(*) FROM nfts';
    const finalCountResult = await client.query(finalCountQuery);
    const finalCount = parseInt(finalCountResult.rows[0].count);
    
    console.log(`Успешно добавлено ${addedCount} NFT`);
    console.log(`Количество NFT после добавления пакета: ${finalCount}`);
    
    return { success: true, added: addedCount, total: finalCount };
  } catch (error) {
    console.error('Ошибка при добавлении NFT:', error);
    return { success: false, error: error.message };
  } finally {
    await client.end();
  }
}

// Получаем аргументы командной строки
const args = process.argv.slice(2);
const startTokenId = parseInt(args[0] || '10000');
const batchSize = parseInt(args[1] || '200');

// Запускаем функцию добавления пакета NFT
addNFTBatch(startTokenId, batchSize).catch(console.error);
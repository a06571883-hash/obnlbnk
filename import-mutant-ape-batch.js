/**
 * Скрипт для импорта коллекции Mutant Ape Yacht Club по частям
 * чтобы избежать превышения лимита времени выполнения
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';

const { Pool } = pg;

// Подключение к базе данных PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Константы и конфигурация
const COLLECTION_NAME = 'Mutant Ape Yacht Club';
const TARGET_TOTAL_NFTS = 10000;
const IMAGE_BASE_DIR = '/home/runner/workspace/public/mayc_official';
const IMAGE_PUBLIC_PATH = '/mayc_official';

// Параметры для пакетного импорта
const BATCH_SIZE = 100; // Сколько NFT добавлять за один запуск скрипта
const START_INDEX = parseInt(process.argv[2] || '1', 10); // Начальный индекс из аргументов командной строки

/**
 * Определяет редкость NFT на основе его ID
 * @param {number} tokenId ID токена NFT
 * @returns {string} Редкость NFT (common, uncommon, rare, epic, legendary)
 */
function determineRarity(tokenId) {
  // Определяем редкость на основе ID токена
  if (tokenId % 100 === 0) return 'legendary'; // Каждый сотый
  if (tokenId % 50 === 0) return 'epic';       // Каждый пятидесятый
  if (tokenId % 20 === 0) return 'rare';       // Каждый двадцатый
  if (tokenId % 5 === 0) return 'uncommon';    // Каждый пятый
  return 'common';                            // Все остальные
}

/**
 * Генерирует цену для NFT на основе его идентификатора и редкости
 * @param {number} tokenId ID токена NFT
 * @param {string} rarity Редкость NFT
 * @returns {number} Цена NFT в долларах
 */
function generateNFTPrice(tokenId, rarity) {
  // Базовая цена зависит от редкости
  const basePriceByRarity = {
    common: 20,
    uncommon: 100,
    rare: 1000,
    epic: 10000,
    legendary: 100000
  };
  
  // Получаем базовую цену
  let basePrice = basePriceByRarity[rarity];
  
  // Добавляем небольшую вариацию в цену на основе ID токена
  const variation = 0.8 + (tokenId % 100) / 100 * 0.4; // Вариация от 80% до 120%
  
  // Округляем цену до двух знаков после запятой
  return parseFloat((basePrice * variation).toFixed(2));
}

/**
 * Генерирует описание для NFT
 * @param {number} tokenId ID токена NFT
 * @param {string} rarity Редкость NFT
 * @returns {string} Описание NFT
 */
function generateNFTDescription(tokenId, rarity) {
  const descriptionsByRarity = {
    common: [
      `Mutant Ape #${tokenId} - Обычный мутант из коллекции MAYC.`,
      `Стандартный Mutant Ape #${tokenId} с базовыми характеристиками.`,
      `Mutant Ape #${tokenId} - Представитель мутантов первого поколения.`,
      `Адаптация приматов к новым условиям. Mutant Ape #${tokenId}.`,
      `Базовый экземпляр мутировавшего примата #${tokenId}.`
    ],
    uncommon: [
      `Необычный Mutant Ape #${tokenId} с редкими признаками мутации.`,
      `Mutant Ape #${tokenId} - Результат успешного эксперимента с мутагеном.`,
      `Нечастый вид мутации #${tokenId} с интересными свойствами.`,
      `Mutant Ape #${tokenId} с необычной генетической структурой.`,
      `Редкий образец второй волны мутации #${tokenId}.`
    ],
    rare: [
      `Редкий Mutant Ape #${tokenId} с уникальными признаками адаптации.`,
      `Выдающийся представитель мутантов #${tokenId} с особыми способностями.`,
      `Экземпляр с высокой степенью мутации #${tokenId}.`,
      `Mutant Ape #${tokenId} - Результат продвинутых генетических изменений.`,
      `Редкий мутант #${tokenId} с исключительной генетической структурой.`
    ],
    epic: [
      `Эпический Mutant Ape #${tokenId} - Легендарный среди мутантов.`,
      `Исключительно редкий экземпляр #${tokenId} с продвинутыми мутациями.`,
      `Mutant Ape #${tokenId} - Один из самых ценных представителей коллекции.`,
      `Эпическая мутация #${tokenId} с неповторимым генетическим кодом.`,
      `Ультраредкий Mutant Ape #${tokenId} с революционными адаптациями.`
    ],
    legendary: [
      `Легендарный Mutant Ape #${tokenId} - Вершина эволюции мутантов.`,
      `Непревзойденная мутация #${tokenId}, единственная в своем роде.`,
      `Mutant Ape #${tokenId} - Абсолютная ценность коллекции MAYC.`,
      `Экземпляр высшего генетического совершенства #${tokenId}.`,
      `Легендарный Mutant Ape #${tokenId} - Результат идеального эксперимента.`
    ]
  };
  
  // Выбираем случайное описание из списка для данной редкости
  const descriptions = descriptionsByRarity[rarity];
  const randomIndex = Math.floor(Math.abs(Math.sin(tokenId) * descriptions.length));
  return descriptions[randomIndex % descriptions.length];
}

/**
 * Генерирует атрибуты для NFT на основе его ID и редкости
 * @param {number} tokenId ID токена NFT
 * @param {string} rarity Редкость NFT
 * @returns {Object} Объект с атрибутами NFT
 */
function generateNFTAttributes(tokenId, rarity) {
  // Диапазоны значений атрибутов в зависимости от редкости
  const attributeRanges = {
    common: { min: 10, max: 40 },
    uncommon: { min: 30, max: 60 },
    rare: { min: 50, max: 80 },
    epic: { min: 70, max: 90 },
    legendary: { min: 85, max: 100 }
  };
  
  const { min, max } = attributeRanges[rarity];
  
  // Создаем "детерминированные" случайные значения на основе tokenId
  function generateAttributeValue(seed, attributeIndex, min, max) {
    // Используем разные "смещения" для разных атрибутов
    const offset = [0.1, 0.3, 0.7, 0.9][attributeIndex];
    // Синус дает псевдослучайное, но детерминированное значение
    const random = Math.abs(Math.sin(seed + offset)) % 1;
    // Масштабируем к нашему диапазону
    return Math.floor(min + random * (max - min));
  }
  
  return {
    power: generateAttributeValue(tokenId, 0, min, max),
    agility: generateAttributeValue(tokenId, 1, min, max),
    wisdom: generateAttributeValue(tokenId, 2, min, max),
    luck: generateAttributeValue(tokenId, 3, min, max)
  };
}

/**
 * Скачивает изображение для Mutant Ape
 * @param {number} tokenId ID токена
 * @returns {Promise<string>} Путь к сохраненному изображению
 */
async function downloadMutantApeImage(tokenId) {
  // Создаем путь для сохранения файла
  const filePath = path.join(IMAGE_BASE_DIR, `mayc_${tokenId}.png`);
  const filePublicPath = `${IMAGE_PUBLIC_PATH}/mayc_${tokenId}.png`;
  
  // Если файл уже существует, просто возвращаем путь
  if (fs.existsSync(filePath)) {
    return filePublicPath;
  }
  
  // Генерируем цвета на основе tokenId
  const hue = (tokenId * 137) % 360;
  const saturation = 70 + (tokenId % 30);
  const lightness = 50 + ((tokenId * 13) % 20);
  
  // Создаем простое изображение для NFT
  const svgContent = `
    <svg width="350" height="350" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="hsl(${hue}, ${saturation}%, ${lightness}%)" />
      <text x="175" y="175" font-family="Arial" font-size="24" text-anchor="middle" fill="white">
        Mutant Ape #${tokenId}
      </text>
      <text x="175" y="210" font-family="Arial" font-size="16" text-anchor="middle" fill="white">
        MAYC Collection
      </text>
    </svg>
  `;
  
  // Сохраняем SVG как файл
  fs.writeFileSync(filePath, svgContent);
  
  return filePublicPath;
}

/**
 * Получает текущее количество NFT в базе данных
 * @returns {Promise<number>} Количество NFT
 */
async function getCurrentNFTCount() {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT COUNT(*) FROM nfts');
    return parseInt(result.rows[0].count);
  } finally {
    client.release();
  }
}

/**
 * Создает коллекцию Mutant Ape Yacht Club, если она не существует
 * @returns {Promise<number>} ID коллекции
 */
async function getOrCreateMAYCCollection() {
  const client = await pool.connect();
  try {
    // Проверяем, существует ли уже коллекция MAYC
    const existingCollection = await client.query(
      'SELECT id FROM nft_collections WHERE name = $1',
      [COLLECTION_NAME]
    );
    
    if (existingCollection.rows.length > 0) {
      console.log(`Коллекция ${COLLECTION_NAME} уже существует с ID ${existingCollection.rows[0].id}`);
      return existingCollection.rows[0].id;
    }
    
    // Если коллекции нет, создаем ее
    console.log(`Создаем коллекцию ${COLLECTION_NAME}...`);
    const result = await client.query(
      'INSERT INTO nft_collections (name, description, user_id, created_at) VALUES ($1, $2, $3, $4) RETURNING id',
      [
        COLLECTION_NAME,
        'Официальная коллекция Mutant Ape Yacht Club - следующая эволюция популярной коллекции BAYC.',
        1, // Предполагаем, что ID 1 - это админ или регулятор
        new Date() // Текущая дата создания
      ]
    );
    
    console.log(`Коллекция ${COLLECTION_NAME} создана с ID ${result.rows[0].id}`);
    return result.rows[0].id;
  } finally {
    client.release();
  }
}

/**
 * Получает информацию о регуляторе или администраторе
 * @returns {Promise<number>} ID регулятора
 */
async function getRegulator() {
  const client = await pool.connect();
  try {
    // Пытаемся найти пользователя-регулятора
    const regulator = await client.query(
      "SELECT id FROM users WHERE is_regulator = true OR username = 'admin' LIMIT 1"
    );
    
    if (regulator.rows.length === 0) {
      console.log('Регулятор не найден, используем ID 1');
      return 1;
    }
    
    return regulator.rows[0].id;
  } finally {
    client.release();
  }
}

/**
 * Импортирует пакет Mutant Ape NFT
 * @param {number} startIndex Начальный индекс
 * @param {number} batchSize Размер пакета
 * @param {number} collectionId ID коллекции MAYC
 * @param {number} regulatorId ID регулятора/владельца NFT
 * @returns {Promise<number>} Количество добавленных NFT
 */
async function importMutantApeBatch(startIndex, batchSize, collectionId, regulatorId) {
  const client = await pool.connect();
  try {
    console.log(`Импорт пакета Mutant Ape NFT с индекса ${startIndex}, размер пакета: ${batchSize}...`);
    
    let addedCount = 0;
    
    for (let i = 0; i < batchSize; i++) {
      const tokenId = startIndex + i;
      const rarity = determineRarity(tokenId);
      const price = generateNFTPrice(tokenId, rarity);
      const description = generateNFTDescription(tokenId, rarity);
      const attributes = generateNFTAttributes(tokenId, rarity);
      
      // Загружаем или генерируем изображение
      const imagePath = await downloadMutantApeImage(tokenId);
      
      // Добавляем NFT в базу данных
      await client.query(`
        INSERT INTO nfts (
          collection_id, owner_id, name, description, 
          image_path, rarity, minted_at, token_id, 
          price, for_sale, attributes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        collectionId,
        regulatorId,
        `Mutant Ape #${tokenId}`,
        description,
        imagePath,
        rarity,
        new Date(),
        tokenId.toString(),
        price.toString(),
        true, // Выставляем на продажу
        JSON.stringify(attributes)
      ]);
      
      addedCount++;
      
      if (addedCount % 10 === 0) {
        process.stdout.write(`Добавлено ${addedCount}/${batchSize} NFT\r`);
      }
    }
    
    console.log(`\nУспешно добавлено ${addedCount} NFT из пакета!`);
    return addedCount;
  } finally {
    client.release();
  }
}

/**
 * Основная функция запуска скрипта
 */
async function main() {
  try {
    console.log(`Запуск импорта пакета Mutant Ape Yacht Club, начиная с индекса ${START_INDEX}...`);
    
    // Шаг 1: Создаем директорию для изображений, если она не существует
    if (!fs.existsSync(IMAGE_BASE_DIR)) {
      fs.mkdirSync(IMAGE_BASE_DIR, { recursive: true });
      console.log(`Создана директория для изображений: ${IMAGE_BASE_DIR}`);
    }
    
    // Шаг 2: Получаем текущее количество NFT
    const currentNFTsCount = await getCurrentNFTCount();
    console.log(`Текущее количество NFT в базе данных: ${currentNFTsCount}`);
    
    // Расчет оставшегося количества NFT для достижения целевого количества
    const remainingToAdd = TARGET_TOTAL_NFTS - currentNFTsCount;
    
    if (remainingToAdd <= 0) {
      console.log(`Целевое количество NFT (${TARGET_TOTAL_NFTS}) уже достигнуто или превышено.`);
      return;
    }
    
    console.log(`Необходимо добавить еще ${remainingToAdd} NFT для достижения целевого количества ${TARGET_TOTAL_NFTS}`);
    
    // Шаг 3: Создаем или получаем коллекцию MAYC
    const collectionId = await getOrCreateMAYCCollection();
    
    // Шаг 4: Получаем ID регулятора
    const regulatorId = await getRegulator();
    
    // Шаг 5: Импортируем пакет Mutant Ape NFT
    const actualBatchSize = Math.min(BATCH_SIZE, remainingToAdd);
    await importMutantApeBatch(START_INDEX, actualBatchSize, collectionId, regulatorId);
    
    // Получаем финальное количество NFT
    const finalCount = await getCurrentNFTCount();
    console.log(`Текущее количество NFT в базе данных после импорта: ${finalCount}`);
    
    // Рассчитываем следующий индекс для последующего импорта
    const nextStartIndex = START_INDEX + actualBatchSize;
    console.log(`Следующий индекс для импорта: ${nextStartIndex}`);
    
    console.log(`Для продолжения импорта выполните команду: node import-mutant-ape-batch.js ${nextStartIndex}`);
    
  } catch (error) {
    console.error('Ошибка при импорте пакета Mutant Ape:', error);
  } finally {
    // Закрываем соединение с базой данных
    await pool.end();
    console.log('Подключение к базе данных закрыто.');
  }
}

// Запускаем скрипт
main();
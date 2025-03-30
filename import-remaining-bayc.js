/**
 * Скрипт для импорта оставшихся NFT из коллекции Bored Ape Yacht Club
 * Заполняет пробелы от текущего максимального token_id до 10,000
 */
import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { createCanvas } from '@napi-rs/canvas';

const { Pool } = pg;
dotenv.config();

// Подключение к PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Константы
const TOTAL_BAYC_NFTS = 10000; // Общее количество NFT в коллекции BAYC
const BATCH_SIZE = 100; // Размер пакета для импорта

/**
 * Определяет редкость NFT на основе его ID
 * @param {number} tokenId ID токена NFT
 * @returns {string} Редкость NFT (common, uncommon, rare, epic, legendary)
 */
function determineRarity(tokenId) {
  // Распределение редкости на основе идентификатора
  if (tokenId < 7000) {
    return 'common'; // 70% - обычные
  } else if (tokenId < 8500) {
    return 'uncommon'; // 15% - необычные
  } else if (tokenId < 9500) {
    return 'rare'; // 10% - редкие
  } else if (tokenId < 9900) {
    return 'epic'; // 4% - эпические
  } else {
    return 'legendary'; // 1% - легендарные
  }
}

/**
 * Генерирует цену для NFT на основе его идентификатора и редкости
 * @param {number} tokenId ID токена NFT
 * @param {string} rarity Редкость NFT
 * @returns {number} Цена NFT в долларах
 */
function generateNFTPrice(tokenId, rarity) {
  // Базовые ценовые диапазоны в зависимости от редкости
  const priceRanges = {
    common: { min: 20, max: 1000 },
    uncommon: { min: 1000, max: 10000 },
    rare: { min: 10000, max: 50000 },
    epic: { min: 50000, max: 150000 },
    legendary: { min: 150000, max: 300000 }
  };

  // Получаем диапазон цен для заданной редкости
  const { min, max } = priceRanges[rarity];
  
  // Используем tokenId как фактор для определения цены внутри диапазона
  // Более высокие tokenId в пределах своей редкости будут стоить дороже
  const range = max - min;
  
  // Генерируем псевдослучайное число на основе tokenId
  const rand = Math.sin(tokenId) * 10000;
  const factor = (rand - Math.floor(rand)) * 0.8 + 0.1; // От 0.1 до 0.9
  
  // Вычисляем цену
  const price = Math.round(min + range * factor);
  
  return price;
}

/**
 * Генерирует описание для NFT
 * @param {number} tokenId ID токена NFT
 * @param {string} rarity Редкость NFT
 * @returns {string} Описание NFT
 */
function generateNFTDescription(tokenId, rarity) {
  const rarityDescriptions = {
    common: "A common Bored Ape with standard traits. Part of the iconic Bored Ape Yacht Club collection, this digital collectible grants membership to the exclusive club and evolving benefits.",
    uncommon: "An uncommon Bored Ape with several desirable traits. This Bored Ape Yacht Club NFT stands out with its distinctive appearance and provides access to the exclusive BAYC community.",
    rare: "A rare Bored Ape featuring sought-after traits and combinations. This exceptional BAYC collectible is highly valued in the NFT community and comes with exclusive membership benefits.",
    epic: "An epic Bored Ape showcasing extremely rare trait combinations. This prized BAYC collectible represents one of the most desirable digital assets in the NFT space.",
    legendary: "A legendary Bored Ape with the rarest trait combinations in the collection. This exceptional BAYC NFT is among the most valuable digital collectibles ever created."
  };

  // Базовое описание на основе редкости
  let description = rarityDescriptions[rarity];
  
  // Добавляем информацию о токене
  description += ` Token ID: ${tokenId}, part of the 10,000 unique Bored Ape NFTs in existence.`;
  
  return description;
}

/**
 * Генерирует атрибуты для NFT на основе его ID и редкости
 * @param {number} tokenId ID токена NFT
 * @param {string} rarity Редкость NFT
 * @returns {Object} Объект с атрибутами NFT
 */
function generateNFTAttributes(tokenId, rarity) {
  // Используем tokenId как seed для генерации псевдослучайных атрибутов
  const seed = tokenId;
  
  // Определяем возможные значения атрибутов
  const backgrounds = ['Blue', 'Orange', 'Purple', 'Yellow', 'Green', 'Red', 'Aquamarine', 'Gray'];
  const furs = ['Brown', 'Black', 'Golden', 'Cream', 'Red', 'Blue', 'Pink', 'Gray', 'White', 'Zombie', 'Robot', 'Alien'];
  const eyes = ['Bored', 'Sleepy', 'Eyepatch', 'Sunglasses', 'Laser Eyes', 'Wide Eyed', 'Zombie Eyes', 'Robot Eyes', '3D Glasses'];
  const clothes = ['Suit', 'Sailor Shirt', 'Striped Shirt', 'Hawaiian Shirt', 'Leather Jacket', 'Smoking Jacket', 'Tweed Suit', 'Kings Robe', 'Ninja Garb', 'Space Suit'];
  const mouths = ['Bored', 'Bored Cigarette', 'Bored Party Horn', 'Grin', 'Angry', 'Dumbfounded', 'Phoneme Oh', 'Phoneme Ooo', 'Small Grin', 'Jovial'];
  const hats = ['None', 'Party Hat', 'Fez', 'Cowboy Hat', 'Captain\'s Hat', 'Crown', 'Fisherman\'s Hat', 'Halo', 'Horns', 'Police Cap', 'Beanie'];
  const earrings = ['None', 'Gold Stud', 'Silver Hoop', 'Gold Hoop', 'Diamond Stud', 'Cross', 'Small Gold'];
  
  // Функция для выбора атрибута с учетом редкости
  function selectAttribute(array, seed, rarityFactor) {
    // Используем сид для генерации псевдослучайного индекса
    const hash = Math.sin(seed) * 10000;
    const normalizedValue = (hash - Math.floor(hash));
    
    // Для более редких NFT повышаем шанс выбора атрибутов из конца массива (предполагается, что более редкие атрибуты в конце)
    let index;
    
    if (rarity === 'common') {
      // Обычные с большей вероятностью получают обычные атрибуты (начало массива)
      index = Math.floor(normalizedValue * (array.length * 0.7));
    } else if (rarity === 'uncommon') {
      // Необычные имеют шанс получить атрибуты из середины массива
      index = Math.floor(normalizedValue * (array.length * 0.9));
    } else if (rarity === 'rare') {
      // Редкие могут получить почти любой атрибут
      index = Math.floor(normalizedValue * array.length);
    } else {
      // Эпические и легендарные с большей вероятностью получают редкие атрибуты (конец массива)
      index = Math.floor(normalizedValue * 0.3 + 0.7) * array.length;
    }
    
    // Проверяем, чтобы индекс был в пределах массива
    index = Math.min(Math.floor(index), array.length - 1);
    
    return array[index];
  }
  
  // Генерируем атрибуты NFT
  const background = selectAttribute(backgrounds, seed * 1.1, rarity);
  const fur = selectAttribute(furs, seed * 2.2, rarity);
  const eye = selectAttribute(eyes, seed * 3.3, rarity);
  const clothe = selectAttribute(clothes, seed * 4.4, rarity);
  const mouth = selectAttribute(mouths, seed * 5.5, rarity);
  const hat = selectAttribute(hats, seed * 6.6, rarity);
  const earring = selectAttribute(earrings, seed * 7.7, rarity);
  
  // Формируем объект с атрибутами
  return {
    background,
    fur,
    eyes: eye,
    clothes: clothe,
    mouth,
    hat,
    earring
  };
}

/**
 * Создает простое изображение-плейсхолдер для NFT
 * @param {number} tokenId Идентификатор токена
 * @param {string} rarity Редкость токена
 * @returns {Promise<string>} Путь к созданному изображению
 */
async function createPlaceholderImage(tokenId, rarity) {
  const width = 500;
  const height = 500;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  
  // Определим цвет фона в зависимости от редкости
  const rarityColors = {
    common: '#7E7E7E',     // Серый
    uncommon: '#4DE94C',   // Зеленый
    rare: '#3914DA',       // Синий
    epic: '#A100DC',       // Фиолетовый
    legendary: '#FFAA00'   // Золотой
  };
  
  // Заполняем фон
  ctx.fillStyle = rarityColors[rarity];
  ctx.fillRect(0, 0, width, height);
  
  // Добавляем текст
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 40px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`Bored Ape #${tokenId}`, width/2, height/2 - 50);
  
  // Добавляем текст с редкостью
  ctx.font = '30px sans-serif';
  ctx.fillText(`Rarity: ${rarity.toUpperCase()}`, width/2, height/2 + 30);
  
  // Добавляем заметку, что это плейсхолдер
  ctx.font = '20px sans-serif';
  ctx.fillText('Placeholder Image', width/2, height/2 + 80);
  
  // Создаем директорию для сохранения, если ее нет
  const dirPath = path.resolve('./public/generated_nft');
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  
  // Путь для сохранения изображения
  const imagePath = path.resolve(dirPath, `bayc_${tokenId}.png`);
  
  // Сохраняем изображение
  fs.writeFileSync(imagePath, canvas.toBuffer('image/png'));
  
  // Возвращаем путь к изображению относительно public
  return `/generated_nft/bayc_${tokenId}.png`;
}

/**
 * Получает максимальный ID токена из существующих NFT
 * @returns {Promise<number>} Максимальный token_id
 */
async function getMaxTokenId() {
  try {
    const client = await pool.connect();
    try {
      const query = `
        SELECT MAX(CAST(token_id AS INTEGER)) as max_token_id
        FROM nfts
      `;
      
      const result = await client.query(query);
      return parseInt(result.rows[0].max_token_id) || -1;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Ошибка при получении максимального token_id:', error);
    throw error;
  }
}

/**
 * Получает информацию о существующей коллекции BAYC
 * @returns {Promise<{id: number, contract_address: string}>} Информация о коллекции
 */
async function getBAYCCollection() {
  try {
    const client = await pool.connect();
    try {
      const query = `
        SELECT id, contract_address 
        FROM nft_collections 
        WHERE name LIKE '%Bored Ape%'
        LIMIT 1
      `;
      
      const result = await client.query(query);
      
      if (result.rows.length === 0) {
        throw new Error('Коллекция Bored Ape Yacht Club не найдена');
      }
      
      return result.rows[0];
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Ошибка при получении информации о коллекции BAYC:', error);
    throw error;
  }
}

/**
 * Получает информацию о регуляторе системы (администраторе)
 * @returns {Promise<{id: number, userId: number}>} Информация о регуляторе
 */
async function getRegulator() {
  try {
    const client = await pool.connect();
    try {
      // Получаем первого регулятора системы
      const query = `
        SELECT id, user_id 
        FROM regulators 
        LIMIT 1
      `;
      
      const result = await client.query(query);
      
      if (result.rows.length === 0) {
        throw new Error('Регулятор не найден');
      }
      
      return {
        id: result.rows[0].id,
        userId: result.rows[0].user_id
      };
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Ошибка при получении информации о регуляторе:', error);
    throw error;
  }
}

/**
 * Импортирует NFT пакетами
 * @param {number} startTokenId Начальный ID токена
 * @param {number} collectionId ID коллекции
 * @param {number} regulatorId ID регулятора
 * @returns {Promise<{success: boolean, created: number, error?: string}>}
 */
async function importNftBatch(startTokenId, collectionId, regulatorId) {
  try {
    console.log(`Импорт пакета NFT с ID от ${startTokenId} до ${Math.min(startTokenId + BATCH_SIZE - 1, TOTAL_BAYC_NFTS - 1)}...`);
    
    const client = await pool.connect();
    let created = 0;
    
    try {
      // Начинаем транзакцию
      await client.query('BEGIN');
      
      // Обрабатываем пакет NFT
      for (let tokenId = startTokenId; tokenId < Math.min(startTokenId + BATCH_SIZE, TOTAL_BAYC_NFTS); tokenId++) {
        // Определяем характеристики NFT
        const rarity = determineRarity(tokenId);
        const price = generateNFTPrice(tokenId, rarity);
        const description = generateNFTDescription(tokenId, rarity);
        const attributes = generateNFTAttributes(tokenId, rarity);
        
        // Создаем плейсхолдер-изображение
        const imagePath = await createPlaceholderImage(tokenId, rarity);
        
        // Форматируем метаданные в JSON
        const metadata = JSON.stringify({
          name: `Bored Ape #${tokenId}`,
          description,
          attributes: Object.entries(attributes).map(([trait_type, value]) => ({
            trait_type,
            value
          })),
          rarity,
          tokenId
        });
        
        // Добавляем NFT в базу данных
        const insertQuery = `
          INSERT INTO nfts (
            token_id, name, description, image_path, metadata, 
            collection_id, creator_id, owner_id, price, status,
            rarity
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          RETURNING id
        `;
        
        const values = [
          tokenId.toString(),
          `Bored Ape #${tokenId}`,
          description,
          imagePath,
          metadata,
          collectionId,
          regulatorId,
          regulatorId,
          price,
          'for_sale',
          rarity
        ];
        
        const result = await client.query(insertQuery, values);
        
        created++;
        
        if (created % 10 === 0) {
          console.log(`Создано ${created} NFT...`);
        }
      }
      
      // Завершаем транзакцию
      await client.query('COMMIT');
      
      console.log(`Успешно создано ${created} NFT`);
      return { success: true, created };
      
    } catch (error) {
      // В случае ошибки отменяем транзакцию
      await client.query('ROLLBACK');
      console.error('Ошибка при импорте пакета NFT:', error);
      return { success: false, created: 0, error: error.message };
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Ошибка при импорте пакета NFT:', error);
    return { success: false, created: 0, error: error.message };
  }
}

/**
 * Основная функция импорта оставшихся NFT
 */
async function importRemainingNFTs() {
  try {
    console.log('Начинаем импорт оставшихся NFT из коллекции Bored Ape Yacht Club...');
    
    // Получаем максимальный token_id из существующих NFT
    const maxTokenId = await getMaxTokenId();
    console.log(`Текущий максимальный token_id: ${maxTokenId}`);
    
    // Получаем информацию о коллекции BAYC
    const collection = await getBAYCCollection();
    console.log(`Найдена коллекция BAYC с ID ${collection.id}`);
    
    // Получаем информацию о регуляторе
    const regulator = await getRegulator();
    console.log(`Найден регулятор с ID ${regulator.id}, user_id ${regulator.userId}`);
    
    // Проверяем, нужно ли импортировать оставшиеся NFT
    if (maxTokenId >= TOTAL_BAYC_NFTS - 1) {
      console.log('Все NFT уже импортированы. Коллекция полная.');
      return;
    }
    
    // Рассчитываем количество оставшихся NFT
    const remainingCount = TOTAL_BAYC_NFTS - (maxTokenId + 1);
    console.log(`Осталось импортировать ${remainingCount} NFT`);
    
    // Создаем директорию для сохранения изображений, если ее нет
    const dirPath = path.resolve('./public/generated_nft');
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`Создана директория ${dirPath} для сохранения изображений`);
    }
    
    // Импортируем оставшиеся NFT пакетами
    let totalCreated = 0;
    let nextTokenId = maxTokenId + 1;
    
    while (nextTokenId < TOTAL_BAYC_NFTS) {
      console.log(`Обработка пакета, начиная с token_id ${nextTokenId}...`);
      
      const importResult = await importNftBatch(nextTokenId, collection.id, regulator.id);
      
      if (!importResult.success) {
        console.error(`Ошибка при импорте пакета: ${importResult.error}`);
        // Пробуем продолжить с следующего пакета
        nextTokenId += BATCH_SIZE;
        continue;
      }
      
      totalCreated += importResult.created;
      nextTokenId += BATCH_SIZE;
      
      console.log(`Прогресс: импортировано ${totalCreated} из ${remainingCount} оставшихся NFT`);
      
      // Пауза между пакетами, чтобы не перегрузить систему
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`Импорт успешно завершен. Всего создано ${totalCreated} новых NFT.`);
    
  } catch (error) {
    console.error('Ошибка при импорте оставшихся NFT:', error);
  }
}

/**
 * Основная функция запуска скрипта
 */
async function main() {
  try {
    // Импортировать оставшиеся NFT
    await importRemainingNFTs();
    
    // Проверить общее количество NFT
    const client = await pool.connect();
    try {
      const countQuery = `SELECT COUNT(*) as count FROM nfts`;
      const countResult = await client.query(countQuery);
      const totalCount = parseInt(countResult.rows[0].count);
      
      console.log(`Всего уникальных NFT в базе данных: ${totalCount}`);
      
      // Если импорт прошел успешно, запустить скрипт нормализации token_id
      if (totalCount > 0) {
        console.log('Запуск нормализации token_id...');
        
        // Нормализовать token_id
        const normalizeQuery = `
          WITH numbered AS (
            SELECT id, ROW_NUMBER() OVER (ORDER BY CAST(token_id AS INTEGER) ASC) - 1 as new_token_id
            FROM nfts
          )
          UPDATE nfts
          SET token_id = numbered.new_token_id::text
          FROM numbered
          WHERE nfts.id = numbered.id AND nfts.token_id != numbered.new_token_id::text
        `;
        
        const normalizeResult = await client.query(normalizeQuery);
        console.log(`Нормализовано ${normalizeResult.rowCount} token_id`);
      }
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Ошибка при выполнении скрипта:', error);
  } finally {
    // Закрыть подключение к базе данных
    await pool.end();
    console.log('Скрипт завершен.');
  }
}

// Запустить скрипт
main();
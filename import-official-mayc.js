/**
 * Скрипт для импорта официальной коллекции Mutant Ape Yacht Club с OpenSea
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import https from 'https';
import axios from 'axios';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const { Pool } = pg;

// Подключение к базе данных PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Константы и конфигурация
const COLLECTION_NAME = 'Mutant Ape Yacht Club';
const OPENSEA_COLLECTION = 'mutant-ape-yacht-club';
const BASE_DIR = './mutant_ape_official';
const IMAGE_PUBLIC_PATH = '/mutant_ape_official';
const BATCH_SIZE = 20; // Количество NFT для скачивания за один раз
const MAX_RETRIES = 3;  // Максимальное количество попыток загрузки
const DELAY_BETWEEN_BATCHES = 2000; // Задержка между запросами (в мс)

// Создаем директорию для хранения изображений, если её нет
if (!fs.existsSync(BASE_DIR)) {
  fs.mkdirSync(BASE_DIR, { recursive: true });
  console.log(`Создана директория для изображений: ${BASE_DIR}`);
}

/**
 * Задержка для соблюдения ограничений API
 * @param {number} ms Время задержки в миллисекундах
 * @returns {Promise<void>}
 */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Загружает метаданные NFT с OpenSea 
 * @param {number} offset Смещение для загрузки партии NFT
 * @param {number} limit Количество NFT для загрузки
 * @returns {Promise<Array>} Массив метаданных NFT
 */
async function fetchNFTsFromOpenSea(offset, limit) {
  try {
    // Используем API для получения коллекции
    const url = `https://api.opensea.io/api/v1/assets?collection=${OPENSEA_COLLECTION}&limit=${limit}&offset=${offset}`;
    
    const response = await axios.get(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (response.status === 200 && response.data && response.data.assets) {
      return response.data.assets;
    } else {
      console.error('Ошибка получения данных от OpenSea API:', response.status);
      return [];
    }
  } catch (error) {
    console.error(`Ошибка загрузки данных с OpenSea:`, error.message);
    return [];
  }
}

/**
 * Скачивает изображение NFT и сохраняет его локально
 * @param {string} imageUrl URL изображения
 * @param {number} tokenId Идентификатор токена
 * @returns {Promise<string>} Путь к сохраненному изображению
 */
async function downloadNFTImage(imageUrl, tokenId) {
  return new Promise(async (resolve, reject) => {
    // Если URL не указан, возвращаем null
    if (!imageUrl) {
      console.warn(`Отсутствует URL изображения для токена ${tokenId}`);
      return resolve(null);
    }
    
    const filePath = path.join(BASE_DIR, `mutant_ape_${tokenId.toString().padStart(4, '0')}.png`);
    const publicPath = `${IMAGE_PUBLIC_PATH}/mutant_ape_${tokenId.toString().padStart(4, '0')}.png`;
    
    // Если файл уже существует, просто возвращаем путь
    if (fs.existsSync(filePath)) {
      console.log(`Изображение для токена ${tokenId} уже существует: ${filePath}`);
      return resolve(publicPath);
    }
    
    // Создаем временный файл для загрузки
    const tempPath = `${filePath}.tmp`;
    
    let retries = 0;
    let success = false;
    
    while (!success && retries < MAX_RETRIES) {
      try {
        retries++;
        const writer = fs.createWriteStream(tempPath);
        
        const response = await axios({
          url: imageUrl,
          method: 'GET',
          responseType: 'stream',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });
        
        response.data.pipe(writer);
        
        await new Promise((resolve, reject) => {
          writer.on('finish', resolve);
          writer.on('error', reject);
        });
        
        // Переименовываем временный файл в конечный
        fs.renameSync(tempPath, filePath);
        success = true;
        console.log(`Изображение для токена ${tokenId} успешно загружено: ${filePath}`);
        
      } catch (error) {
        console.error(`Ошибка при загрузке изображения для токена ${tokenId} (попытка ${retries}):`, error.message);
        
        // Удаляем временный файл в случае ошибки
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
        
        // Небольшая задержка перед повторной попыткой
        await delay(1000);
      }
    }
    
    if (success) {
      resolve(publicPath);
    } else {
      console.error(`Не удалось загрузить изображение для токена ${tokenId} после ${MAX_RETRIES} попыток`);
      resolve(null);
    }
  });
}

/**
 * Определяет редкость NFT на основе его атрибутов
 * @param {Array} traits Массив атрибутов NFT
 * @returns {string} Редкость NFT (common, uncommon, rare, epic, legendary)
 */
function determineRarityFromTraits(traits) {
  if (!traits || traits.length === 0) {
    return 'common';
  }
  
  // Ищем редкие атрибуты
  const rareTraits = traits.filter(trait => 
    trait.trait_count < 100 || 
    (trait.trait_type && trait.trait_type.toLowerCase().includes('legendary'))
  );
  
  if (rareTraits.length >= 3) {
    return 'legendary';
  } else if (rareTraits.length === 2) {
    return 'epic';
  } else if (rareTraits.length === 1) {
    return 'rare';
  } else {
    // Проверяем наличие необычных атрибутов
    const uncommonTraits = traits.filter(trait => 
      trait.trait_count < 500 ||
      (trait.trait_type && trait.trait_type.toLowerCase().includes('rare'))
    );
    
    return uncommonTraits.length > 0 ? 'uncommon' : 'common';
  }
}

/**
 * Генерирует цену NFT на основе редкости и атрибутов
 * @param {number} tokenId ID токена NFT
 * @param {string} rarity Редкость NFT
 * @param {Array} traits Атрибуты NFT
 * @returns {number} Цена NFT в долларах
 */
function generateNFTPrice(tokenId, rarity, traits) {
  // Базовая цена зависит от редкости
  const basePriceByRarity = {
    common: 50,
    uncommon: 150,
    rare: 500,
    epic: 2000,
    legendary: 10000
  };
  
  // Получаем базовую цену по редкости
  let price = basePriceByRarity[rarity];
  
  // Добавляем премию за количество атрибутов
  if (traits && traits.length > 0) {
    price += (traits.length * 50);
    
    // Добавляем бонус за особо редкие атрибуты
    traits.forEach(trait => {
      if (trait.trait_count && trait.trait_count < 50) {
        price += 1000;
      } else if (trait.trait_count && trait.trait_count < 200) {
        price += 300;
      }
    });
  }
  
  // Добавляем случайную вариацию в цену (±10%)
  const variation = 0.9 + Math.abs(Math.sin(tokenId) * 0.2);
  price = Math.round(price * variation);
  
  return price;
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
        'Официальная коллекция Mutant Ape Yacht Club с OpenSea - эксклюзивная коллекция мутировавших обезьян из популярной серии BAYC.',
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
 * Проверяет, существует ли NFT с указанным token_id
 * @param {string} tokenId ID токена
 * @param {number} collectionId ID коллекции
 * @returns {Promise<boolean>} true если NFT уже существует
 */
async function nftExists(tokenId, collectionId) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT id FROM nfts WHERE token_id = $1 AND collection_id = $2',
      [tokenId.toString(), collectionId]
    );
    return result.rows.length > 0;
  } finally {
    client.release();
  }
}

/**
 * Основная функция для импорта NFT с OpenSea
 */
async function importMAYCFromOpenSea() {
  console.log('Начинаем импорт Mutant Ape Yacht Club с OpenSea...');
  
  const collectionId = await getOrCreateMAYCCollection();
  const regulatorId = await getRegulator();
  
  let offset = 0;
  let totalImported = 0;
  let hasMore = true;
  
  while (hasMore) {
    console.log(`Загрузка партии NFT: offset=${offset}, limit=${BATCH_SIZE}`);
    
    const assets = await fetchNFTsFromOpenSea(offset, BATCH_SIZE);
    
    if (!assets || assets.length === 0) {
      console.log('Больше NFT не найдено или возникла ошибка при загрузке.');
      hasMore = false;
      break;
    }
    
    console.log(`Получено ${assets.length} NFT.`);
    
    const client = await pool.connect();
    try {
      for (const asset of assets) {
        if (!asset.token_id) {
          console.warn('Пропуск NFT без token_id');
          continue;
        }
        
        const tokenId = parseInt(asset.token_id);
        
        // Проверяем, существует ли NFT с этим tokenId
        const exists = await nftExists(tokenId, collectionId);
        if (exists) {
          console.log(`NFT с token_id ${tokenId} уже существует, пропускаем...`);
          continue;
        }
        
        console.log(`Обработка NFT: ${asset.name || 'Без имени'} (ID: ${tokenId})`);
        
        // Загружаем изображение
        const imagePath = await downloadNFTImage(
          asset.image_url || asset.image_preview_url,
          tokenId
        );
        
        if (!imagePath) {
          console.warn(`Не удалось загрузить изображение для ${asset.name || 'NFT'} (ID: ${tokenId}), пропускаем...`);
          continue;
        }
        
        // Определяем редкость и генерируем цену
        const rarity = determineRarityFromTraits(asset.traits);
        const price = generateNFTPrice(tokenId, rarity, asset.traits);
        
        // Формируем атрибуты
        const attributes = {};
        if (asset.traits && asset.traits.length > 0) {
          asset.traits.forEach(trait => {
            if (trait.trait_type && trait.value) {
              // Преобразуем имена атрибутов к нашему стандарту
              const attributeName = trait.trait_type.toLowerCase()
                .replace(/background/i, 'background_color')
                .replace(/fur/i, 'fur_color')
                .replace(/eyes/i, 'eye_color')
                .replace(/clothes/i, 'clothing')
                .replace(/hat/i, 'headwear');
                
              attributes[attributeName] = trait.value;
            }
          });
        } else {
          // Если атрибуты отсутствуют, добавляем базовые
          attributes.power = Math.floor(50 + (Math.random() * 50));
          attributes.agility = Math.floor(50 + (Math.random() * 50));
          attributes.wisdom = Math.floor(50 + (Math.random() * 50));
          attributes.luck = Math.floor(50 + (Math.random() * 50));
        }
        
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
          asset.name || `Mutant Ape #${tokenId}`,
          asset.description || `Официальный Mutant Ape #${tokenId} из коллекции MAYC.`,
          imagePath,
          rarity,
          new Date(),
          tokenId.toString(),
          price.toString(),
          true, // Выставляем на продажу
          JSON.stringify(attributes)
        ]);
        
        totalImported++;
        console.log(`Успешно импортирован ${asset.name || `Mutant Ape #${tokenId}`} (${totalImported} всего)`);
      }
    } finally {
      client.release();
    }
    
    offset += assets.length;
    
    // Если получили меньше элементов, чем запросили, значит больше нет
    if (assets.length < BATCH_SIZE) {
      hasMore = false;
    } else {
      // Делаем паузу между запросами, чтобы не перегружать API
      console.log(`Пауза ${DELAY_BETWEEN_BATCHES}ms перед следующим запросом...`);
      await delay(DELAY_BETWEEN_BATCHES);
    }
  }
  
  console.log(`Импорт завершен! Всего импортировано ${totalImported} NFT из коллекции Mutant Ape Yacht Club.`);
}

/**
 * Основная функция запуска скрипта
 */
async function main() {
  try {
    await importMAYCFromOpenSea();
  } catch (error) {
    console.error('Ошибка при импорте коллекции:', error);
  } finally {
    // Закрываем соединение с базой данных
    await pool.end();
    console.log('Подключение к базе данных закрыто.');
  }
}

// Запускаем скрипт
main();
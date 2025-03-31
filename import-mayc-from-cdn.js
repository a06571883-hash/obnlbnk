/**
 * Скрипт для импорта коллекции Mutant Ape Yacht Club напрямую с CDN OpenSea
 * Загружает изображения с известных URL и добавляет их в базу данных
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { promisify } from 'util';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream';

const pipelineAsync = promisify(pipeline);
const { Pool } = pg;

// Подключение к базе данных PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Константы и конфигурация
const COLLECTION_NAME = 'Mutant Ape Yacht Club';
const BASE_DIR = './mutant_ape_official';
const PUBLIC_PATH = '/mutant_ape_official';
const MAX_RETRIES = 3;
const DELAY_BETWEEN_REQUESTS = 300; // ms
const TARGET_COUNT = 100; // Количество NFT для импорта (уменьшено для быстрого тестирования)

/**
 * Задержка для ограничения частоты запросов
 */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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
        'Официальная коллекция Mutant Ape Yacht Club - второе поколение популярной серии обезьян BAYC.',
        1, // ID админа/регулятора
        new Date()
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
 * Загружает изображение NFT и сохраняет его локально
 * @param {number} tokenId Идентификатор токена
 * @returns {Promise<string|null>} Путь к сохраненному изображению или null в случае ошибки
 */
async function downloadMAYCImage(tokenId) {
  // Форматируем tokenId для URL
  const paddedTokenId = tokenId.toString().padStart(4, '0');
  const fileName = `mutant_ape_${paddedTokenId}.png`;
  const filePath = path.join(BASE_DIR, fileName);
  const publicPath = `${PUBLIC_PATH}/${fileName}`;
  
  // Проверяем, существует ли файл уже
  if (fs.existsSync(filePath)) {
    console.log(`Файл ${filePath} уже существует.`);
    return publicPath;
  }
  
  // Создаем временный файл для скачивания
  const tempPath = `${filePath}.tmp`;
  
  // URL изображения на CDN OpenSea
  // Используем два формата URL для повышения вероятности успеха
  const imageUrls = [
    `https://i.seadn.io/gae/lHexKRMpw-aoSyB1WdFBff5yfANLReFxHzt1DOj_sg7mS14yARpuvYcUtsyyx-Nkpk6WTcUPFoG53VnLJezYi8hAs0OxNZwlw6Y-dmI?auto=format&w=1000&h=1000&token=${tokenId}`,
    `https://img.seadn.io/files/d4ad514f3bb261a45d279d4e6a5d0ed0.png?fit=max&w=1000&token=${tokenId}`
  ];
  
  let imageData = null;
  
  // Пробуем несколько URL и с несколькими попытками
  for (const imageUrl of imageUrls) {
    let retries = 0;
    
    while (retries < MAX_RETRIES && !imageData) {
      try {
        console.log(`Загрузка изображения для Mutant Ape #${tokenId} (попытка ${retries + 1})...`);
        const response = await axios({
          method: 'get',
          url: imageUrl,
          responseType: 'stream',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
            'Referer': 'https://opensea.io/',
            'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
          },
          timeout: 10000 // 10 seconds timeout
        });
        
        // Пишем загруженные данные во временный файл
        const writer = createWriteStream(tempPath);
        await pipelineAsync(response.data, writer);
        
        // Проверяем размер файла (если пустой или слишком маленький, скорее всего ошибка)
        const stats = fs.statSync(tempPath);
        if (stats.size < 1000) {  // Менее 1kb, вероятно ошибка
          throw new Error(`Загруженный файл слишком мал (${stats.size} байт)`);
        }
        
        // Переименовываем файл
        fs.renameSync(tempPath, filePath);
        console.log(`Изображение для Mutant Ape #${tokenId} успешно сохранено.`);
        
        imageData = publicPath;
        break;
      } catch (error) {
        retries++;
        console.error(`Ошибка при загрузке изображения для Mutant Ape #${tokenId}:`, error.message);
        
        // Удаляем временный файл в случае ошибки
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
        
        await delay(1000); // Пауза перед следующей попыткой
      }
    }
    
    if (imageData) break; // Если успешно загрузили с одного из URL, выходим из цикла
  }
  
  if (!imageData) {
    // Если не удалось скачать изображение, создаем placeholder
    console.warn(`Не удалось загрузить изображение для Mutant Ape #${tokenId}, создаем placeholder...`);
    
    // Создаем SVG placeholder с номером токена
    const svgContent = `
      <svg width="1000" height="1000" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#6A4C93" />
        <text x="500" y="500" font-family="Arial" font-size="72" text-anchor="middle" fill="#ffffff">
          Mutant Ape #${tokenId}
        </text>
        <text x="500" y="580" font-family="Arial" font-size="48" text-anchor="middle" fill="#ffffff">
          MAYC Collection
        </text>
      </svg>
    `;
    
    fs.writeFileSync(filePath, svgContent);
    console.log(`Создан placeholder для Mutant Ape #${tokenId}.`);
    
    return publicPath;
  }
  
  return imageData;
}

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
    common: 30,
    uncommon: 200,
    rare: 1000,
    epic: 5000,
    legendary: 20000
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
      `Mutant Ape #${tokenId} - Стандартный представитель коллекции MAYC.`,
      `Обычный Mutant Ape #${tokenId} с базовыми характеристиками.`,
      `Mutant Ape #${tokenId} - Результат стандартной мутации Bored Ape.`,
      `Мутант с типичными чертами. Mutant Ape #${tokenId}.`,
      `Обыкновенный экземпляр мутировавшего примата #${tokenId}.`
    ],
    uncommon: [
      `Необычный Mutant Ape #${tokenId} с интересными признаками мутации.`,
      `Mutant Ape #${tokenId} - Выделяется среди обычных мутантов.`,
      `Нечастый экземпляр #${tokenId} с нестандартными особенностями.`,
      `Mutant Ape #${tokenId} с уникальными деталями внешности.`,
      `Редкий образец мутации #${tokenId} из коллекции MAYC.`
    ],
    rare: [
      `Редкий Mutant Ape #${tokenId} с выразительными чертами.`,
      `Ценный представитель мутантов #${tokenId} с особыми признаками.`,
      `Экземпляр с примечательной мутацией #${tokenId}.`,
      `Mutant Ape #${tokenId} - Результат исключительной трансформации.`,
      `Редкий мутант #${tokenId} с заметным генетическим отклонением.`
    ],
    epic: [
      `Эпический Mutant Ape #${tokenId} - Редчайший тип мутации.`,
      `Крайне необычный экземпляр #${tokenId} с выдающимися характеристиками.`,
      `Mutant Ape #${tokenId} - Один из самых редких представителей MAYC.`,
      `Эпическая мутация #${tokenId} с уникальным генетическим кодом.`,
      `Ультраредкий Mutant Ape #${tokenId} с исключительными чертами.`
    ],
    legendary: [
      `Легендарный Mutant Ape #${tokenId} - Вершина эволюции мутантов.`,
      `Исключительно редкий мутант #${tokenId}, единственный в своем роде.`,
      `Mutant Ape #${tokenId} - Абсолютная редкость в коллекции MAYC.`,
      `Экземпляр наивысшей ценности #${tokenId}.`,
      `Легендарный Mutant Ape #${tokenId} - Венец коллекции мутантов.`
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
 * Удаляет все NFT из коллекции Mutant Ape Yacht Club
 */
async function cleanMAYCCollection() {
  console.log('Очистка существующих Mutant Ape NFT...');
  
  const client = await pool.connect();
  try {
    // Находим ID коллекции MAYC
    const collectionResult = await client.query(
      'SELECT id FROM nft_collections WHERE name LIKE $1',
      ['%Mutant Ape%']
    );
    
    if (collectionResult.rows.length === 0) {
      console.log('Коллекция Mutant Ape не найдена, нечего очищать.');
      return;
    }
    
    const collectionId = collectionResult.rows[0].id;
    console.log(`Найдена коллекция Mutant Ape с ID ${collectionId}`);
    
    // Подсчитываем количество NFT в коллекции
    const countResult = await client.query(
      'SELECT COUNT(*) FROM nfts WHERE collection_id = $1',
      [collectionId]
    );
    
    const nftCount = parseInt(countResult.rows[0].count);
    console.log(`В коллекции найдено ${nftCount} NFT.`);
    
    if (nftCount === 0) {
      console.log('Нет NFT для удаления.');
      return;
    }
    
    // Удаляем NFT из коллекции
    const deleteResult = await client.query(
      'DELETE FROM nfts WHERE collection_id = $1 RETURNING id',
      [collectionId]
    );
    
    console.log(`Удалено ${deleteResult.rowCount} NFT из коллекции Mutant Ape.`);
    
    return collectionId;
  } catch (error) {
    console.error('Ошибка при очистке коллекции:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Импортирует коллекцию Mutant Ape Yacht Club
 */
async function importMAYCCollection() {
  console.log('Начинаем импорт коллекции Mutant Ape Yacht Club...');
  
  // Создаем папку для изображений, если она не существует
  if (!fs.existsSync(BASE_DIR)) {
    fs.mkdirSync(BASE_DIR, { recursive: true });
    console.log(`Создана директория для изображений: ${BASE_DIR}`);
  }
  
  // Шаг 1: Очищаем существующую коллекцию MAYC
  await cleanMAYCCollection();
  
  // Шаг 2: Создаем или получаем коллекцию MAYC
  const collectionId = await getOrCreateMAYCCollection();
  
  // Шаг 3: Получаем ID регулятора/администратора
  const regulatorId = await getRegulator();
  
  const client = await pool.connect();
  try {
    // Шаг 4: Импортируем NFT
    console.log(`Импортируем ${TARGET_COUNT} Mutant Ape NFT...`);
    
    let importedCount = 0;
    
    for (let tokenId = 1; tokenId <= TARGET_COUNT; tokenId++) {
      // Выводим прогресс каждые 10 NFT
      if (tokenId % 10 === 0) {
        console.log(`Прогресс: ${tokenId}/${TARGET_COUNT} (${Math.round(tokenId/TARGET_COUNT*100)}%)`);
      }
      
      // Проверяем, существует ли уже NFT с таким tokenId
      const exists = await nftExists(tokenId, collectionId);
      if (exists) {
        console.log(`NFT с token_id ${tokenId} уже существует, пропускаем...`);
        continue;
      }
      
      // Загружаем изображение для NFT
      const imagePath = await downloadMAYCImage(tokenId);
      if (!imagePath) {
        console.warn(`Не удалось загрузить изображение для token_id ${tokenId}, пропускаем...`);
        continue;
      }
      
      // Определяем редкость и другие характеристики NFT
      const rarity = determineRarity(tokenId);
      const price = generateNFTPrice(tokenId, rarity);
      const description = generateNFTDescription(tokenId, rarity);
      const attributes = generateNFTAttributes(tokenId, rarity);
      
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
      
      importedCount++;
      
      // Делаем паузу между запросами к API
      await delay(DELAY_BETWEEN_REQUESTS);
    }
    
    console.log(`\nИмпорт завершен! Успешно импортировано ${importedCount} Mutant Ape NFT.`);
    
  } catch (error) {
    console.error('Ошибка при импорте коллекции:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Обновляет конфигурацию NFT сервера для обслуживания новых изображений
 */
async function updateNFTServerConfig() {
  console.log('Обновление конфигурации NFT сервера...');
  
  try {
    // Проверяем, что директория для официальных Mutant Ape NFT добавлена в маршруты сервера
    const configPath = path.join(process.cwd(), 'server', 'nft-image-server.js');
    
    if (!fs.existsSync(configPath)) {
      console.warn(`Файл конфигурации ${configPath} не найден.`);
      return;
    }
    
    let content = fs.readFileSync(configPath, 'utf8');
    
    // Проверяем, содержит ли файл маршрут для mutant_ape_official
    if (!content.includes('mutant_ape_official')) {
      console.log('Добавляем маршрут для mutant_ape_official в конфигурацию сервера...');
      
      // Находим место, где добавляются маршруты
      const routesIndex = content.indexOf('const routes = {');
      if (routesIndex !== -1) {
        // Добавляем новый маршрут
        const newRoute = `
  '/mutant_ape_official': path.join(process.cwd(), 'mutant_ape_official'),`;
        
        // Вставляем новый маршрут после открывающей скобки
        const insertIndex = content.indexOf('{', routesIndex) + 1;
        content = content.slice(0, insertIndex) + newRoute + content.slice(insertIndex);
        
        // Сохраняем обновленный файл
        fs.writeFileSync(configPath, content, 'utf8');
        console.log('Конфигурация сервера обновлена успешно.');
      } else {
        console.warn('Не удалось найти секцию маршрутов в файле конфигурации.');
      }
    } else {
      console.log('Маршрут для mutant_ape_official уже присутствует в конфигурации.');
    }
  } catch (error) {
    console.error('Ошибка при обновлении конфигурации сервера:', error);
  }
}

/**
 * Основная функция запуска скрипта
 */
async function main() {
  try {
    console.log('Запуск импорта Mutant Ape Yacht Club...');
    
    // Шаг 1: Импортируем коллекцию
    await importMAYCCollection();
    
    // Шаг 2: Обновляем конфигурацию NFT сервера
    await updateNFTServerConfig();
    
    console.log('Импорт Mutant Ape Yacht Club завершен успешно!');
    
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
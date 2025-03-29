/**
 * Скрипт для импорта всей коллекции Bored Ape Yacht Club
 * с поддержкой недостающих до 10000 NFT
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import pkg from 'pg';

const { Pool } = pkg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Подключение к PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Константы
const MAX_BAYC_COUNT = 10000; // Всего должно быть 10000 BAYC NFT

/**
 * Определяет редкость NFT на основе его ID
 * @param {number} tokenId ID токена NFT
 * @returns {string} Редкость NFT (common, uncommon, rare, epic, legendary)
 */
function determineRarity(tokenId) {
  // Используем ID токена для определения редкости
  // Чем меньше вероятность, тем выше редкость
  const random = Math.sin(tokenId * 13) * 10000;
  const normalizedRandom = Math.abs(random) % 100;

  if (normalizedRandom < 5) {
    return 'legendary'; // 5% - легендарные
  } else if (normalizedRandom < 15) {
    return 'epic'; // 10% - эпические
  } else if (normalizedRandom < 35) {
    return 'rare'; // 20% - редкие
  } else if (normalizedRandom < 65) {
    return 'uncommon'; // 30% - необычные
  } else {
    return 'common'; // 35% - обычные
  }
}

/**
 * Генерирует цену для NFT на основе его идентификатора и редкости
 * @param {number} tokenId ID токена NFT
 * @param {string} rarity Редкость NFT
 * @returns {number} Цена NFT в долларах
 */
function generateNFTPrice(tokenId, rarity) {
  // Базовая цена зависит от редкости
  let basePrice = 0;
  switch (rarity) {
    case 'legendary':
      basePrice = 200000;
      break;
    case 'epic':
      basePrice = 40000;
      break;
    case 'rare':
      basePrice = 5000;
      break;
    case 'uncommon':
      basePrice = 500;
      break;
    case 'common':
      basePrice = 20;
      break;
    default:
      basePrice = 10;
  }

  // Вариация цены на основе ID токена (±20%)
  const variationFactor = 0.8 + (Math.abs(Math.sin(tokenId * 13)) * 0.4);
  return Math.round(basePrice * variationFactor);
}

/**
 * Генерирует описание для NFT
 * @param {number} tokenId ID токена NFT
 * @param {string} rarity Редкость NFT
 * @returns {string} Описание NFT
 */
function generateNFTDescription(tokenId, rarity) {
  const descriptions = {
    legendary: [
      "Невероятно редкий экземпляр из коллекции Bored Ape Yacht Club. Этот NFT представляет собой уникальное произведение цифрового искусства с исключительными чертами, делающими его одним из самых ценных в коллекции.",
      "Эксклюзивный Bored Ape с легендарным статусом. Владение этим NFT открывает доступ к элитному сообществу коллекционеров и мероприятиям BAYC.",
      "Один из самых редких и ценных Bored Ape в существовании. Уникальная комбинация признаков делает эту обезьяну настоящим сокровищем цифрового искусства.",
    ],
    epic: [
      "Эпический Bored Ape с редкими характеристиками, выделяющими его среди других. Этот NFT является частью знаменитой коллекции BAYC, известной своей эксклюзивностью и культовым статусом.",
      "Необычайно редкий экземпляр из коллекции Bored Ape Yacht Club с выдающимися чертами. Владение этим NFT дает доступ к эксклюзивному сообществу BAYC.",
      "Высоко ценимый Bored Ape с редкими атрибутами. Этот NFT представляет собой значительную инвестицию в пространстве цифрового искусства.",
    ],
    rare: [
      "Редкий Bored Ape с уникальной комбинацией черт. Этот NFT является частью престижной коллекции BAYC, одной из самых известных в мире криптоискусства.",
      "Ценный экземпляр из коллекции Bored Ape Yacht Club с необычными характеристиками. Этот NFT отражает культурное влияние BAYC в пространстве цифрового искусства.",
      "Редкий Bored Ape с отличительными чертами. Этот NFT представляет собой отличную возможность для коллекционеров и энтузиастов криптоискусства.",
    ],
    uncommon: [
      "Необычный Bored Ape с интересной комбинацией характеристик. Этот NFT из знаменитой коллекции BAYC имеет свой уникальный характер и стиль.",
      "Отличительный Bored Ape с примечательными чертами. Часть культовой коллекции BAYC, изменившей представление о цифровом искусстве и NFT.",
      "Уникальный Bored Ape с выразительным характером. Этот NFT представляет возможность стать частью сообщества BAYC, одного из самых влиятельных в NFT пространстве.",
    ],
    common: [
      "Классический Bored Ape из знаменитой коллекции BAYC. Даже будучи более распространенным, этот NFT представляет собой входной билет в легендарное сообщество Bored Ape Yacht Club.",
      "Традиционный Bored Ape с характерными чертами коллекции. Этот NFT является частью культурного феномена BAYC, ставшего синонимом элитного статуса в мире NFT.",
      "Стандартный, но стильный Bored Ape. Этот NFT из коллекции BAYC представляет собой отличную начальную точку для коллекционеров криптоискусства.",
    ]
  };

  // Выбираем случайное описание из соответствующей категории редкости
  const descArray = descriptions[rarity] || descriptions.common;
  const randomIndex = Math.abs(Math.floor(Math.sin(tokenId * 7) * descArray.length)) % descArray.length;
  return descArray[randomIndex];
}

/**
 * Генерирует атрибуты для NFT на основе его ID и редкости
 * @param {number} tokenId ID токена NFT
 * @param {string} rarity Редкость NFT
 * @returns {Object} Объект с атрибутами NFT
 */
function generateNFTAttributes(tokenId, rarity) {
  // Базовые значения атрибутов зависят от редкости
  let baseValue;
  switch (rarity) {
    case 'legendary':
      baseValue = 85;
      break;
    case 'epic':
      baseValue = 75;
      break;
    case 'rare':
      baseValue = 65;
      break;
    case 'uncommon':
      baseValue = 55;
      break;
    case 'common':
      baseValue = 45;
      break;
    default:
      baseValue = 40;
  }

  // Генерируем атрибуты с некоторой вариацией
  const generateAttribute = (seed) => {
    const variation = 15; // ±15 от базового значения
    const value = baseValue + Math.floor((Math.sin(tokenId * seed) * variation));
    return Math.max(1, Math.min(100, value)); // Ограничиваем значение диапазоном 1-100
  };

  return {
    power: generateAttribute(11),
    agility: generateAttribute(23),
    wisdom: generateAttribute(37),
    luck: generateAttribute(59)
  };
}

/**
 * Организует и копирует изображения из архива в директорию с правильной нумерацией
 * @returns {Promise<{success: boolean, count: number, error?: string}>}
 */
async function organizeBAYCImages() {
  try {
    console.log('Начинаем организацию изображений BAYC...');
    
    // Создаем директорию для хранения изображений с правильной нумерацией
    const targetDir = path.join(__dirname, 'new_bored_apes');
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    
    // Исходная директория с разархивированными файлами
    const sourceDir = path.join(__dirname, 'temp_extract');
    
    // Собираем все PNG файлы
    const pngFiles = fs.readdirSync(sourceDir)
      .filter(file => file.endsWith('.png'))
      .map(file => path.join(sourceDir, file));
    
    console.log(`Найдено ${pngFiles.length} PNG файлов`);
    
    // Группируем файлы по их хэшу содержимого, чтобы избежать дубликатов
    const uniqueImages = new Map();
    
    for (const file of pngFiles) {
      // Читаем содержимое файла
      const fileContent = fs.readFileSync(file);
      // Создаем хэш содержимого
      const hash = crypto.createHash('md5').update(fileContent).digest('hex');
      
      // Если это уникальное изображение (по хэшу), добавляем его
      if (!uniqueImages.has(hash)) {
        uniqueImages.set(hash, file);
      }
    }
    
    console.log(`Идентифицировано ${uniqueImages.size} уникальных изображений`);
    
    // Копируем уникальные изображения с правильной нумерацией
    let index = 1;
    for (const [hash, file] of uniqueImages.entries()) {
      if (index > MAX_BAYC_COUNT) {
        console.log(`Достигнут максимальный лимит в ${MAX_BAYC_COUNT} изображений`);
        break;
      }
      
      const targetFile = path.join(targetDir, `bayc_${index}.png`);
      fs.copyFileSync(file, targetFile);
      
      // Каждые 100 файлов выводим прогресс
      if (index % 100 === 0) {
        console.log(`Скопировано ${index} изображений`);
      }
      
      index++;
    }
    
    console.log(`Успешно скопировано ${index - 1} уникальных изображений BAYC`);
    
    // Проверка, сколько еще нужно сгенерировать
    const remainingCount = MAX_BAYC_COUNT - (index - 1);
    
    if (remainingCount > 0) {
      console.log(`Для полной коллекции нужно дополнить еще ${remainingCount} NFT`);
    }
    
    return {
      success: true,
      count: index - 1,
      remainingCount
    };
  } catch (error) {
    console.error('Ошибка при организации изображений BAYC:', error);
    return {
      success: false,
      count: 0,
      error: error.message
    };
  }
}

/**
 * Полностью очищает базу данных от всех NFT и NFT-коллекций
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function cleanAllNFT() {
  const client = await pool.connect();
  try {
    console.log('Начинаем очистку всех NFT из базы данных...');
    await client.query('BEGIN');
    
    // Удаляем все переводы NFT
    await client.query('DELETE FROM nft_transfers');
    console.log('Удалены все переводы NFT');
    
    // Удаляем все NFT
    await client.query('DELETE FROM nfts');
    console.log('Удалены все NFT');
    
    // Обнуляем последовательность ID для таблицы NFT
    await client.query('ALTER SEQUENCE nfts_id_seq RESTART WITH 1');
    console.log('Сброшена последовательность ID для таблицы NFT');
    
    // Удаляем все коллекции NFT
    await client.query('DELETE FROM nft_collections');
    console.log('Удалены все коллекции NFT');
    
    // Обнуляем последовательность ID для таблицы коллекций
    await client.query('ALTER SEQUENCE nft_collections_id_seq RESTART WITH 1');
    console.log('Сброшена последовательность ID для таблицы коллекций NFT');
    
    // Очистка таблицы старого формата, если существует
    try {
      await client.query('DELETE FROM nft');
      console.log('Удалены все NFT из устаревшей таблицы');
      
      await client.query('ALTER SEQUENCE nft_id_seq RESTART WITH 1');
      console.log('Сброшена последовательность ID для устаревшей таблицы NFT');
    } catch (err) {
      console.log('Устаревшая таблица NFT не существует или иная ошибка:', err.message);
    }
    
    await client.query('COMMIT');
    console.log('Транзакция успешно завершена');
    
    return { success: true };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Ошибка при очистке NFT:', error);
    return {
      success: false,
      error: error.message
    };
  } finally {
    client.release();
  }
}

/**
 * Импортирует организованные изображения обезьян BAYC в маркетплейс
 * @param {number} existingCount Количество уже организованных изображений
 * @returns {Promise<{success: boolean, created: number, error?: string}>}
 */
async function importAllBAYCToMarketplace(existingCount) {
  const client = await pool.connect();
  try {
    console.log('Начинаем импорт всех BAYC NFT в маркетплейс...');
    
    // Получаем информацию о регуляторе (админе)
    const { rows: adminUsers } = await client.query(
      "SELECT * FROM users WHERE username = 'admin' OR username = 'regulator' LIMIT 1"
    );
    
    if (adminUsers.length === 0) {
      throw new Error('Не удалось найти пользователя admin или regulator');
    }
    
    const regulator = adminUsers[0];
    console.log(`Найден регулятор: ${regulator.username} (id: ${regulator.id})`);
    
    // Создаем коллекцию BAYC
    const { rows: newCollection } = await client.query(
      "INSERT INTO nft_collections (name, description, creator_id) VALUES ($1, $2, $3) RETURNING id",
      [
        'Bored Ape Yacht Club', 
        'Официальная коллекция Bored Ape Yacht Club - легендарные NFT обезьян, одна из самых знаменитых и ценных коллекций в мире NFT', 
        regulator.id
      ]
    );
    const collectionId = newCollection[0].id;
    console.log(`Создана коллекция BAYC (id: ${collectionId})`);
    
    // Начинаем транзакцию для импорта
    await client.query('BEGIN');
    
    // Счетчики для статистики
    let created = 0;
    
    // Импортируем с помощью батчей для ускорения процесса
    const BATCH_SIZE = 100;
    const totalCount = MAX_BAYC_COUNT;
    
    for (let startIndex = 1; startIndex <= totalCount; startIndex += BATCH_SIZE) {
      const endIndex = Math.min(startIndex + BATCH_SIZE - 1, totalCount);
      console.log(`Обработка NFT с ${startIndex} по ${endIndex}...`);
      
      // Создаем батч запросов
      const values = [];
      const placeholders = [];
      let placeholderIndex = 1;
      
      for (let i = startIndex; i <= endIndex; i++) {
        // Для первых existingCount у нас есть реальные изображения
        const hasRealImage = i <= existingCount;
        const imagePath = hasRealImage 
          ? `/new_bored_apes/bayc_${i}.png` 
          : `/public/assets/nft/default_ape_${(i % 20) + 1}.png`; // Используем заготовленные шаблоны
        
        // Определяем редкость на основе ID
        const rarity = determineRarity(i);
        
        // Генерируем цену в зависимости от редкости
        const price = generateNFTPrice(i, rarity);
        
        // Генерируем описание
        const description = generateNFTDescription(i, rarity);
        
        // Генерируем атрибуты
        const attributes = generateNFTAttributes(i, rarity);
        
        // Создаем имя для NFT
        let name = `Bored Ape #${i}`;
        // Добавляем префикс для разных редкостей
        if (rarity === 'legendary') {
          name = `⭐️ ${name}`;
        } else if (rarity === 'epic') {
          name = `💎 ${name}`;
        } else if (rarity === 'rare') {
          name = `🔥 ${name}`;
        }
        
        // Добавляем значения в массив
        values.push(
          `BAYC-${i}`, name, description, imagePath, price.toString(), true, 
          regulator.id, collectionId, rarity, JSON.stringify(attributes), new Date()
        );
        
        // Создаем плейсхолдеры для подготовленного запроса
        const currentPlaceholders = [];
        for (let j = 0; j < 11; j++) {
          currentPlaceholders.push(`$${placeholderIndex++}`);
        }
        
        placeholders.push(`(${currentPlaceholders.join(', ')})`);
      }
      
      // Выполняем пакетную вставку
      const query = `
        INSERT INTO nfts (
          token_id, name, description, image_path, price, for_sale, 
          owner_id, collection_id, rarity, attributes, minted_at
        ) VALUES ${placeholders.join(', ')}
      `;
      
      await client.query(query, values);
      created += (endIndex - startIndex + 1);
      
      console.log(`Создано NFT для ID от ${startIndex} до ${endIndex}`);
    }
    
    await client.query('COMMIT');
    console.log('Транзакция успешно завершена');
    
    return {
      success: true,
      created,
      totalCount
    };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Ошибка при импорте NFT:', error);
    return {
      success: false,
      created: 0,
      error: error.message
    };
  } finally {
    client.release();
  }
}

/**
 * Подготавливает шаблонные изображения для NFT
 * @returns {Promise<{success: boolean, count: number, error?: string}>}
 */
async function prepareDefaultImages() {
  try {
    console.log('Подготовка шаблонных изображений для недостающих NFT...');
    
    // Создаем директорию для шаблонных изображений, если она не существует
    const templatesDir = path.join(__dirname, 'public/assets/nft');
    if (!fs.existsSync(templatesDir)) {
      fs.mkdirSync(templatesDir, { recursive: true });
    }
    
    // Исходная директория с реальными изображениями
    const sourceDir = path.join(__dirname, 'new_bored_apes');
    
    // Проверяем, что исходная директория существует
    if (!fs.existsSync(sourceDir)) {
      throw new Error(`Директория с исходными изображениями не найдена: ${sourceDir}`);
    }
    
    // Получаем список файлов
    const sourceFiles = fs.readdirSync(sourceDir)
      .filter(file => file.endsWith('.png'))
      .sort((a, b) => {
        const numA = parseInt(a.replace('bayc_', '').replace('.png', ''));
        const numB = parseInt(b.replace('bayc_', '').replace('.png', ''));
        return numA - numB;
      });
    
    if (sourceFiles.length === 0) {
      throw new Error('Не найдены исходные изображения для создания шаблонов');
    }
    
    // Выбираем 20 изображений для использования в качестве шаблонов
    const samplesToUse = Math.min(20, sourceFiles.length);
    console.log(`Выбираем ${samplesToUse} изображений для шаблонов`);
    
    const step = Math.floor(sourceFiles.length / samplesToUse);
    let count = 0;
    
    for (let i = 0; i < samplesToUse; i++) {
      const sourceIndex = Math.min(i * step, sourceFiles.length - 1);
      const sourceFile = path.join(sourceDir, sourceFiles[sourceIndex]);
      const targetFile = path.join(templatesDir, `default_ape_${i + 1}.png`);
      
      fs.copyFileSync(sourceFile, targetFile);
      count++;
    }
    
    console.log(`Создано ${count} шаблонных изображений`);
    
    return {
      success: true,
      count
    };
  } catch (error) {
    console.error('Ошибка при подготовке шаблонных изображений:', error);
    return {
      success: false,
      count: 0,
      error: error.message
    };
  }
}

/**
 * Основная функция запуска скрипта
 */
async function main() {
  try {
    console.log('Запуск импорта полной коллекции BAYC...');
    
    // Шаг 1: Организуем изображения с правильной нумерацией
    console.log('\n===== ШАГ 1: ОРГАНИЗАЦИЯ ИЗОБРАЖЕНИЙ =====');
    const organizeResult = await organizeBAYCImages();
    if (!organizeResult.success) {
      throw new Error(`Ошибка при организации изображений: ${organizeResult.error}`);
    }
    console.log('Результат организации изображений:', organizeResult);
    
    // Шаг 2: Подготавливаем шаблонные изображения для недостающих NFT
    console.log('\n===== ШАГ 2: ПОДГОТОВКА ШАБЛОННЫХ ИЗОБРАЖЕНИЙ =====');
    const templatesResult = await prepareDefaultImages();
    if (!templatesResult.success) {
      throw new Error(`Ошибка при подготовке шаблонов: ${templatesResult.error}`);
    }
    console.log('Результат подготовки шаблонов:', templatesResult);
    
    // Шаг 3: Очищаем таблицы NFT
    console.log('\n===== ШАГ 3: ОЧИСТКА ТАБЛИЦ NFT =====');
    const cleanResult = await cleanAllNFT();
    if (!cleanResult.success) {
      throw new Error(`Ошибка при очистке таблиц NFT: ${cleanResult.error}`);
    }
    console.log('Результат очистки таблиц:', cleanResult);
    
    // Шаг 4: Импортируем все 10000 NFT
    console.log('\n===== ШАГ 4: ИМПОРТ ВСЕХ 10000 NFT =====');
    const importResult = await importAllBAYCToMarketplace(organizeResult.count);
    if (!importResult.success) {
      throw new Error(`Ошибка при импорте NFT: ${importResult.error}`);
    }
    console.log('Результат импорта NFT:', importResult);
    
    console.log('\nСкрипт успешно завершен');
  } catch (error) {
    console.error('Критическая ошибка при выполнении скрипта:', error);
  } finally {
    // Закрываем пул соединений
    pool.end();
  }
}

// Запускаем скрипт
main();
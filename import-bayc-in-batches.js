/**
 * Скрипт для импорта коллекции Bored Ape Yacht Club в пакетном режиме
 * Работает с небольшими пакетами, чтобы избежать таймаута
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';

const { Pool } = pkg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Подключение к PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Настройки процесса импорта
const TARGET_COUNT = 1000; // Целевое количество NFT для импорта
const BATCH_SIZE = 100; // Размер пакета для импорта за один раз

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
 * Проверяет, существует ли таблица с коллекциями NFT, и либо создает ее, 
 * либо получает существующую коллекцию Bored Ape Yacht Club
 * @returns {Promise<{success: boolean, collectionId: number, error?: string}>}
 */
async function setupBAYCCollection() {
  const client = await pool.connect();
  try {
    console.log('Проверка и настройка коллекции BAYC...');
    
    // Пробуем найти существующую коллекцию BAYC
    try {
      const { rows: collections } = await client.query(
        "SELECT * FROM nft_collections WHERE name LIKE '%Bored Ape%' OR name LIKE '%BAYC%' LIMIT 1"
      );
      
      if (collections.length > 0) {
        console.log(`Найдена существующая коллекция BAYC: ${collections[0].name} (id: ${collections[0].id})`);
        return {
          success: true,
          collectionId: collections[0].id
        };
      }
    } catch (err) {
      // Если таблица не существует, создаем ее
      console.log('Таблица коллекций NFT не найдена, создаем новую...');
    }
    
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
    console.log(`Создана новая коллекция BAYC (id: ${collectionId})`);
    
    return {
      success: true,
      collectionId,
      regulatorId: regulator.id
    };
  } catch (error) {
    console.error('Ошибка при настройке коллекции BAYC:', error);
    return {
      success: false,
      error: error.message
    };
  } finally {
    client.release();
  }
}

/**
 * Получает максимальный ID токена NFT, уже существующий в базе данных
 * @returns {Promise<{success: boolean, maxTokenId: number, error?: string}>}
 */
async function getMaxExistingTokenId() {
  const client = await pool.connect();
  try {
    console.log('Получение максимального ID токена NFT...');
    
    const { rows } = await client.query(`
      SELECT MAX(CAST(REPLACE(token_id, 'BAYC-', '') AS INTEGER)) as max_id 
      FROM nfts 
      WHERE token_id LIKE 'BAYC-%'
    `);
    
    const maxId = rows[0].max_id || 0;
    console.log(`Максимальный существующий ID токена: ${maxId}`);
    
    return {
      success: true,
      maxTokenId: maxId
    };
  } catch (error) {
    console.error('Ошибка при получении максимального ID токена:', error);
    return {
      success: false,
      maxTokenId: 0,
      error: error.message
    };
  } finally {
    client.release();
  }
}

/**
 * Импортирует пакет NFT в маркетплейс
 * @param {number} startId Начальный ID токена для импорта
 * @param {number} endId Конечный ID токена для импорта
 * @param {number} collectionId ID коллекции
 * @param {number} regulatorId ID регулятора (владельца)
 * @returns {Promise<{success: boolean, created: number, error?: string}>}
 */
async function importBAYCBatch(startId, endId, collectionId, regulatorId) {
  const client = await pool.connect();
  try {
    console.log(`Импорт пакета NFT с ID от ${startId} до ${endId}...`);
    
    // Проверяем наличие директории с шаблонными изображениями
    const templatesDir = path.join(__dirname, 'public/assets/nft');
    const hasTemplates = fs.existsSync(templatesDir) && 
                         fs.readdirSync(templatesDir).filter(f => f.startsWith('default_ape_')).length > 0;
    
    // Проверяем наличие директории с реальными изображениями
    const sourceDir = path.join(__dirname, 'new_bored_apes');
    const hasRealImages = fs.existsSync(sourceDir);
    
    // Начинаем транзакцию для импорта
    await client.query('BEGIN');
    
    // Создаем батч запросов
    const values = [];
    const placeholders = [];
    let placeholderIndex = 1;
    
    for (let i = startId; i <= endId; i++) {
      // Проверяем наличие реального изображения
      const realImagePath = path.join(sourceDir, `bayc_${i}.png`);
      const hasRealImage = hasRealImages && fs.existsSync(realImagePath);
      
      // Определяем путь к изображению
      let imagePath;
      if (hasRealImage) {
        imagePath = `/new_bored_apes/bayc_${i}.png`;
      } else if (hasTemplates) {
        // Используем шаблонное изображение
        imagePath = `/public/assets/nft/default_ape_${(i % 20) + 1}.png`;
      } else {
        // Если нет ни реальных, ни шаблонных изображений, используем заглушку
        imagePath = `/public/assets/nft/bayc_placeholder.png`;
      }
      
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
        regulatorId, collectionId, rarity, JSON.stringify(attributes), new Date()
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
    await client.query('COMMIT');
    
    const created = endId - startId + 1;
    console.log(`Успешно импортирован пакет из ${created} NFT с ID от ${startId} до ${endId}`);
    
    return {
      success: true,
      created
    };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`Ошибка при импорте пакета NFT с ID от ${startId} до ${endId}:`, error);
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
 * Создает заглушку-изображение для NFT, если нет шаблонов
 * @returns {Promise<boolean>}
 */
async function createPlaceholderImage() {
  try {
    const placeholderDir = path.join(__dirname, 'public/assets/nft');
    if (!fs.existsSync(placeholderDir)) {
      fs.mkdirSync(placeholderDir, { recursive: true });
    }
    
    const placeholderPath = path.join(placeholderDir, 'bayc_placeholder.png');
    
    // Проверяем, есть ли уже заглушка
    if (fs.existsSync(placeholderPath)) {
      console.log('Заглушка-изображение уже существует');
      return true;
    }
    
    // Ищем любое изображение в качестве заглушки
    const sourceDirs = [
      path.join(__dirname, 'new_bored_apes'), 
      path.join(__dirname, 'temp_extract'),
      path.join(__dirname, 'public/bayc_official')
    ];
    
    let sourceImage = null;
    
    for (const dir of sourceDirs) {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.png'));
        if (files.length > 0) {
          sourceImage = path.join(dir, files[0]);
          break;
        }
      }
    }
    
    if (!sourceImage) {
      console.log('Не найдено ни одного изображения для создания заглушки');
      return false;
    }
    
    // Копируем изображение как заглушку
    fs.copyFileSync(sourceImage, placeholderPath);
    console.log(`Создана заглушка-изображение: ${placeholderPath}`);
    
    return true;
  } catch (error) {
    console.error('Ошибка при создании заглушки-изображения:', error);
    return false;
  }
}

/**
 * Основная функция запуска скрипта
 */
async function main() {
  try {
    console.log('Запуск импорта коллекции BAYC в пакетном режиме...');
    
    // Создаем заглушку-изображение, если нет шаблонов
    await createPlaceholderImage();
    
    // Получаем или создаем коллекцию BAYC
    const collectionResult = await setupBAYCCollection();
    if (!collectionResult.success) {
      throw new Error(`Ошибка при настройке коллекции BAYC: ${collectionResult.error}`);
    }
    
    // Получаем максимальный существующий ID токена
    const maxIdResult = await getMaxExistingTokenId();
    if (!maxIdResult.success) {
      throw new Error(`Ошибка при получении максимального ID токена: ${maxIdResult.error}`);
    }
    
    // Определяем диапазон для импорта
    const startId = maxIdResult.maxTokenId + 1;
    const endId = startId + TARGET_COUNT - 1;
    
    console.log(`Начинаем импорт NFT с ID от ${startId} до ${endId}...`);
    
    // Импортируем по пакетам
    let currentStart = startId;
    let totalCreated = 0;
    
    while (currentStart <= endId) {
      const currentEnd = Math.min(currentStart + BATCH_SIZE - 1, endId);
      
      const batchResult = await importBAYCBatch(
        currentStart, 
        currentEnd, 
        collectionResult.collectionId, 
        collectionResult.regulatorId
      );
      
      if (!batchResult.success) {
        console.error(`Ошибка при импорте пакета с ID от ${currentStart} до ${currentEnd}: ${batchResult.error}`);
        break;
      }
      
      totalCreated += batchResult.created;
      currentStart = currentEnd + 1;
      
      // Небольшая пауза между пакетами для избежания перегрузки
      if (currentStart <= endId) {
        console.log('Пауза перед следующим пакетом...');
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    console.log(`\nИмпорт завершен. Всего создано ${totalCreated} новых NFT.`);
    console.log(`Для запуска следующего пакета вызовите скрипт снова.`);
  } catch (error) {
    console.error('Критическая ошибка при выполнении скрипта:', error);
  } finally {
    // Закрываем пул соединений
    pool.end();
  }
}

// Запускаем скрипт
main();
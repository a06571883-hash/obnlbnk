/**
 * Скрипт для исправления отображения NFT в маркетплейсе (пакетами)
 */
import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const { Pool } = pg;
dotenv.config();

// Подключение к PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Константы
const BATCH_SIZE = 100; // Размер пакета для импорта

/**
 * Удаляет все NFT для чистого импорта
 */
async function cleanAllNFT() {
  console.log('Удаление всех существующих NFT...');
  
  try {
    const client = await pool.connect();
    
    try {
      // Начать транзакцию
      await client.query('BEGIN');
      
      // Удалить все NFT
      const deleteNFTsQuery = `DELETE FROM nfts RETURNING id`;
      const deleteNFTsResult = await client.query(deleteNFTsQuery);
      
      console.log(`Удалено ${deleteNFTsResult.rowCount} NFT`);
      
      // Commit транзакции
      await client.query('COMMIT');
      
      return { success: true, deleted: deleteNFTsResult.rowCount };
    } catch (error) {
      // Откатить транзакцию в случае ошибки
      await client.query('ROLLBACK');
      console.error('Ошибка при очистке NFT:', error);
      return { success: false, error: error.message };
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Ошибка подключения к базе данных:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Проверяет и создает коллекцию BAYC, если она не существует
 */
async function getOrCreateBAYCCollection() {
  console.log('Проверка коллекции BAYC...');
  
  try {
    const client = await pool.connect();
    
    try {
      // Проверить, существует ли коллекция
      const checkQuery = `
        SELECT id FROM nft_collections
        WHERE name LIKE '%Bored Ape%'
        LIMIT 1
      `;
      
      const checkResult = await client.query(checkQuery);
      
      if (checkResult.rows.length > 0) {
        console.log(`Коллекция BAYC найдена с ID ${checkResult.rows[0].id}`);
        return { success: true, collectionId: checkResult.rows[0].id, isNew: false };
      }
      
      // Создать новую коллекцию
      const createQuery = `
        INSERT INTO nft_collections (
          name, description, image_url, creator_id, contract_address, chain, status
        )
        VALUES (
          'Bored Ape Yacht Club',
          'The Bored Ape Yacht Club is a collection of 10,000 unique Bored Ape NFTs— unique digital collectibles living on the Ethereum blockchain.',
          '/public/assets/bayc-logo.png',
          1,
          '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D',
          'ethereum',
          'active'
        )
        RETURNING id
      `;
      
      const createResult = await client.query(createQuery);
      const collectionId = createResult.rows[0].id;
      
      console.log(`Создана новая коллекция BAYC с ID ${collectionId}`);
      
      return { success: true, collectionId, isNew: true };
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Ошибка при проверке/создании коллекции BAYC:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Получает информацию о регуляторе
 */
async function getRegulator() {
  try {
    const client = await pool.connect();
    
    try {
      const query = `
        SELECT id FROM users
        WHERE is_regulator = true
        LIMIT 1
      `;
      
      const result = await client.query(query);
      
      if (result.rows.length === 0) {
        throw new Error('Регулятор не найден');
      }
      
      return {
        success: true,
        regulatorId: result.rows[0].id,
        userId: result.rows[0].id
      };
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Ошибка при получении информации о регуляторе:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Импортирует пакет изображений обезьян BAYC в маркетплейс
 */
async function importBAYCBatch(imageFiles, startIndex, batchSize, collectionId, regulatorId) {
  console.log(`Импорт пакета изображений BAYC ${startIndex}-${startIndex + batchSize - 1}...`);
  
  try {
    // Получаем соединение с базой данных
    const client = await pool.connect();
    let created = 0;
    
    try {
      // Начать транзакцию
      await client.query('BEGIN');
      
      // Определяем конечный индекс (не выходя за границы массива)
      const endIndex = Math.min(startIndex + batchSize, imageFiles.length);
      
      // Обрабатываем каждый файл в пакете
      for (let i = startIndex; i < endIndex; i++) {
        const file = imageFiles[i];
        
        // Извлекаем ID токена из имени файла
        const bayRegex = /bayc_(\d+)\.png/i;
        const match = file.match(bayRegex);
        if (!match) continue;
        
        const tokenId = parseInt(match[1]);
        const rarity = determineRarity(tokenId);
        const price = generateNFTPrice(tokenId, rarity);
        const description = generateNFTDescription(tokenId, rarity);
        
        // Формируем метаданные
        const attributes = generateNFTAttributes(tokenId, rarity);
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
        
        // Путь к изображению относительно public
        const imagePath = `/bayc_official/${file}`;
        
        // Добавляем NFT в базу данных
        const insertQuery = `
          INSERT INTO nfts (
            token_id, name, description, image_path, attributes, 
            collection_id, owner_id, price, for_sale,
            rarity
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
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
          price,
          true,
          rarity
        ];
        
        await client.query(insertQuery, values);
        created++;
      }
      
      // Фиксируем транзакцию
      await client.query('COMMIT');
      
      console.log(`Успешно импортировано ${created} NFT (пакет ${startIndex}-${endIndex - 1})`);
      return { success: true, created, nextIndex: endIndex };
      
    } catch (error) {
      // Откатываем транзакцию в случае ошибки
      await client.query('ROLLBACK');
      console.error('Ошибка при импорте пакета изображений:', error);
      return { success: false, error: error.message };
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Ошибка при импорте пакета изображений:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Определяет редкость NFT на основе его ID
 */
function determineRarity(tokenId) {
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
 */
function generateNFTPrice(tokenId, rarity) {
  const priceRanges = {
    common: { min: 20, max: 1000 },
    uncommon: { min: 1000, max: 10000 },
    rare: { min: 10000, max: 50000 },
    epic: { min: 50000, max: 150000 },
    legendary: { min: 150000, max: 300000 }
  };

  const { min, max } = priceRanges[rarity];
  const range = max - min;
  const rand = Math.sin(tokenId) * 10000;
  const factor = (rand - Math.floor(rand)) * 0.8 + 0.1;
  
  return Math.round(min + range * factor);
}

/**
 * Генерирует описание для NFT
 */
function generateNFTDescription(tokenId, rarity) {
  const rarityDescriptions = {
    common: "A common Bored Ape with standard traits. Part of the iconic Bored Ape Yacht Club collection, this digital collectible grants membership to the exclusive club and evolving benefits.",
    uncommon: "An uncommon Bored Ape with several desirable traits. This Bored Ape Yacht Club NFT stands out with its distinctive appearance and provides access to the exclusive BAYC community.",
    rare: "A rare Bored Ape featuring sought-after traits and combinations. This exceptional BAYC collectible is highly valued in the NFT community and comes with exclusive membership benefits.",
    epic: "An epic Bored Ape showcasing extremely rare trait combinations. This prized BAYC collectible represents one of the most desirable digital assets in the NFT space.",
    legendary: "A legendary Bored Ape with the rarest trait combinations in the collection. This exceptional BAYC NFT is among the most valuable digital collectibles ever created."
  };

  let description = rarityDescriptions[rarity];
  description += ` Token ID: ${tokenId}, part of the 10,000 unique Bored Ape NFTs in existence.`;
  
  return description;
}

/**
 * Генерирует атрибуты для NFT
 */
function generateNFTAttributes(tokenId, rarity) {
  const seed = tokenId;
  
  const backgrounds = ['Blue', 'Orange', 'Purple', 'Yellow', 'Green', 'Red', 'Aquamarine', 'Gray'];
  const furs = ['Brown', 'Black', 'Golden', 'Cream', 'Red', 'Blue', 'Pink', 'Gray', 'White', 'Zombie', 'Robot', 'Alien'];
  const eyes = ['Bored', 'Sleepy', 'Eyepatch', 'Sunglasses', 'Laser Eyes', 'Wide Eyed', 'Zombie Eyes', 'Robot Eyes', '3D Glasses'];
  const clothes = ['Suit', 'Sailor Shirt', 'Striped Shirt', 'Hawaiian Shirt', 'Leather Jacket', 'Smoking Jacket', 'Tweed Suit', 'Kings Robe', 'Ninja Garb', 'Space Suit'];
  const mouths = ['Bored', 'Bored Cigarette', 'Bored Party Horn', 'Grin', 'Angry', 'Dumbfounded', 'Phoneme Oh', 'Phoneme Ooo', 'Small Grin', 'Jovial'];
  const hats = ['None', 'Party Hat', 'Fez', 'Cowboy Hat', 'Captain\'s Hat', 'Crown', 'Fisherman\'s Hat', 'Halo', 'Horns', 'Police Cap', 'Beanie'];
  const earrings = ['None', 'Gold Stud', 'Silver Hoop', 'Gold Hoop', 'Diamond Stud', 'Cross', 'Small Gold'];
  
  function selectAttribute(array, seed, rarity) {
    const hash = Math.sin(seed) * 10000;
    const normalizedValue = (hash - Math.floor(hash));
    
    let index;
    
    if (rarity === 'common') {
      index = Math.floor(normalizedValue * (array.length * 0.7));
    } else if (rarity === 'uncommon') {
      index = Math.floor(normalizedValue * (array.length * 0.9));
    } else if (rarity === 'rare') {
      index = Math.floor(normalizedValue * array.length);
    } else {
      index = Math.floor(normalizedValue * 0.3 + 0.7) * array.length;
    }
    
    index = Math.min(Math.floor(index), array.length - 1);
    
    return array[index];
  }
  
  const background = selectAttribute(backgrounds, seed * 1.1, rarity);
  const fur = selectAttribute(furs, seed * 2.2, rarity);
  const eye = selectAttribute(eyes, seed * 3.3, rarity);
  const clothe = selectAttribute(clothes, seed * 4.4, rarity);
  const mouth = selectAttribute(mouths, seed * 5.5, rarity);
  const hat = selectAttribute(hats, seed * 6.6, rarity);
  const earring = selectAttribute(earrings, seed * 7.7, rarity);
  
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
 * Обрабатывает указанный пакет
 */
async function processBatch(batchNumber) {
  console.log(`Обработка пакета #${batchNumber}...`);
  
  try {
    // Определяем, нужно ли очистить NFT (только для первого пакета)
    if (batchNumber === 1) {
      // Шаг 1: Удаляем все существующие NFT
      console.log('Шаг 1: Удаление всех существующих NFT...');
      const cleanResult = await cleanAllNFT();
      
      if (!cleanResult.success) {
        console.error('Ошибка при очистке NFT:', cleanResult.error);
        return { success: false, error: cleanResult.error };
      }
    }
    
    // Шаг 2: Проверяем/создаем коллекцию BAYC
    console.log('Шаг 2: Получение информации о коллекции BAYC...');
    const collectionResult = await getOrCreateBAYCCollection();
    
    if (!collectionResult.success) {
      console.error('Ошибка при проверке/создании коллекции BAYC:', collectionResult.error);
      return { success: false, error: collectionResult.error };
    }
    
    // Шаг 3: Получаем информацию о регуляторе
    console.log('Шаг 3: Получение информации о регуляторе...');
    const regulatorResult = await getRegulator();
    
    if (!regulatorResult.success) {
      console.error('Ошибка при получении информации о регуляторе:', regulatorResult.error);
      return { success: false, error: regulatorResult.error };
    }
    
    // Шаг 4: Поиск изображений BAYC
    console.log('Шаг 4: Поиск изображений BAYC...');
    
    // Проверяем директорию с официальными изображениями
    const baycDirPath = path.resolve('./public/bayc_official');
    
    if (!fs.existsSync(baycDirPath)) {
      const error = `Директория ${baycDirPath} не существует`;
      console.error(error);
      return { success: false, error };
    }
    
    // Получаем список файлов
    const files = fs.readdirSync(baycDirPath);
    
    // Фильтруем только PNG файлы с нужным форматом имени
    const bayRegex = /bayc_(\d+)\.png/i;
    const imageFiles = files.filter(file => bayRegex.test(file));
    
    console.log(`Найдено ${imageFiles.length} изображений для импорта`);
    
    if (imageFiles.length === 0) {
      return { success: true, created: 0, message: 'Нет изображений для импорта' };
    }
    
    // Шаг 5: Импортируем пакет изображений
    console.log('Шаг 5: Импорт пакета изображений BAYC...');
    
    // Вычисляем начальный индекс для текущего пакета
    const startIndex = (batchNumber - 1) * BATCH_SIZE;
    
    // Если начальный индекс выходит за границы массива, значит все уже импортировано
    if (startIndex >= imageFiles.length) {
      return { success: true, created: 0, message: 'Все изображения уже импортированы' };
    }
    
    // Импортируем пакет
    const importResult = await importBAYCBatch(
      imageFiles, 
      startIndex, 
      BATCH_SIZE, 
      collectionResult.collectionId, 
      regulatorResult.regulatorId
    );
    
    if (!importResult.success) {
      console.error('Ошибка при импорте пакета:', importResult.error);
      return { success: false, error: importResult.error };
    }
    
    return { 
      success: true, 
      created: importResult.created,
      nextBatch: batchNumber + 1,
      hasMore: importResult.nextIndex < imageFiles.length,
      totalImages: imageFiles.length,
      importedImages: importResult.nextIndex
    };
    
  } catch (error) {
    console.error('Ошибка при обработке пакета:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Основная функция запуска скрипта
 */
async function main() {
  try {
    // Определяем номер пакета из аргументов командной строки
    const args = process.argv.slice(2);
    const requestedBatch = args.length > 0 ? parseInt(args[0]) : 1;
    
    console.log(`Запуск скрипта исправления отображения NFT в маркетплейсе (пакет #${requestedBatch})...`);
    
    // Обрабатываем указанный пакет
    const result = await processBatch(requestedBatch);
    
    if (!result.success) {
      console.error('Ошибка при обработке пакета:', result.error);
      return;
    }
    
    console.log(`Пакет #${requestedBatch} обработан успешно!`);
    
    if (result.hasMore) {
      console.log(`Прогресс: ${result.importedImages}/${result.totalImages} (${Math.round(result.importedImages / result.totalImages * 100)}%)`);
      console.log(`Для импорта следующего пакета запустите: node fix-marketplace-batch.js ${result.nextBatch}`);
    } else {
      console.log('Все изображения успешно импортированы!');
      
      // Проверяем общее количество NFT
      const client = await pool.connect();
      try {
        const countQuery = `SELECT COUNT(*) as count FROM nfts`;
        const countResult = await client.query(countQuery);
        const totalCount = parseInt(countResult.rows[0].count);
        
        console.log(`Всего уникальных NFT в базе данных: ${totalCount}`);
      } finally {
        client.release();
      }
    }
    
  } catch (error) {
    console.error('Ошибка при выполнении скрипта:', error);
  } finally {
    // Закрыть подключение к базе данных
    await pool.end();
    console.log('Подключение к базе данных закрыто.');
  }
}

// Запускаем скрипт
main();
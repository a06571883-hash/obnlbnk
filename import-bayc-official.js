/**
 * Скрипт для импорта официальных NFT из коллекции Bored Ape Yacht Club
 * в маркетплейс, используя файлы из public/bayc_official
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';
const { Client } = pkg;

// Получаем текущую директорию
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Подключение к базе данных
const connectionString = process.env.DATABASE_URL;

/**
 * Генерирует цену для NFT на основе его идентификатора и редкости
 * @param {number} tokenId ID токена NFT
 * @param {string} rarity Редкость NFT
 * @returns {number} Цена NFT в долларах
 */
function generateNFTPrice(tokenId, rarity) {
  // Базовая цена в зависимости от редкости
  let basePrice = 50; // По умолчанию для common
  
  switch (rarity) {
    case 'common':
      basePrice = 20 + (tokenId % 30); // $20-$50
      break;
    case 'uncommon':
      basePrice = 100 + (tokenId % 200); // $100-$300
      break;
    case 'rare':
      basePrice = 500 + (tokenId % 500); // $500-$1000
      break;
    case 'epic':
      basePrice = 2000 + (tokenId % 3000); // $2000-$5000
      break;
    case 'legendary':
      basePrice = 50000 + (tokenId % 250000); // $50000-$300000
      break;
  }
  
  // Добавляем индивидуальный модификатор на основе ID токена
  const modifier = 1 + (tokenId % 10) / 100; // 1.00-1.09
  
  return Math.round(basePrice * modifier);
}

/**
 * Определяет редкость NFT на основе его ID
 * @param {number} tokenId ID токена NFT
 * @returns {string} Редкость NFT (common, uncommon, rare, epic, legendary)
 */
function determineRarity(tokenId) {
  // Распределение редкости: 
  // 60% - common, 25% - uncommon, 10% - rare, 4% - epic, 1% - legendary
  const rarityValue = (tokenId * 37 + 17) % 100; // Псевдослучайное число от 0 до 99
  
  if (rarityValue < 60) return 'common';
  if (rarityValue < 85) return 'uncommon';
  if (rarityValue < 95) return 'rare';
  if (rarityValue < 99) return 'epic';
  return 'legendary';
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
      "Обычная обезьяна из клуба Bored Ape Yacht Club. Ничего особенного, но все равно круто!",
      "Повседневный член клуба BAYC. Отличный старт для коллекционера NFT.",
      "Стандартный, но стильный экземпляр из коллекции Bored Ape. Хорошее вложение.",
      "Базовый представитель клуба скучающих обезьян. Отличный выбор для начинающих."
    ],
    uncommon: [
      "Необычная обезьяна с интересными чертами. Выделяется среди обычных представителей BAYC.",
      "Редкий представитель коллекции с уникальными аксессуарами. Достойное приобретение.",
      "Примечательный экземпляр из клуба Bored Ape. Имеет потенциал роста в стоимости.",
      "Выделяющийся NFT с хорошими характеристиками. Популярный среди коллекционеров среднего уровня."
    ],
    rare: [
      "Редкая обезьяна из престижного клуба BAYC. Обладает выдающимися характеристиками и внешностью.",
      "Высокоценный представитель коллекции Bored Ape. Отличное долгосрочное вложение.",
      "Эксклюзивный NFT с ограниченным тиражом. Востребован среди серьезных коллекционеров.",
      "Выдающийся экземпляр с редким сочетанием черт. Значительно выше среднего по ценности."
    ],
    epic: [
      "Эпическая обезьяна с исключительно редкими атрибутами. Настоящее сокровище в мире NFT.",
      "Элитный представитель клуба BAYC. Входит в высшую лигу цифровых коллекционных предметов.",
      "Превосходный экземпляр с невероятными характеристиками. Желанное приобретение для коллекционеров.",
      "Потрясающе редкий NFT с уникальным дизайном. Мечта каждого энтузиаста криптоискусства."
    ],
    legendary: [
      "Легендарная обезьяна с экстраординарными характеристиками. Одна из самых ценных в коллекции BAYC.",
      "Исключительно редкий экземпляр высочайшего уровня. Бесценное сокровище в мире NFT.",
      "Абсолютный шедевр из Bored Ape Yacht Club. Воплощение статуса и престижа в цифровом пространстве.",
      "Непревзойденный NFT музейного качества. Признанный шедевр криптоискусства с огромной ценностью."
    ]
  };
  
  // Выбираем случайное описание из соответствующего списка
  const descriptionList = descriptions[rarity];
  const descriptionIndex = (tokenId * 13 + 7) % descriptionList.length;
  
  return descriptionList[descriptionIndex];
}

/**
 * Генерирует атрибуты для NFT
 * @param {number} tokenId ID токена NFT
 * @param {string} rarity Редкость NFT
 * @returns {Object} Атрибуты NFT
 */
function generateNFTAttributes(tokenId, rarity) {
  // Базовый диапазон значений для каждого атрибута в зависимости от редкости
  const rarityMultipliers = {
    common: { min: 1, max: 40 },
    uncommon: { min: 30, max: 60 },
    rare: { min: 50, max: 75 },
    epic: { min: 70, max: 90 },
    legendary: { min: 85, max: 100 }
  };
  
  const multiplier = rarityMultipliers[rarity];
  
  // Генерируем случайные значения для каждого атрибута в пределах диапазона
  // Используем tokenId для детерминированной генерации
  function generateAttribute(seed) {
    const value = ((tokenId * seed) % (multiplier.max - multiplier.min + 1)) + multiplier.min;
    return Math.min(100, Math.max(1, value)); // Ограничиваем от 1 до 100
  }
  
  return {
    power: generateAttribute(13),
    agility: generateAttribute(29),
    wisdom: generateAttribute(37),
    luck: generateAttribute(53)
  };
}

/**
 * Основная функция для импорта NFT
 */
async function importBoredApesToMarketplace() {
  let client;
  
  try {
    // Подключаемся к базе данных
    client = new Client({ connectionString });
    await client.connect();
    console.log('Подключение к базе данных успешно установлено');
    
    // Получаем информацию о регуляторе (админе) из базы данных
    const regulatorResult = await client.query('SELECT id FROM users WHERE username = $1', ['admin']);
    
    if (regulatorResult.rows.length === 0) {
      throw new Error('Регулятор (админ) не найден в базе данных');
    }
    
    const regulatorId = regulatorResult.rows[0].id;
    console.log(`Регулятор (admin) найден, ID: ${regulatorId}`);
    
    // Путь к директории с изображениями NFT
    const nftDir = path.join(__dirname, 'public', 'bayc_official');
    
    // Проверяем существование директории
    if (!fs.existsSync(nftDir)) {
      throw new Error(`Директория ${nftDir} не существует`);
    }
    
    // Получаем список PNG файлов в директории
    const files = fs.readdirSync(nftDir)
      .filter(file => file.toLowerCase().endsWith('.png') && file.startsWith('bayc_'))
      .sort((a, b) => {
        // Извлекаем числовые идентификаторы из имен файлов и сортируем их
        const numA = parseInt(a.replace('bayc_', '').replace('.png', ''), 10);
        const numB = parseInt(b.replace('bayc_', '').replace('.png', ''), 10);
        return numA - numB;
      });
    
    console.log(`Найдено ${files.length} файлов PNG для импорта`);
    
    // Проверяем, есть ли уже NFT в базе данных
    const existingNFTResult = await client.query('SELECT COUNT(*) FROM nfts');
    const existingNFTCount = parseInt(existingNFTResult.rows[0].count, 10);
    
    console.log(`В базе данных уже существует ${existingNFTCount} NFT`);
    
    // Если NFT уже есть, спрашиваем пользователя, хочет ли он импортировать новые
    if (existingNFTCount > 0) {
      console.log('ВНИМАНИЕ: NFT уже существуют в базе данных.');
      console.log('Продолжаем импорт, будут добавлены только новые NFT.');
    }
    
    // Создаем коллекцию BAYC, если она не существует
    const collectionResult = await client.query(
      'SELECT id FROM nft_collections WHERE name = $1',
      ['Bored Ape Yacht Club']
    );
    
    let collectionId;
    
    if (collectionResult.rows.length === 0) {
      // Создаем новую коллекцию
      const newCollectionResult = await client.query(
        'INSERT INTO nft_collections (name, description, user_id, created_at) VALUES ($1, $2, $3, $4) RETURNING id',
        [
          'Bored Ape Yacht Club',
          'Официальная коллекция Bored Ape Yacht Club — одна из самых престижных и узнаваемых NFT-коллекций в мире. Каждый NFT представляет собой уникального мультяшного примата с различными аксессуарами, выражениями и особенностями.',
          regulatorId,
          new Date()
        ]
      );
      
      collectionId = newCollectionResult.rows[0].id;
      console.log(`Создана новая коллекция "Bored Ape Yacht Club" с ID: ${collectionId}`);
    } else {
      collectionId = collectionResult.rows[0].id;
      console.log(`Найдена существующая коллекция "Bored Ape Yacht Club" с ID: ${collectionId}`);
    }
    
    // Начинаем импортировать NFT
    let created = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const file of files) {
      try {
        // Извлекаем номер токена из имени файла
        const tokenId = parseInt(file.replace('bayc_', '').replace('.png', ''), 10);
        
        // Проверяем, существует ли NFT с таким token_id и collection_id
        const existingNFT = await client.query(
          'SELECT id FROM nfts WHERE token_id = $1 AND collection_id = $2',
          [tokenId.toString(), collectionId]
        );
        
        if (existingNFT.rows.length > 0) {
          console.log(`Пропуск: NFT с token_id ${tokenId} уже существует в коллекции ${collectionId}`);
          skipped++;
          continue;
        }
        
        // Определяем редкость NFT
        const rarity = determineRarity(tokenId);
        
        // Генерируем цену NFT
        const price = generateNFTPrice(tokenId, rarity);
        
        // Генерируем описание NFT
        const description = generateNFTDescription(tokenId, rarity);
        
        // Генерируем атрибуты NFT
        const attributes = generateNFTAttributes(tokenId, rarity);
        
        // Формируем путь к изображению
        const imagePath = `/bayc_official/${file}`;
        
        // Проверка существования AVIF версии
        const avifPath = `/bayc_official/${file.replace('.png', '.avif')}`;
        const hasAvif = fs.existsSync(path.join(__dirname, 'public', 'bayc_official', file.replace('.png', '.avif')));
        
        // Импортируем NFT в базу данных
        await client.query(
          `INSERT INTO nfts (
            token_id, collection_id, owner_id, name, 
            description, image_path, price, for_sale,
            rarity, minted_at, attributes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            tokenId.toString(),
            collectionId,
            regulatorId, // Изначально владелец - регулятор (админ)
            `Bored Ape #${tokenId}`,
            description,
            imagePath, // Используем PNG версию как основную
            price.toString(),
            true, // Изначально выставлен на продажу
            rarity,
            new Date(),
            JSON.stringify(attributes)
          ]
        );
        
        console.log(`Импортирован NFT: Bored Ape #${tokenId}, цена: $${price}, редкость: ${rarity}`);
        created++;
      } catch (err) {
        console.error(`Ошибка при импорте NFT ${file}:`, err);
        errors++;
      }
    }
    
    console.log('\nИмпорт завершен!');
    console.log(`Создано: ${created} NFT`);
    console.log(`Пропущено: ${skipped} NFT (уже существуют в базе данных)`);
    console.log(`Ошибок: ${errors}`);
    
    return { success: true, created, skipped, errors };
  } catch (err) {
    console.error('Ошибка при импорте Bored Apes:', err);
    return { success: false, error: err };
  } finally {
    if (client) {
      await client.end();
      console.log('Соединение с базой данных закрыто');
    }
  }
}

// Запускаем импорт
importBoredApesToMarketplace().catch(err => console.error('Критическая ошибка:', err));
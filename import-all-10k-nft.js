/**
 * Скрипт для импорта 10 000 NFT в маркетплейс
 */

import { db } from './server/db.js';
import { nfts, nftCollections } from './shared/schema.js';
import { eq } from 'drizzle-orm';

// Конфигурация
const config = {
  // Общее количество NFT для создания
  totalNFTCount: 10000,
  // ID регулятора/админа
  regulatorId: 5,
  // Имя коллекции
  collectionName: 'Bored Ape Yacht Club',
  // Размер партии импорта
  batchSize: 200,
  // Базовый путь для изображений
  imagePathBase: '/bayc_official/'
};

/**
 * Определяет редкость NFT на основе его ID
 * @param {number} tokenId ID токена NFT
 * @returns {string} Редкость NFT (common, uncommon, rare, epic, legendary)
 */
function determineRarity(tokenId) {
  // Определение редкости на основе последней цифры ID
  const lastDigit = tokenId % 10;
  
  if (lastDigit === 7 || lastDigit === 9) {
    return 'legendary'; // 20% (2/10) - самые редкие
  } else if (lastDigit === 0 || lastDigit === 5) {
    return 'epic'; // 20% (2/10) - очень редкие
  } else if (lastDigit === 1 || lastDigit === 8) {
    return 'rare'; // 20% (2/10) - редкие
  } else if (lastDigit === 2 || lastDigit === 6) {
    return 'uncommon'; // 20% (2/10) - необычные
  } else {
    return 'common'; // 20% (2/10) - обычные
  }
}

/**
 * Генерирует цену для NFT на основе его идентификатора и редкости
 * @param {number} tokenId ID токена NFT
 * @param {string} rarity Редкость NFT
 * @returns {number} Цена NFT в долларах
 */
function generateNFTPrice(tokenId, rarity) {
  // Базовые цены для разных уровней редкости
  const basePrices = {
    common: 16,               // $16 - $20,000
    uncommon: 251,            // $251 - $50,000
    rare: 2_133,              // $2,133 - $70,000
    epic: 32_678,             // $32,678 - $150,000
    legendary: 189_777        // $189,777 - $291,835
  };
  
  // Множитель на основе ID (чем меньше ID, тем ценнее NFT)
  const idMultiplier = Math.max(0.1, Math.min(1, 1 - (tokenId % 1000) / 1000));
  
  // Расчет модификатора цены (от 1 до 2)
  const priceModifier = 1 + idMultiplier;
  
  // Итоговая цена с учетом редкости и ID
  let price = Math.round(basePrices[rarity] * priceModifier);
  
  // Особая цена для первых 100 NFT (коллекционная ценность)
  if (tokenId < 100) {
    price = Math.round(price * 1.5); 
  }
  
  return price;
}

/**
 * Генерирует описание для NFT
 * @param {number} tokenId ID токена NFT
 * @param {string} rarity Редкость NFT
 * @returns {string} Описание NFT
 */
function generateNFTDescription(tokenId, rarity) {
  const baseDescriptions = {
    common: "Обычная обезьяна из клуба Bored Ape Yacht Club. Обладает стандартными чертами без особых украшений.",
    uncommon: "Необычная обезьяна из клуба Bored Ape Yacht Club. Имеет несколько интересных деталей, выделяющих её среди других.",
    rare: "Редкая обезьяна из клуба Bored Ape Yacht Club. Обладает уникальными чертами и особыми аксессуарами.",
    epic: "Очень редкая обезьяна из клуба Bored Ape Yacht Club. Выделяется исключительными характеристиками и стилем.",
    legendary: "Легендарная обезьяна из клуба Bored Ape Yacht Club. Одна из самых ценных и уникальных во всей коллекции."
  };
  
  // Усиливаем описание для первых 100 NFT
  let specialDescription = "";
  if (tokenId < 100) {
    specialDescription = " Принадлежит к первой сотне выпущенных обезьян, что придаёт ей особую коллекционную ценность.";
  }
  
  return `${baseDescriptions[rarity]}${specialDescription} Токен #${tokenId}`;
}

/**
 * Генерирует атрибуты для NFT на основе его ID и редкости
 * @param {number} tokenId ID токена NFT
 * @param {string} rarity Редкость NFT
 * @returns {Object} Объект с атрибутами NFT
 */
function generateNFTAttributes(tokenId, rarity) {
  // Базовые значения атрибутов в зависимости от редкости
  const rarityBaseStats = {
    common: { min: 30, max: 70 },
    uncommon: { min: 40, max: 80 },
    rare: { min: 50, max: 85 },
    epic: { min: 60, max: 90 },
    legendary: { min: 70, max: 99 }
  };
  
  // Используем ID как семя для генерации псевдо-случайных значений
  const seed = tokenId;
  
  // Функция для генерации псевдо-случайного числа на основе seed и диапазона
  function generateAttributeValue(seed, attributeIndex, min, max) {
    const hash = (seed * 9301 + 49297 + attributeIndex * 233) % 233280;
    return min + Math.floor((hash / 233280) * (max - min + 1));
  }
  
  // Генерируем значения атрибутов
  const baseStats = rarityBaseStats[rarity];
  const attributes = {
    power: generateAttributeValue(seed, 1, baseStats.min, baseStats.max),
    agility: generateAttributeValue(seed, 2, baseStats.min, baseStats.max),
    wisdom: generateAttributeValue(seed, 3, baseStats.min, baseStats.max),
    luck: generateAttributeValue(seed, 4, baseStats.min, baseStats.max)
  };
  
  return attributes;
}

/**
 * Создает коллекцию NFT в базе данных
 * @returns {Promise<{success: boolean, collectionId: number, error?: string}>}
 */
async function createNFTCollection() {
  try {
    // Проверяем, существует ли уже коллекция BAYC
    const existingCollections = await db.select()
      .from(nftCollections)
      .where(eq(nftCollections.name, config.collectionName));
    
    if (existingCollections.length > 0) {
      console.log(`Коллекция ${config.collectionName} уже существует с ID ${existingCollections[0].id}`);
      return { success: true, collectionId: existingCollections[0].id };
    }
    
    // Если коллекция не существует, создаем её
    console.log(`Создаем новую коллекцию ${config.collectionName}...`);
    const newCollection = await db.insert(nftCollections)
      .values({
        name: config.collectionName,
        description: "Bored Ape Yacht Club - это коллекция из 10,000 уникальных NFT обезьян, живущих в блокчейне Ethereum.",
        creator_id: config.regulatorId,
        image_url: `${config.imagePathBase}bayc_1.png`,
        created_at: new Date()
      })
      .returning();
    
    if (newCollection.length === 0) {
      throw new Error("Не удалось создать коллекцию");
    }
    
    console.log(`Создана новая коллекция с ID ${newCollection[0].id}`);
    return { success: true, collectionId: newCollection[0].id };
  } catch (error) {
    console.error("Ошибка при создании коллекции:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Импортирует пакет NFT в маркетплейс
 * @param {number} startId Начальный ID токена для импорта
 * @param {number} endId Конечный ID токена для импорта
 * @param {number} collectionId ID коллекции
 * @returns {Promise<{success: boolean, created: number, error?: string}>}
 */
async function importBAYCBatch(startId, endId, collectionId) {
  try {
    console.log(`Импорт пакета NFT с ID от ${startId} до ${endId}...`);
    let createdCount = 0;
    
    // Подготавливаем массив значений для вставки
    const nftValues = [];
    
    for (let tokenId = startId; tokenId <= endId; tokenId++) {
      // Определяем редкость NFT
      const rarity = determineRarity(tokenId);
      
      // Генерируем цену на основе редкости и ID
      const price = generateNFTPrice(tokenId, rarity);
      
      // Генерируем описание
      const description = generateNFTDescription(tokenId, rarity);
      
      // Генерируем атрибуты
      const attributes = generateNFTAttributes(tokenId, rarity);
      
      // Формируем путь к изображению
      const imagePath = `${config.imagePathBase}bayc_${tokenId}.png`;
      
      // Добавляем значения в массив
      nftValues.push({
        collectionId: collectionId,
        tokenId: tokenId.toString(),
        name: `Bored Ape #${tokenId}`,
        description: description,
        imagePath: imagePath,
        price: price.toString(),
        forSale: true,  // Все NFT выставлены на продажу в маркетплейсе
        ownerId: config.regulatorId, // Владелец - регулятор (админ)
        rarity: rarity,
        attributes: attributes,
        createdAt: new Date()
      });
      
      createdCount++;
    }
    
    // Вставляем все значения одним запросом
    if (nftValues.length > 0) {
      await db.insert(nfts).values(nftValues);
    }
    
    console.log(`Успешно импортирован пакет из ${createdCount} NFT с ID от ${startId} до ${endId}`);
    return { success: true, created: createdCount };
  } catch (error) {
    console.error("Ошибка при импорте пакета NFT:", error);
    return { success: false, created: 0, error: error.message };
  }
}

/**
 * Основная функция для запуска скрипта
 */
async function main() {
  console.log("Запуск скрипта для импорта полной коллекции BAYC (10 000 NFT) в маркетплейс...");
  
  // Создаем коллекцию NFT
  console.log("Создание коллекции NFT...");
  const { success, collectionId, error } = await createNFTCollection();
  
  if (!success) {
    console.error(`Ошибка при создании коллекции: ${error}`);
    return;
  }
  
  // Импортируем NFT партиями
  console.log(`Начинаем импорт NFT с ID от 0 до ${config.totalNFTCount - 1}...`);
  
  let totalCreated = 0;
  const batches = Math.ceil(config.totalNFTCount / config.batchSize);
  
  for (let batchIndex = 0; batchIndex < batches; batchIndex++) {
    const startId = batchIndex * config.batchSize;
    const endId = Math.min((batchIndex + 1) * config.batchSize - 1, config.totalNFTCount - 1);
    
    const batchResult = await importBAYCBatch(startId, endId, collectionId);
    
    if (batchResult.success) {
      totalCreated += batchResult.created;
      console.log(`Прогресс: ${Math.round(totalCreated / config.totalNFTCount * 100)}% (${totalCreated}/${config.totalNFTCount})`);
      
      // Короткая пауза между пакетами, чтобы избежать перегрузки
      if (batchIndex < batches - 1) {
        console.log("Пауза перед следующим пакетом...");
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } else {
      console.error(`Ошибка при импорте пакета ${batchIndex + 1}/${batches}: ${batchResult.error}`);
    }
  }
  
  console.log(`Импорт завершен. Всего создано ${totalCreated} NFT.`);
}

// Запускаем скрипт
main().catch(error => {
  console.error("Ошибка в основной функции:", error);
});
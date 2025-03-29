/**
 * Скрипт для создания всей коллекции Bored Ape Yacht Club (все 10 000 NFT)
 * Объединяет и перенумеровывает изображения из всех доступных источников
 * и создает все NFT в базе данных для маркетплейса
 */
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { createCanvas } from '@napi-rs/canvas';
import pg from 'pg';
const { Client } = pg;
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Импортируем модули базы данных
import { db, client } from './server/db.js';
import { nfts, nftCollections } from './shared/schema.js';
import { eq } from 'drizzle-orm';

// Настраиваем __dirname для ES модулей
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Конфигурация скрипта
const config = {
  // Источники изображений
  sources: [
    { path: './public/bayc_official', prefix: 'bayc_', maxDigits: 4 },
    { path: './bayc_official_nft', prefix: 'official_bayc_', maxDigits: 4 }, 
    { path: './temp_extract', prefix: '', maxDigits: 0 } // извлеченные файлы, разные форматы имен
  ],
  // Директория для объединенной коллекции
  targetDir: './new_bored_apes',
  // Количество NFT, которое нужно создать
  totalNFTCount: 10000,
  // ID регулятора/админа
  regulatorId: 5,
  // Количество NFT в одной партии для импорта (чтобы избежать таймаута)
  batchSize: 100,
  // Формат изображения
  imageFormat: 'png',
  // Предпочтительное расширение
  extension: '.png',
  // Альтернативные расширения для поиска
  altExtensions: ['.avif', '.jpg', '.jpeg'],
  // Количество генерируемых заглушек
  placeholderCount: 10,
  // Разнообразие цветов для заглушек
  placeholderColors: ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ff8800', '#88ff00', '#0088ff', '#ff0088'],
  // Базовый URL для изображений в БД
  imagePathBase: '/bayc_official/',
  // Имя коллекции
  collectionName: 'Bored Ape Yacht Club'
};

/**
 * Создает директорию, если она не существует
 * @param {string} dir Путь к директории
 */
function ensureDirectoryExists(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Получает все файлы с определенными расширениями из директории
 * @param {string} directoryPath Путь к директории
 * @param {string[]} extensions Массив расширений для поиска
 * @returns {string[]} Массив путей к файлам
 */
function getFilesWithExtensions(directoryPath, extensions) {
  try {
    const files = fs.readdirSync(directoryPath);
    return files.filter(file => {
      return extensions.some(ext => file.toLowerCase().endsWith(ext.toLowerCase()));
    }).map(file => path.join(directoryPath, file));
  } catch (error) {
    console.error(`Ошибка при чтении директории ${directoryPath}:`, error);
    return [];
  }
}

/**
 * Извлекает числовой ID из имени файла
 * @param {string} filename Имя файла
 * @returns {number|null} Извлеченный ID или null если не найден
 */
function extractIdFromFilename(filename) {
  // Пытаемся извлечь ID из различных форматов имен файлов
  const patterns = [
    /bayc_(\d+)/i,             // bayc_123.png
    /official_bayc_(\d+)/i,    // official_bayc_123.png
    /#(\d+)/i,                 // BAYC #123.png
    /\[(\d+)\]/i,              // BAYC [123].png
    /(\d+)\.png$/i,            // 123.png
    /-(\d+)\.png$/i,           // something-123.png
    /_(\d+)\.png$/i            // something_123.png
  ];
  
  const basename = path.basename(filename);
  
  for (const pattern of patterns) {
    const match = basename.match(pattern);
    if (match && match[1]) {
      return parseInt(match[1], 10);
    }
  }
  
  // Если не нашли ID по паттернам, пробуем поискать любую последовательность цифр
  const numericMatches = basename.match(/\d+/g);
  if (numericMatches && numericMatches.length > 0) {
    // Берем самую длинную последовательность цифр
    const longestMatch = numericMatches.reduce((a, b) => (a.length > b.length ? a : b));
    return parseInt(longestMatch, 10);
  }
  
  return null;
}

/**
 * Пытается вывести базовую информацию об файле изображения
 * @param {string} imagePath Путь к изображению
 */
function getImageInfo(imagePath) {
  return new Promise((resolve) => {
    exec(`file "${imagePath}"`, (error, stdout) => {
      if (error) {
        resolve({ valid: false, info: `Ошибка: ${error.message}` });
        return;
      }
      resolve({ valid: true, info: stdout.trim() });
    });
  });
}

/**
 * Генерирует изображение-заглушку с указанным ID и цветом
 * @param {number} id ID NFT
 * @param {string} color Цвет заглушки в формате #RRGGBB
 * @param {string} outputPath Путь для сохранения изображения
 */
async function generatePlaceholderImage(id, color, outputPath) {
  const width = 500;
  const height = 500;
  
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  
  // Заливаем фон
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
  
  // Добавляем текст с ID
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 60px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`BAYC #${id}`, width / 2, height / 2);
  
  // Добавляем рамку
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, width - 10, height - 10);
  
  // Сохраняем изображение
  const buffer = canvas.toBuffer(`image/${config.imageFormat}`);
  fs.writeFileSync(outputPath, buffer);
}

/**
 * Копирует изображение в целевую директорию с новым именем
 * @param {string} sourcePath Исходный путь к файлу
 * @param {string} targetPath Целевой путь к файлу
 */
function copyImage(sourcePath, targetPath) {
  try {
    fs.copyFileSync(sourcePath, targetPath);
    return true;
  } catch (error) {
    console.error(`Ошибка при копировании файла ${sourcePath} -> ${targetPath}:`, error);
    return false;
  }
}

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
        image_url: `${config.imagePathBase}bayc_1.${config.imageFormat}`,
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
 * @param {Object} importedImages Объект с информацией о импортированных изображениях
 * @returns {Promise<{success: boolean, created: number, error?: string}>}
 */
async function importBAYCBatch(startId, endId, collectionId, importedImages) {
  try {
    console.log(`Импорт пакета NFT с ID от ${startId} до ${endId}...`);
    let createdCount = 0;
    
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
      const imagePath = `${config.imagePathBase}bayc_${tokenId}.${config.imageFormat}`;
      
      try {
        // Создаем запись NFT в базе данных
        await db.insert(nfts)
          .values({
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
      } catch (error) {
        console.error(`Ошибка при создании NFT #${tokenId}:`, error);
      }
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
  console.log("Запуск скрипта для импорта коллекции BAYC в маркетплейс...");
  
  // Проверяем и создаем целевую директорию
  ensureDirectoryExists(config.targetDir);
  
  // Собираем все изображения из доступных источников
  const imageMap = new Map(); // ID -> путь к файлу
  const importedImages = { total: 0, sources: {} };
  
  console.log("Сканирование и объединение всех изображений из различных источников...");
  
  for (const source of config.sources) {
    const sourceDir = source.path;
    if (!fs.existsSync(sourceDir)) {
      console.log(`Директория ${sourceDir} не существует, пропускаем...`);
      continue;
    }
    
    const allExtensions = [config.extension, ...config.altExtensions];
    const files = getFilesWithExtensions(sourceDir, allExtensions);
    
    console.log(`Найдено ${files.length} файлов в директории ${sourceDir}`);
    importedImages.sources[sourceDir] = { found: files.length, imported: 0 };
    
    for (const file of files) {
      const id = extractIdFromFilename(file);
      if (id !== null && id >= 0 && id < config.totalNFTCount) {
        // Если уже есть изображение с таким ID, заменяем только если текущее предпочтительное
        if (!imageMap.has(id) || path.extname(file).toLowerCase() === config.extension.toLowerCase()) {
          imageMap.set(id, file);
          importedImages.sources[sourceDir].imported = (importedImages.sources[sourceDir].imported || 0) + 1;
        }
      }
    }
  }
  
  console.log(`Всего найдено ${imageMap.size} уникальных изображений`);
  importedImages.total = imageMap.size;
  
  // Копируем изображения в целевую директорию с правильной нумерацией
  let copyCount = 0;
  
  console.log("Копирование изображений в целевую директорию с правильной нумерацией...");
  
  for (const [id, srcPath] of imageMap.entries()) {
    const targetFileName = `bayc_${id}.${config.imageFormat}`;
    const targetPath = path.join(config.targetDir, targetFileName);
    
    if (copyImage(srcPath, targetPath)) {
      copyCount++;
      
      // Также копируем в публичную директорию для доступа через веб
      const publicDir = path.join('./public/bayc_official');
      ensureDirectoryExists(publicDir);
      copyImage(srcPath, path.join(publicDir, targetFileName));
    }
  }
  
  console.log(`Скопировано ${copyCount} изображений`);
  
  // Подготавливаем заглушки для недостающих изображений
  console.log("Подготовка заглушек для недостающих изображений...");
  
  // Создаем базовые заглушки разных цветов
  const placeholderDir = path.join('./public/assets/nft');
  ensureDirectoryExists(placeholderDir);
  
  for (let i = 0; i < config.placeholderCount; i++) {
    const placeholderPath = path.join(placeholderDir, `bayc_placeholder_${i}.${config.imageFormat}`);
    await generatePlaceholderImage(i, config.placeholderColors[i % config.placeholderColors.length], placeholderPath);
  }
  
  // Для всех отсутствующих ID используем заглушки (только копируем с изменением имени)
  let placeholderCount = 0;
  
  for (let id = 0; id < config.totalNFTCount; id++) {
    if (!imageMap.has(id)) {
      // Используем разнообразные заглушки
      const placeholderIndex = id % config.placeholderCount;
      const srcPlaceholder = path.join(placeholderDir, `bayc_placeholder_${placeholderIndex}.${config.imageFormat}`);
      
      // Копируем заглушки в целевые директории
      const targetFileName = `bayc_${id}.${config.imageFormat}`;
      const publicDir = path.join('./public/bayc_official');
      
      ensureDirectoryExists(publicDir);
      if (copyImage(srcPlaceholder, path.join(publicDir, targetFileName))) {
        placeholderCount++;
      }
    }
  }
  
  console.log(`Создано ${placeholderCount} заглушек для отсутствующих изображений`);
  
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
    
    const batchResult = await importBAYCBatch(startId, endId, collectionId, importedImages);
    
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
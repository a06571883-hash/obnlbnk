/**
 * Утилита для импорта NFT из коллекции Bored Ape Yacht Club в маркетплейс
 * Создает NFT объекты для каждого файла в папке bored_ape_nft и выставляет их на продажу
 */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { db } from '../db.js';
import { nfts, nftCollections } from '../../shared/schema.js';
import { eq } from 'drizzle-orm';

// Тип редкости NFT
type NFTRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

// Атрибуты NFT
interface NFTAttributes {
  power: number;
  agility: number;
  wisdom: number;
  luck: number;
}

// Регуляторный аккаунт (принадлежит админу)
const REGULATOR_USER_ID = 5; // ID администратора

/**
 * Основная функция импорта NFT
 */
export async function importBoredApesToMarketplace() {
  try {
    console.log('Начинаем импорт NFT из коллекции Bored Ape Yacht Club в маркетплейс...');
    
    // Директория, где хранятся изображения Bored Ape
    const nftDir = './bored_ape_nft';
    
    // Проверяем существование директории
    if (!fs.existsSync(nftDir)) {
      console.error(`Директория ${nftDir} не существует`);
      return { success: false, error: 'Директория с изображениями не найдена' };
    }
    
    // Получаем список всех файлов в директории
    const files = fs.readdirSync(nftDir);
    console.log(`Найдено ${files.length} файлов в директории ${nftDir}`);
    
    // Фильтруем, оставляя только изображения PNG и AVIF
    const imageFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ext === '.png' || ext === '.avif';
    });
    
    console.log(`Отфильтровано ${imageFiles.length} изображений`);
    
    // Убираем дубликаты (файлы с одинаковым именем, но разными расширениями)
    const uniqueImageFiles = new Set<string>();
    const processedFiles: string[] = [];
    
    imageFiles.forEach(file => {
      const basename = path.basename(file, path.extname(file));
      // Избегаем дубликатов, предпочитая PNG
      if (!uniqueImageFiles.has(basename) || file.endsWith('.png')) {
        uniqueImageFiles.add(basename);
        processedFiles.push(file);
      }
    });
    
    console.log(`Уникальных файлов для обработки: ${processedFiles.length}`);
    
    // Получаем или создаем коллекцию NFT для регуляторного аккаунта
    let collection = await getNFTCollectionForUser(REGULATOR_USER_ID);
    
    if (!collection) {
      collection = await createNFTCollectionForUser(REGULATOR_USER_ID);
    }
    
    console.log(`Используем коллекцию ID=${collection.id} пользователя ID=${REGULATOR_USER_ID}`);
    
    // Уже использованные пути к изображениям
    const existingImagePaths = await getExistingImagePaths();
    console.log(`В базе уже ${existingImagePaths.size} записей NFT`);
    
    // Создаем NFT для каждого файла
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    
    // Разбиваем файлы по категориям редкости
    const categorizedFiles = categorizeByRarity(processedFiles);
    
    // Создаем NFT для каждого файла по категориям
    for (const rarity of Object.keys(categorizedFiles) as NFTRarity[]) {
      const files = categorizedFiles[rarity];
      console.log(`Обрабатываем ${files.length} файлов категории ${rarity}`);
      
      for (const file of files) {
        try {
          // Формируем относительный путь к файлу
          const imagePath = `/bored_ape_nft/${file}`;
          
          // Проверяем, не существует ли уже NFT с таким путем к изображению
          if (existingImagePaths.has(imagePath)) {
            console.log(`Пропускаем ${imagePath} - уже существует в базе`);
            skipCount++;
            continue;
          }
          
          // Определяем цену на основе редкости
          const price = getPriceByRarity(rarity);
          
          // Формируем имя и описание NFT
          const name = generateNFTName(rarity, file);
          const description = generateNFTDescription(rarity);
          
          // Генерируем атрибуты NFT
          const attributes = generateNFTAttributes(rarity);
          
          // Текущая дата для поля mintedAt
          const mintedAt = new Date();
          
          // Генерируем уникальный tokenId
          const tokenId = `BAYC-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
          
          // Создаем NFT в базе данных
          await db.insert(nfts).values({
            collectionId: collection.id,
            ownerId: REGULATOR_USER_ID,
            name,
            description,
            imagePath,
            attributes,
            rarity,
            price: price.toString(), // Хранится как строка для предотвращения проблем с precision
            forSale: true, // Все NFT выставлены на продажу
            mintedAt,
            tokenId
          });
          
          successCount++;
          
          // Логируем каждые 10 NFT
          if (successCount % 10 === 0) {
            console.log(`Создано ${successCount} NFT, пропущено ${skipCount}, ошибок: ${errorCount}`);
          }
        } catch (error) {
          console.error(`Ошибка при создании NFT для файла ${file}:`, error);
          errorCount++;
        }
      }
    }
    
    console.log(`Импорт завершен. Создано ${successCount} NFT, пропущено ${skipCount}, ошибок: ${errorCount}`);
    
    return {
      success: true,
      created: successCount,
      skipped: skipCount,
      errors: errorCount
    };
  } catch (error) {
    console.error('Ошибка при импорте NFT:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Получает список уже использованных путей к изображениям
 */
async function getExistingImagePaths(): Promise<Set<string>> {
  const result = await db.select({ imagePath: nfts.imagePath }).from(nfts);
  return new Set(result.map(item => item.imagePath));
}

/**
 * Получает коллекцию NFT пользователя
 */
async function getNFTCollectionForUser(userId: number) {
  const collections = await db.select()
    .from(nftCollections)
    .where(eq(nftCollections.userId, userId));
  
  if (collections.length > 0) {
    return collections[0];
  }
  
  return null;
}

/**
 * Создает коллекцию NFT для пользователя
 */
async function createNFTCollectionForUser(userId: number) {
  const name = `Bored Ape Yacht Club - Marketplace`;
  const description = `Официальная коллекция Bored Ape Yacht Club. Содержит уникальные NFT из известной коллекции.`;

  try {  
    const result = await db.insert(nftCollections)
      .values({
        userId,
        name,
        description,
        createdAt: new Date()
      })
      .returning();
    
    return result[0];
  } catch (error) {
    console.error('Ошибка при создании коллекции NFT:', error);
    
    // В случае ошибки пробуем найти существующую коллекцию для этого пользователя
    const existingCollections = await db.select()
      .from(nftCollections)
      .where(eq(nftCollections.userId, userId));
    
    if (existingCollections.length > 0) {
      console.log(`Найдена существующая коллекция для пользователя ${userId}, используем её`);
      return existingCollections[0];
    }
    
    throw new Error(`Не удалось создать коллекцию NFT: ${error}`);
  }
}

/**
 * Распределяет файлы по категориям редкости
 */
function categorizeByRarity(files: string[]): Record<NFTRarity, string[]> {
  // Сортируем файлы по размеру (proxy для редкости)
  const fileStats = files.map(file => {
    const fullPath = path.join('./bored_ape_nft', file);
    let size = 0;
    try {
      const stats = fs.statSync(fullPath);
      size = stats.size;
    } catch (e) {
      console.error(`Ошибка при получении размера файла ${fullPath}:`, e);
    }
    return { file, size };
  });
  
  // Сортируем по размеру (от маленького к большому)
  fileStats.sort((a, b) => a.size - b.size);
  
  const totalFiles = fileStats.length;
  
  // Распределяем по категориям
  const result: Record<NFTRarity, string[]> = {
    common: [],
    uncommon: [],
    rare: [],
    epic: [],
    legendary: []
  };
  
  // 40% common
  result.common = fileStats.slice(0, Math.floor(totalFiles * 0.4)).map(f => f.file);
  
  // 30% uncommon
  result.uncommon = fileStats.slice(
    Math.floor(totalFiles * 0.4),
    Math.floor(totalFiles * 0.7)
  ).map(f => f.file);
  
  // 20% rare
  result.rare = fileStats.slice(
    Math.floor(totalFiles * 0.7),
    Math.floor(totalFiles * 0.9)
  ).map(f => f.file);
  
  // 8% epic
  result.epic = fileStats.slice(
    Math.floor(totalFiles * 0.9),
    Math.floor(totalFiles * 0.98)
  ).map(f => f.file);
  
  // 2% legendary
  result.legendary = fileStats.slice(
    Math.floor(totalFiles * 0.98)
  ).map(f => f.file);
  
  return result;
}

/**
 * Определяет цену NFT на основе редкости
 */
function getPriceByRarity(rarity: NFTRarity): number {
  switch (rarity) {
    case 'common':
      return randomInRange(20, 500);
    case 'uncommon':
      return randomInRange(500, 2000);
    case 'rare':
      return randomInRange(2000, 10000);
    case 'epic':
      return randomInRange(10000, 50000);
    case 'legendary':
      return randomInRange(50000, 300000);
    default:
      return 100;
  }
}

/**
 * Возвращает случайное число в заданном диапазоне
 */
function randomInRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

/**
 * Генерирует атрибуты NFT в зависимости от редкости
 */
function generateNFTAttributes(rarity: NFTRarity): NFTAttributes {
  // Базовые значения атрибутов в зависимости от редкости
  let minValue, maxValue;
  
  switch (rarity) {
    case 'common':
      minValue = 10;
      maxValue = 50;
      break;
    case 'uncommon':
      minValue = 30;
      maxValue = 70;
      break;
    case 'rare':
      minValue = 50;
      maxValue = 80;
      break;
    case 'epic':
      minValue = 70;
      maxValue = 90;
      break;
    case 'legendary':
      minValue = 85;
      maxValue = 99;
      break;
    default:
      minValue = 1;
      maxValue = 99;
  }
  
  // Генерируем случайные значения для каждого атрибута
  return {
    power: randomInRange(minValue, maxValue),
    agility: randomInRange(minValue, maxValue),
    wisdom: randomInRange(minValue, maxValue),
    luck: randomInRange(minValue, maxValue)
  };
}

/**
 * Генерирует имя NFT
 */
function generateNFTName(rarity: NFTRarity, filename?: string): string {
  const prefix = "Bored Ape";
  const rarityNames = {
    common: "Обычная",
    uncommon: "Необычная",
    rare: "Редкая",
    epic: "Эпическая",
    legendary: "Легендарная"
  };
  
  // Используем имя файла без расширения как основу, если оно предоставлено
  let baseName = "";
  if (filename) {
    baseName = path.basename(filename, path.extname(filename));
    // Сокращаем слишком длинные имена
    if (baseName.length > 15) {
      baseName = baseName.substring(0, 15);
    }
  }
  
  // Случайный суффикс для уникальности
  const uniqueSuffix = Math.floor(Math.random() * 10000);
  
  if (baseName) {
    return `${prefix} ${rarityNames[rarity]} #${baseName.substring(0, 5)}${uniqueSuffix}`;
  } else {
    return `${prefix} ${rarityNames[rarity]} #${uniqueSuffix}`;
  }
}

/**
 * Генерирует описание NFT
 */
function generateNFTDescription(rarity: NFTRarity): string {
  const descriptions = {
    common: [
      "Обычная обезьяна из клуба Bored Ape Yacht Club. Хорошее начало для коллекции.",
      "Стандартный представитель клуба BAYC. Имеет базовые характеристики.",
      "Распространенный экземпляр из коллекции Bored Ape. Отличный выбор для начинающих коллекционеров."
    ],
    uncommon: [
      "Необычная обезьяна с интересными характеристиками. Выделяется среди обычных экземпляров.",
      "Этот Bored Ape имеет необычные черты, которые делают его особенным.",
      "Выделяющийся представитель клуба BAYC с улучшенными характеристиками."
    ],
    rare: [
      "Редкий экземпляр из коллекции Bored Ape. Ценный актив с уникальными особенностями.",
      "Редкая обезьяна с выдающимися характеристиками. Настоящая находка для коллекционера.",
      "Этот редкий Bored Ape выделяется своей уникальностью и высокой ценностью."
    ],
    epic: [
      "Эпический Bored Ape с исключительными характеристиками. Очень редкий и ценный экземпляр.",
      "Невероятно редкий представитель клуба BAYC. Настоящее сокровище для коллекционеров.",
      "Этот эпический Bored Ape – гордость любой коллекции. Выдающиеся характеристики и редкость."
    ],
    legendary: [
      "Легендарный экземпляр из коллекции Bored Ape Yacht Club. Один из самых редких и ценных NFT.",
      "Исключительно редкий Bored Ape с максимальными характеристиками. Настоящая легенда мира NFT.",
      "Этот легендарный Bored Ape – вершина коллекции. Непревзойденная редкость и ценность."
    ]
  };
  
  // Выбираем случайное описание из массива для данной редкости
  const descriptionArray = descriptions[rarity];
  return descriptionArray[Math.floor(Math.random() * descriptionArray.length)];
}

/**
 * Функция для получения количества изображений в директории
 */
export async function countBoredApeImages(): Promise<{ total: number, png: number, avif: number }> {
  try {
    const nftDir = './bored_ape_nft';
    
    if (!fs.existsSync(nftDir)) {
      return { total: 0, png: 0, avif: 0 };
    }
    
    const files = fs.readdirSync(nftDir);
    const pngFiles = files.filter(file => file.toLowerCase().endsWith('.png'));
    const avifFiles = files.filter(file => file.toLowerCase().endsWith('.avif'));
    
    return {
      total: files.length,
      png: pngFiles.length,
      avif: avifFiles.length
    };
  } catch (error) {
    console.error('Ошибка при подсчете изображений:', error);
    return { total: 0, png: 0, avif: 0 };
  }
}


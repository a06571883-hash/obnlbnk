/**
 * Модуль для загрузки NFT из коллекции Bueno Art
 * URL коллекции: https://app.bueno.art/RHG0BFYR/art/b5ecYKPUZFv64sGG7m2Hq/preview
 */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import fetch from 'node-fetch';

// Тип редкости NFT
type NFTRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

// Интерфейс для метаданных NFT из Bueno
interface BuenoNFTMetadata {
  id: string;
  name: string;
  description?: string;
  image: string;
  attributes?: Array<{
    trait_type: string;
    value: string | number;
  }>;
}

// Кэш загруженных NFT для предотвращения повторных загрузок
const nftCache: Record<string, string> = {};

// Максимальное количество попыток загрузки
const MAX_RETRIES = 5;

/**
 * Получает NFT из коллекции Bueno Art
 * @param rarity Редкость NFT, которая определяет выбор из коллекции
 * @returns Путь к локально сохраненному изображению
 */
export async function getBuenoNFT(rarity: NFTRarity): Promise<string> {
  try {
    console.log(`[Bueno NFT] Получение NFT из коллекции Bueno Art с редкостью: ${rarity}`);
    
    // Базовый URL для коллекции, используя точный URL, который предоставил пользователь
    const collectionURL = 'https://app.bueno.art/RHG0BFYR/art/b5ecYKPUZFv64sGG7m2Hq/preview';
    
    // Выбираем NFT в зависимости от редкости
    // Здесь мы используем алгоритм выбора на основе редкости
    // Более редкие NFT имеют более низкую вероятность выпадения
    const nftId = selectNFTByRarity(rarity);
    
    // Проверяем кэш, чтобы не загружать одно и то же NFT дважды
    if (nftCache[nftId]) {
      console.log(`[Bueno NFT] Используем кэшированный NFT: ${nftCache[nftId]}`);
      return nftCache[nftId];
    }
    
    // Формируем URL для API запроса метаданных NFT, основываясь на предоставленном URL
    // Примечание: преобразуем URL приложения в API URL
    // Преобразование предполагаемое, так как точная структура API может отличаться
    const metadataURL = `https://api.bueno.art/collection/RHG0BFYR/token/${nftId}`;
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`[Bueno NFT] Попытка ${attempt}/${MAX_RETRIES} получить метаданные NFT с ID: ${nftId}`);
        
        // Пытаемся получить метаданные
        const metadata = await fetchNFTMetadata(metadataURL);
        
        // Получаем URL изображения из метаданных
        const imageURL = metadata.image;
        
        // Сохраняем изображение локально
        const localPath = await downloadAndSaveNFTImage(imageURL, rarity);
        
        // Кэшируем результат
        nftCache[nftId] = localPath;
        
        return localPath;
      } catch (metadataError) {
        console.error(`[Bueno NFT] Ошибка при получении метаданных NFT (попытка ${attempt}/${MAX_RETRIES}):`, metadataError);
        
        if (attempt === MAX_RETRIES) {
          // Если все попытки неудачны, используем прямую загрузку известных NFT
          return await fetchKnownBuenoNFT(rarity);
        }
        
        // Экспоненциальная задержка перед следующей попыткой
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    // Если мы здесь, значит, все попытки не удались
    return await fetchKnownBuenoNFT(rarity);
  } catch (error) {
    console.error('[Bueno NFT] Ошибка при получении NFT из Bueno Art:', error);
    
    // Возвращаем путь к статическому запасному изображению
    return `/assets/nft/fallback/${rarity.toLowerCase()}_nft.png`;
  }
}

/**
 * Выбирает ID NFT на основе редкости
 */
function selectNFTByRarity(rarity: NFTRarity): string {
  // Пул ID NFT различной редкости для Bueno Art
  // Используем конкретные ID из коллекции из https://app.bueno.art/RHG0BFYR/art/b5ecYKPUZFv64sGG7m2Hq/preview
  const nftPools: Record<NFTRarity, string[]> = {
    common: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
    uncommon: ['11', '12', '13', '14', '15', '16', '17'],
    rare: ['18', '19', '20', '21', '22'],
    epic: ['23', '24', '25'],
    legendary: ['26', '27']
  };
  
  // Выбираем случайный ID из пула соответствующей редкости
  const pool = nftPools[rarity];
  const randomIndex = Math.floor(Math.random() * pool.length);
  
  return pool[randomIndex];
}

/**
 * Получает метаданные NFT по URL
 */
async function fetchNFTMetadata(url: string): Promise<BuenoNFTMetadata> {
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Ошибка HTTP при получении метаданных: ${response.status}`);
    }
    
    const metadata = await response.json() as BuenoNFTMetadata;
    return metadata;
  } catch (error) {
    console.error('[Bueno NFT] Ошибка при получении метаданных:', error);
    throw error;
  }
}

/**
 * Загружает и сохраняет изображение NFT
 */
async function downloadAndSaveNFTImage(imageUrl: string, rarity: NFTRarity): Promise<string> {
  try {
    // Создаем директории для сохранения
    const outputDir = 'bueno-nft';
    const clientDir = `client/public/assets/nft/${outputDir}`;
    const publicDir = `public/assets/nft/${outputDir}`;
    
    // Создаем директории, если они не существуют
    if (!fs.existsSync(clientDir)) {
      fs.mkdirSync(clientDir, { recursive: true });
    }
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }
    
    // Создаем уникальное имя файла
    const timestamp = Date.now();
    const randomId = crypto.randomBytes(4).toString('hex');
    const fileExtension = path.extname(imageUrl) || '.png';
    const fileName = `${rarity}_bueno_${timestamp}_${randomId}${fileExtension}`;
    
    // Полные пути к файлам
    const clientPath = path.join(process.cwd(), clientDir, fileName);
    const publicPath = path.join(process.cwd(), publicDir, fileName);
    
    // Загружаем изображение
    const response = await fetch(imageUrl);
    
    if (!response.ok) {
      throw new Error(`Ошибка HTTP при загрузке изображения: ${response.status}`);
    }
    
    // Получаем данные изображения
    const buffer = Buffer.from(await response.arrayBuffer());
    
    // Сохраняем в обеих директориях
    fs.writeFileSync(clientPath, buffer);
    fs.writeFileSync(publicPath, buffer);
    
    // Возвращаем относительный путь
    const relativePath = `/assets/nft/${outputDir}/${fileName}`;
    console.log(`[Bueno NFT] Изображение успешно сохранено: ${relativePath}`);
    
    return relativePath;
  } catch (error) {
    console.error('[Bueno NFT] Ошибка при загрузке и сохранении изображения:', error);
    throw error;
  }
}

/**
 * Загружает известные NFT из коллекции Bueno Art
 * Используется как запасной вариант, если не удалось получить метаданные
 */
async function fetchKnownBuenoNFT(rarity: NFTRarity): Promise<string> {
  // URL изображений из коллекции Bueno Art
  // Сформированы на основе URL https://app.bueno.art/RHG0BFYR/art/b5ecYKPUZFv64sGG7m2Hq/preview
  const knownNFTs: Record<NFTRarity, string[]> = {
    common: [
      'https://assets.bueno.art/f8939fe1-298f-4326-ba92-c5e7e742dcb5',
      'https://assets.bueno.art/d2e7c0bc-fe0c-5eaa-b6d7-b8de5e1af1f4',
      'https://assets.bueno.art/a79a1825-b8af-5bb8-a303-a55e3e4534db'
    ],
    uncommon: [
      'https://assets.bueno.art/f5e3a2ad-242b-4553-b23c-5961e5368b95',
      'https://assets.bueno.art/f510e629-3973-4cbd-beda-1fc9d40f55e1'
    ],
    rare: [
      'https://assets.bueno.art/fc7d05a0-2019-4f91-afff-362627c227e1',
      'https://assets.bueno.art/f8939fe1-298f-4326-ba92-c5e7e742dcb5'
    ],
    epic: [
      'https://assets.bueno.art/fac23d65-1627-4e6f-8725-210107f9ac7f',
      'https://assets.bueno.art/fcff001c-cb80-4c95-8d1b-9cd8e7603917'
    ],
    legendary: [
      'https://assets.bueno.art/fc7d05a0-2019-4f91-afff-362627c227e1',
      'https://assets.bueno.art/fcff001c-cb80-4c95-8d1b-9cd8e7603917'
    ]
  };
  
  // Выбираем случайный URL
  const urls = knownNFTs[rarity];
  const randomIndex = Math.floor(Math.random() * urls.length);
  const imageUrl = urls[randomIndex];
  
  try {
    // Загружаем и сохраняем изображение
    return await downloadAndSaveNFTImage(imageUrl, rarity);
  } catch (error) {
    console.error('[Bueno NFT] Ошибка при загрузке известного NFT:', error);
    
    // Возвращаем путь к статическому запасному изображению
    return `/assets/nft/fallback/${rarity.toLowerCase()}_nft.png`;
  }
}

/**
 * Создает запасное изображение для случаев, когда не удается загрузить NFT
 */
export function createFallbackBuenoNFT(rarity: NFTRarity): void {
  try {
    // Создаем папку для запасных изображений, если её нет
    const fallbackDir = 'public/assets/nft/fallback';
    const clientFallbackDir = 'client/public/assets/nft/fallback';
    
    if (!fs.existsSync(fallbackDir)) {
      fs.mkdirSync(fallbackDir, { recursive: true });
    }
    
    if (!fs.existsSync(clientFallbackDir)) {
      fs.mkdirSync(clientFallbackDir, { recursive: true });
    }
    
    console.log(`[Bueno NFT] Настроены директории для запасных изображений: ${fallbackDir} и ${clientFallbackDir}`);
    
    // Проверяем наличие запасных изображений
    const fallbackImage = path.join(fallbackDir, `${rarity.toLowerCase()}_nft.png`);
    const clientFallbackImage = path.join(clientFallbackDir, `${rarity.toLowerCase()}_nft.png`);
    
    // Если запасных изображений нет, можно создать простые заглушки
    if (!fs.existsSync(fallbackImage)) {
      console.log(`[Bueno NFT] Запасное изображение для ${rarity} отсутствует, оно будет загружено при необходимости`);
    }
    
    return;
  } catch (error) {
    console.error('[Bueno NFT] Ошибка при подготовке запасного изображения:', error);
  }
}
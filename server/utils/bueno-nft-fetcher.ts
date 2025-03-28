/**
 * Модуль для загрузки NFT из коллекции Bueno Art
 * URL коллекции: https://bueno.art/rhg0bfyr/ooo-bnal-bank
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

/**
 * Получает NFT из коллекции Bueno Art
 * @param rarity Редкость NFT, которая определяет выбор из коллекции
 * @returns Путь к локально сохраненному изображению
 */
export async function getBuenoNFT(rarity: NFTRarity): Promise<string> {
  try {
    console.log(`[Bueno NFT] Получение NFT из коллекции Bueno Art с редкостью: ${rarity}`);
    
    // Базовый URL для коллекции
    const collectionURL = 'https://bueno.art/rhg0bfyr/ooo-bnal-bank';
    
    // Выбираем NFT в зависимости от редкости
    // Здесь мы используем алгоритм выбора на основе редкости
    // Более редкие NFT имеют более низкую вероятность выпадения
    const nftId = selectNFTByRarity(rarity);
    
    // Проверяем кэш, чтобы не загружать одно и то же NFT дважды
    if (nftCache[nftId]) {
      console.log(`[Bueno NFT] Используем кэшированный NFT: ${nftCache[nftId]}`);
      return nftCache[nftId];
    }
    
    // Формируем URL для API запроса метаданных NFT
    // Примечание: фактический API URL может отличаться, здесь пример
    const metadataURL = `https://api.bueno.art/v1/collections/rhg0bfyr/tokens/${nftId}`;
    
    try {
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
      console.error('[Bueno NFT] Ошибка при получении метаданных NFT:', metadataError);
      
      // Если не удалось получить метаданные, используем прямую загрузку известных NFT
      return await fetchKnownBuenoNFT(rarity);
    }
  } catch (error) {
    console.error('[Bueno NFT] Ошибка при получении NFT из Bueno Art:', error);
    
    // Возвращаем путь к статическому запасному изображению
    return `/assets/nft/fixed/${rarity}_luxury_car_1.jpg`;
  }
}

/**
 * Выбирает ID NFT на основе редкости
 */
function selectNFTByRarity(rarity: NFTRarity): string {
  // Пул ID NFT различной редкости
  // Это предварительные ID, в реальном коде нужны актуальные ID из коллекции
  const nftPools: Record<NFTRarity, string[]> = {
    common: ['1', '2', '3', '4', '5'],
    uncommon: ['6', '7', '8', '9'],
    rare: ['10', '11', '12'],
    epic: ['13', '14'],
    legendary: ['15']
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
  // URL изображений из коллекции
  // Это заглушки, в реальном коде нужны фактические URL
  const knownNFTs: Record<NFTRarity, string[]> = {
    common: [
      'https://bueno.art/rhg0bfyr/ooo-bnal-bank/images/1',
      'https://bueno.art/rhg0bfyr/ooo-bnal-bank/images/2',
    ],
    uncommon: [
      'https://bueno.art/rhg0bfyr/ooo-bnal-bank/images/6',
      'https://bueno.art/rhg0bfyr/ooo-bnal-bank/images/7',
    ],
    rare: [
      'https://bueno.art/rhg0bfyr/ooo-bnal-bank/images/10',
      'https://bueno.art/rhg0bfyr/ooo-bnal-bank/images/11',
    ],
    epic: [
      'https://bueno.art/rhg0bfyr/ooo-bnal-bank/images/13',
    ],
    legendary: [
      'https://bueno.art/rhg0bfyr/ooo-bnal-bank/images/15',
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
    return `/assets/nft/fixed/${rarity}_luxury_car_1.jpg`;
  }
}

/**
 * Создает запасное изображение для случаев, когда не удается загрузить NFT
 */
export function createFallbackBuenoNFT(rarity: NFTRarity): void {
  try {
    console.log(`[Bueno NFT] Используем существующие изображения в папке fixed для рарности: ${rarity}`);
    return;
  } catch (error) {
    console.error('[Bueno NFT] Ошибка при подготовке запасного изображения:', error);
  }
}
/**
 * Модуль для загрузки NFT из коллекции Bored Ape Yacht Club
 */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// Тип редкости NFT
type NFTRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

// Кэш загруженных NFT для предотвращения повторных загрузок
const nftCache: Record<string, string> = {};

// Отслеживаем используемые изображения NFT
const usedNFTImages: Set<string> = new Set();

/**
 * Получает NFT из коллекции Bored Ape
 * @param rarity Редкость NFT, которая определяет выбор из коллекции
 * @returns Путь к локально сохраненному изображению
 */
export async function getBoredApeNFT(rarity: NFTRarity): Promise<string> {
  try {
    console.log(`[Bored Ape NFT] Получение NFT из коллекции Bored Ape с редкостью: ${rarity}`);
    
    // Директория, где хранятся изображения Bored Ape
    const nftDir = './bored_ape_nft';
    
    // Проверяем существование директории
    if (!fs.existsSync(nftDir)) {
      console.error(`[Bored Ape NFT] Директория ${nftDir} не существует`);
      fs.mkdirSync(nftDir, { recursive: true });
      console.log(`[Bored Ape NFT] Создана директория ${nftDir}`);
    }
    
    // Создаем кэш-ключ на основе редкости
    const cacheKey = `bored_ape_${rarity}_${crypto.randomBytes(4).toString('hex')}`;
    
    // Проверяем кэш
    if (nftCache[cacheKey]) {
      console.log(`[Bored Ape NFT] Используем кэшированный NFT: ${nftCache[cacheKey]}`);
      return nftCache[cacheKey];
    }
    
    // Получаем список всех файлов в директории
    const files = fs.readdirSync(nftDir);
    console.log(`[Bored Ape NFT] Найдено ${files.length} файлов в директории ${nftDir}`);
    
    // Фильтруем только изображения (PNG и AVIF)
    const imageFiles = files.filter(file => 
      (file.endsWith('.png') || file.endsWith('.avif')) && 
      !file.includes('fallback')
    );
    
    console.log(`[Bored Ape NFT] Найдено ${imageFiles.length} изображений для NFT`);
    
    // Если изображений нет, используем запасное изображение
    if (imageFiles.length === 0) {
      console.log(`[Bored Ape NFT] Не найдены изображения в директории ${nftDir}`);
      
      // Проверяем директорию с запасными изображениями
      const fallbackDir = './public/assets/nft/fallback';
      if (!fs.existsSync(fallbackDir)) {
        fs.mkdirSync(fallbackDir, { recursive: true });
        console.log(`[Bored Ape NFT] Создана директория ${fallbackDir}`);
      }
      
      // Используем запасное изображение
      const fallbackPath = `/public/assets/nft/fallback/${rarity.toLowerCase()}_nft.png`;
      const absoluteFallbackPath = `.${fallbackPath}`;
      
      console.log(`[Bored Ape NFT] Используем запасное изображение: ${fallbackPath}`);
      
      return fallbackPath;
    }
    
    // Получаем пул изображений на основе редкости
    let nftPool = filterByRarity(imageFiles, rarity);
    
    // Отфильтровываем уже использованные изображения
    const availableImages = nftPool.filter(image => !usedNFTImages.has(image));
    
    // Если все изображения уже использованы, сбрасываем отслеживание
    if (availableImages.length === 0) {
      console.log('[Bored Ape NFT] Все изображения использованы, сбрасываем отслеживание');
      usedNFTImages.clear();
      nftPool = filterByRarity(imageFiles, rarity);
    } else {
      nftPool = availableImages;
    }
    
    // Выбираем случайное изображение из пула
    const randomIndex = Math.floor(Math.random() * nftPool.length);
    const selectedImage = nftPool[randomIndex];
    
    // Отмечаем изображение как использованное
    usedNFTImages.add(selectedImage);
    
    // Формируем относительный путь к изображению
    const relativePath = `/bored_ape_nft/${selectedImage}`;
    
    // Кэшируем результат
    nftCache[cacheKey] = relativePath;
    
    console.log(`[Bored Ape NFT] Выбрано уникальное изображение: ${selectedImage}`);
    
    return relativePath;
  } catch (error) {
    console.error('[Bored Ape NFT] Ошибка при получении NFT:', error);
    
    // Проверяем директорию с запасными изображениями
    const fallbackDir = './public/assets/nft/fallback';
    if (!fs.existsSync(fallbackDir)) {
      fs.mkdirSync(fallbackDir, { recursive: true });
      console.log(`[Bored Ape NFT] Создана директория ${fallbackDir} (из catch)`);
    }
    
    // Используем запасное изображение
    const fallbackPath = `/public/assets/nft/fallback/${rarity.toLowerCase()}_nft.png`;
    const absoluteFallbackPath = `.${fallbackPath}`;
    
    console.log(`[Bored Ape NFT] Используем запасное изображение: ${fallbackPath} (из catch)`);
    
    // Возвращаем путь к статическому запасному изображению
    return fallbackPath;
  }
}

/**
 * Фильтрует изображения по редкости
 * Используем эвристику: более редкие NFT имеют больший размер файла
 */
function filterByRarity(files: string[], rarity: NFTRarity): string[] {
  // Полный путь к директории
  const nftDir = './bored_ape_nft';
  
  // Собираем информацию о размерах файлов
  const fileStats = files.map(file => {
    const filePath = path.join(nftDir, file);
    const stats = fs.statSync(filePath);
    return { file, size: stats.size };
  });
  
  // Сортируем файлы по размеру (от маленького к большому)
  fileStats.sort((a, b) => a.size - b.size);
  
  // Разбиваем на группы по редкости на основе размера файла
  const totalFiles = fileStats.length;
  let selectedFiles: string[] = [];
  
  switch(rarity) {
    case 'common':
      // 40% самых маленьких файлов
      selectedFiles = fileStats.slice(0, Math.floor(totalFiles * 0.4)).map(f => f.file);
      break;
    case 'uncommon':
      // 30% файлов после common
      selectedFiles = fileStats.slice(
        Math.floor(totalFiles * 0.4), 
        Math.floor(totalFiles * 0.7)
      ).map(f => f.file);
      break;
    case 'rare':
      // 20% файлов после uncommon
      selectedFiles = fileStats.slice(
        Math.floor(totalFiles * 0.7), 
        Math.floor(totalFiles * 0.9)
      ).map(f => f.file);
      break;
    case 'epic':
      // 8% файлов после rare
      selectedFiles = fileStats.slice(
        Math.floor(totalFiles * 0.9), 
        Math.floor(totalFiles * 0.98)
      ).map(f => f.file);
      break;
    case 'legendary':
      // 2% самых больших файлов
      selectedFiles = fileStats.slice(
        Math.floor(totalFiles * 0.98)
      ).map(f => f.file);
      break;
  }
  
  // Если по какой-то причине группа пуста, вернем все файлы
  if (selectedFiles.length === 0) {
    console.log(`[Bored Ape NFT] Пустая группа для редкости ${rarity}, возвращаем все файлы`);
    return files;
  }
  
  return selectedFiles;
}

/**
 * Проверяет наличие файлов NFT и создает директории при необходимости
 */
export function checkBoredApeNFTFiles(): void {
  try {
    // Проверяем директорию с загруженной коллекцией
    const nftDir = './bored_ape_nft';
    
    // Директории для публичных файлов
    const publicDir = 'public/assets/nft/bored_ape';
    const clientDir = 'client/public/assets/nft/bored_ape';
    
    // Создаем директории для публичных файлов при необходимости
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
      console.log(`[Bored Ape NFT] Создана директория ${publicDir}`);
    }
    
    if (!fs.existsSync(clientDir)) {
      fs.mkdirSync(clientDir, { recursive: true });
      console.log(`[Bored Ape NFT] Создана директория ${clientDir}`);
    }
    
    // Проверяем наличие файлов в директории с оригинальной коллекцией
    if (fs.existsSync(nftDir)) {
      const files = fs.readdirSync(nftDir);
      const imageFiles = files.filter(file => file.endsWith('.png') || file.endsWith('.avif'));
      
      console.log(`[Bored Ape NFT] Найдено ${imageFiles.length} файлов изображений в ${nftDir}`);
      
      if (imageFiles.length === 0) {
        console.warn('[Bored Ape NFT] Предупреждение: Файлы NFT отсутствуют в директории коллекции');
      }
    } else {
      console.warn(`[Bored Ape NFT] Предупреждение: Директория ${nftDir} не существует`);
    }
  } catch (error) {
    console.error('[Bored Ape NFT] Ошибка при проверке файлов:', error);
  }
}
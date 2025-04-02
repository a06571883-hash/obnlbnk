/**
 * Обработка путей к изображениям через прокси для обеспечения
 * правильной доставки и типов MIME
 * 
 * ВАЖНОЕ ОБНОВЛЕНИЕ: Полностью переработана логика обработки изображений
 * Mutant Ape NFT для гарантированного корректного отображения
 */

// Для дебаггинга - включите, если необходимо видеть все преобразования путей в консоли
const DEBUG_MODE = true;

/**
 * Определяет тип коллекции NFT на основе пути к изображению
 */
enum NFTCollectionType {
  BORED_APE = 'bored',
  MUTANT_APE = 'mutant',
  MUTANT_APE_OFFICIAL = 'official',
  OTHER = 'other'
}

/**
 * Определяет тип коллекции на основе пути к изображению
 * 
 * @param imagePath Путь к изображению NFT
 * @returns Тип коллекции
 */
function detectCollectionType(imagePath: string): NFTCollectionType {
  if (!imagePath) return NFTCollectionType.OTHER;
  
  // Проверяем случаи с Mutant Ape с максимальной гибкостью
  // ВАЖНО: сначала идут самые конкретные проверки
  if (imagePath.includes('mutant_ape_official')) {
    return NFTCollectionType.MUTANT_APE_OFFICIAL;
  } else if (
      imagePath.includes('mutant_ape_nft') || 
      imagePath.includes('mutant_ape/') || 
      imagePath.includes('/mutant_ape') || 
      imagePath.includes('nft_assets/mutant_ape')
  ) {
    return NFTCollectionType.MUTANT_APE;
  } else if (
      imagePath.includes('bored_ape_nft') || 
      imagePath.includes('bayc_official') || 
      imagePath.includes('/bored_ape/')
  ) {
    return NFTCollectionType.BORED_APE;
  }
  
  // Дополнительная проверка на основе имени файла
  // Если в имени файла содержится mutant_ape, то это Mutant Ape
  if (imagePath.includes('mutant_ape')) {
    return NFTCollectionType.MUTANT_APE;
  } else if (imagePath.includes('bored_ape')) {
    return NFTCollectionType.BORED_APE;
  }
  
  return NFTCollectionType.OTHER;
}

/**
 * Извлекает номер NFT из пути к изображению
 * 
 * @param imagePath Путь к изображению
 * @returns Номер NFT или случайное число в случае ошибки
 */
function extractNFTNumber(imagePath: string): number {
  // Различные форматы имен файлов, которые мы поддерживаем
  const patterns = [
    /mutant_ape_(\d+)\.png/i,  // mutant_ape_0123.png
    /bored_ape_(\d+)\.png/i,   // bored_ape_0123.png
    /ape_(\d+)\.png/i,         // ape_0123.png
    /nft_(\d+)\.png/i          // nft_0123.png
  ];
  
  for (const pattern of patterns) {
    const matches = imagePath.match(pattern);
    if (matches && matches[1]) {
      return parseInt(matches[1], 10);
    }
  }
  
  // Если номер не найден, возвращаем случайное число
  return Math.floor(Math.random() * 1000);
}

/**
 * Преобразует стандартный путь изображения NFT в прокси-путь
 * для корректной загрузки через наш специальный сервер изображений
 * 
 * @param imagePath Исходный путь к изображению
 * @returns Модифицированный путь через прокси, если это NFT изображение
 */
export function getProxiedImageUrl(imagePath: string): string {
  // Защита от null/undefined
  if (!imagePath) {
    if (DEBUG_MODE) console.log('🚫 Пустой путь к изображению, используем placeholder');
    return `/nft-proxy/assets/nft/placeholder.png?fallback=true`;
  }

  if (DEBUG_MODE) console.log('🔄 Обработка пути к изображению:', imagePath);

  // Абсолютный URL - возвращаем как есть
  if (imagePath.startsWith('http')) {
    if (DEBUG_MODE) console.log('🌐 Абсолютный URL, возвращаем без изменений:', imagePath);
    return imagePath;
  }

  // Если путь относительный, добавляем слэш в начало
  if (!imagePath.startsWith('/')) {
    const newPath = '/' + imagePath;
    if (DEBUG_MODE) console.log('🔧 Исправление относительного пути:', imagePath, '->', newPath);
    imagePath = newPath;
  }

  // Определяем тип коллекции
  const collectionType = detectCollectionType(imagePath);
  
  // Если это не NFT-изображение, возвращаем как есть
  if (collectionType === NFTCollectionType.OTHER && 
      !imagePath.includes('nft_assets') && 
      !imagePath.includes('new_bored_ape')) {
    if (DEBUG_MODE) console.log('📷 Обычное изображение, возвращаем как есть:', imagePath);
    return imagePath;
  }
  
  // Базовые параметры для всех NFT
  const timestamp = new Date().getTime();
  const random = Math.floor(Math.random() * 1000000);
  
  // Дополнительные специфичные параметры в зависимости от типа коллекции
  switch (collectionType) {
    case NFTCollectionType.MUTANT_APE:
    case NFTCollectionType.MUTANT_APE_OFFICIAL: {
      const nftNumber = extractNFTNumber(imagePath);
      const isOfficial = collectionType === NFTCollectionType.MUTANT_APE_OFFICIAL;
      
      // Специальные параметры для гарантированной загрузки Mutant Ape NFT
      // Определяем директорию на основе пути и типа коллекции
      let imageDir = 'mutant_ape_nft';
      if (isOfficial) {
        imageDir = 'mutant_ape_official';
      } else if (imagePath.includes('nft_assets/mutant_ape')) {
        imageDir = 'nft_assets/mutant_ape';
      }
      
      const enhancedPath = `/nft-proxy${imagePath}?v=${timestamp}&r=${random}&collection=${isOfficial ? 'official' : 'mutant'}&nocache=true&mutant=true&n=${nftNumber}&force=true&dir=${imageDir}`;
      
      if (DEBUG_MODE) {
        console.log(`${isOfficial ? '🔵' : '🟢'} MUTANT APE ${isOfficial ? '(OFFICIAL)' : ''} #${nftNumber}: ${imagePath} -> ${enhancedPath}, dir=${imageDir}`);
      }
      
      return enhancedPath;
    }
    
    case NFTCollectionType.BORED_APE: {
      const nftNumber = extractNFTNumber(imagePath);
      const proxiedPath = `/nft-proxy${imagePath}?v=${timestamp}&r=${random}&collection=bored&nocache=true&n=${nftNumber}`;
      
      if (DEBUG_MODE) {
        console.log(`🟠 BORED APE #${nftNumber}: ${imagePath} -> ${proxiedPath}`);
      }
      
      return proxiedPath;
    }
    
    default: {
      // Для других типов NFT
      const proxiedPath = `/nft-proxy${imagePath}?v=${timestamp}&r=${random}&nocache=true`;
      
      if (DEBUG_MODE) {
        console.log(`⚪ ДРУГОЙ NFT: ${imagePath} -> ${proxiedPath}`);
      }
      
      return proxiedPath;
    }
  }
}
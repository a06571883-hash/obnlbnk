/**
 * Обработка путей к изображениям через прокси для обеспечения
 * правильной доставки и типов MIME
 */

/**
 * Преобразует стандартный путь изображения NFT в прокси-путь
 * для корректной загрузки через наш специальный сервер изображений
 * 
 * @param imagePath Исходный путь к изображению
 * @returns Модифицированный путь через прокси, если это NFT изображение
 */
export function getProxiedImageUrl(imagePath: string): string {
  if (!imagePath) {
    // Для пустого пути используем стандартное изображение
    console.log('Пустой путь к изображению, используем placeholder');
    return `/nft-proxy/assets/nft/placeholder.png`;
  }

  console.log('Обработка пути к изображению NFT:', imagePath);

  // Абсолютный URL - возвращаем как есть
  if (imagePath.startsWith('http')) {
    console.log('Это абсолютный URL, возвращаем без изменений:', imagePath);
    return imagePath;
  }

  // Если путь относительный, добавляем слэш в начало
  if (!imagePath.startsWith('/')) {
    const newPath = '/' + imagePath;
    console.log('Преобразование относительного пути:', imagePath, '->', newPath);
    imagePath = newPath;
  }

  // Решение для проблемы с дублирующимися изображениями Mutant Ape
  // Проверяем особый случай - если в пути изображения имеется Mutant Ape обезьяна с номером
  if (imagePath.includes('mutant_ape_nft') || imagePath.includes('mutant_ape_official')) {
    // Определяем тип коллекции
    const isOfficial = imagePath.includes('mutant_ape_official');
    
    // Регулярное выражение, подходящее для обоих типов коллекций
    const match = imagePath.match(/mutant_ape_(\d+)\.png$/);
    if (match && match[1]) {
      const apeNumber = parseInt(match[1]);
      
      // Добавляем случайные микросекунды к URL, чтобы обойти кеширование браузера
      // и заставить его заново загрузить изображение
      const timestamp = new Date().getTime() + Math.floor(Math.random() * 1000);
      
      // Добавляем специальное логирование в зависимости от типа коллекции
      if (isOfficial) {
        console.log(`OFFICIAL MUTANT APE ENHANCED PATH: номер обезьяны=${apeNumber}, оригинальный путь=${imagePath}`);
      } else {
        console.log(`REGULAR MUTANT APE ENHANCED PATH: номер обезьяны=${apeNumber}, оригинальный путь=${imagePath}`);
      }
      
      // Используем относительный путь для проксирования через наш API с добавлением уникального параметра
      // Добавляем индикатор коллекции в параметры
      const collectionType = isOfficial ? 'official' : 'regular';
      const enhancedPath = `/nft-proxy${imagePath}?v=${timestamp}&collection=${collectionType}`;
      console.log(`Проксирование ${isOfficial ? 'Official' : 'Regular'} Mutant Ape с защитой от кеширования:`, imagePath, '->', enhancedPath);
      return enhancedPath;
    }
  }

  // Перенаправляем через прокси любые NFT изображения,
  // включая BAYC и Mutant Ape (включая официальную коллекцию)
  if (imagePath.includes('bayc_official') || 
      imagePath.includes('bored_ape_nft') || 
      imagePath.includes('mutant_ape_nft') ||
      imagePath.includes('mutant_ape_official') ||
      imagePath.includes('new_bored_ape') ||
      imagePath.includes('nft_assets')) {
    
    // Добавляем параметр collection для всех Mutant Ape изображений
    let proxiedPath = `/nft-proxy${imagePath}`;
    
    // Проверяем тип коллекции Mutant Ape
    if (imagePath.includes('mutant_ape_nft') || imagePath.includes('mutant_ape_official')) {
      const isOfficial = imagePath.includes('mutant_ape_official');
      const collectionType = isOfficial ? 'official' : 'regular';
      
      // Добавляем параметр collection к URL
      proxiedPath = `${proxiedPath}?collection=${collectionType}`;
      
      // Добавляем специальное логирование для Mutant Ape
      console.log(`${isOfficial ? 'OFFICIAL' : 'REGULAR'} MUTANT APE IMAGE PATH:`, imagePath, '->', proxiedPath);
    } else {
      console.log('Проксирование NFT изображения:', imagePath, '->', proxiedPath);
    }
    
    return proxiedPath;
  }

  // Для других изображений возвращаем исходный путь
  console.log('Обычное изображение (не NFT), возвращаем как есть:', imagePath);
  return imagePath;
}
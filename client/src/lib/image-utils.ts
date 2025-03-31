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

  // Перенаправляем через прокси любые NFT изображения с особой обработкой для различных коллекций
  if (imagePath.includes('bayc_official') || 
      imagePath.includes('bored_ape_nft') || 
      imagePath.includes('mutant_ape') ||  // Любой тип Mutant Ape
      imagePath.includes('new_bored_ape') ||
      imagePath.includes('nft_assets')) {
    
    // Генерируем временную метку для обхода кеша браузера
    const timestamp = new Date().getTime() + Math.floor(Math.random() * 1000);
    
    // Особая обработка для Mutant Ape (оба типа)
    if (imagePath.includes('mutant_ape')) {
      // Определяем тип коллекции
      const isOfficial = imagePath.includes('mutant_ape_official');
      const collectionType = isOfficial ? 'official' : 'regular';
      
      // Улучшенный формат с дополнительными параметрами
      const enhancedPath = `/nft-proxy${imagePath}?v=${timestamp}&collection=${collectionType}&nocache=true&mutant=true`;
      
      console.log(`${isOfficial ? '🔵' : '🟢'} ${isOfficial ? 'OFFICIAL' : 'REGULAR'} MUTANT APE: ${imagePath} -> ${enhancedPath}`);
      return enhancedPath;
    }
    
    // Для Bored Ape NFT тоже добавляем метку времени и идентификатор коллекции
    if (imagePath.includes('bored_ape_nft')) {
      const proxiedPath = `/nft-proxy${imagePath}?v=${timestamp}&collection=bored&nocache=true`;
      console.log('Проксирование Bored Ape NFT с меткой времени:', imagePath, '->', proxiedPath);
      return proxiedPath;
    }
    
    // Для остальных NFT используем обычное проксирование с меткой времени
    const proxiedPath = `/nft-proxy${imagePath}?v=${timestamp}`;
    console.log('Проксирование NFT изображения:', imagePath, '->', proxiedPath);
    return proxiedPath;
  }

  // Для других изображений возвращаем исходный путь
  console.log('Обычное изображение (не NFT), возвращаем как есть:', imagePath);
  return imagePath;
}
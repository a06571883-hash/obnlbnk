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

  // Перенаправляем через прокси любые NFT изображения,
  // включая BAYC и Mutant Ape (включая официальную коллекцию)
  if (imagePath.includes('bayc_official') || 
      imagePath.includes('bored_ape_nft') || 
      imagePath.includes('mutant_ape_nft') ||
      imagePath.includes('mutant_ape_official') ||
      imagePath.includes('new_bored_ape') ||
      imagePath.includes('nft_assets')) {
    // Используем относительный путь для проксирования через наш API
    const proxiedPath = `/nft-proxy${imagePath}`;
    
    // Добавляем специальное логирование для Mutant Ape (обеих коллекций)
    if (imagePath.includes('mutant_ape_nft')) {
      console.log('MUTANT APE IMAGE PATH:', imagePath, '->', proxiedPath);
    }
    
    // Добавляем отдельное логирование для официальной коллекции Mutant Ape
    if (imagePath.includes('mutant_ape_official')) {
      console.log('OFFICIAL MUTANT APE IMAGE PATH:', imagePath, '->', proxiedPath);
    }
    
    console.log('Проксирование NFT изображения:', imagePath, '->', proxiedPath);
    return proxiedPath;
  }

  // Для других изображений возвращаем исходный путь
  console.log('Обычное изображение (не NFT), возвращаем как есть:', imagePath);
  return imagePath;
}
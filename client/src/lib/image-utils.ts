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
    return '/assets/nft/fallback/common_nft.svg';
  }

  console.log('Обработка пути к изображению NFT:', imagePath);

  // Абсолютный URL - возвращаем как есть
  if (imagePath.startsWith('http')) {
    return imagePath;
  }

  // Если путь относительный, добавляем слэш в начало
  if (!imagePath.startsWith('/')) {
    imagePath = '/' + imagePath;
  }

  // Используем запасное изображение, если у нас путь к обезьяне с высоким ID
  // (для оптимизации загрузки)
  if (imagePath.includes('bored_ape_nft')) {
    const match = imagePath.match(/bored_ape_(\d+)/);
    if (match) {
      const id = parseInt(match[1], 10);
      if (id > 2000) {
        // Используем стандартное изображение для высоких ID
        return '/assets/nft/fallback/bayc_nft.svg';
      }
    }
  }

  // Проверка на Mutant Ape - если отсутствует, используем заглушку
  if (imagePath.includes('mutant_ape_nft')) {
    return '/assets/nft/fallback/mutant_ape_nft.svg';
  }

  // Перенаправляем через прокси любые NFT изображения,
  // включая BAYC и Mutant Ape
  if (imagePath.includes('bayc_official') || 
      imagePath.includes('bored_ape_nft') || 
      imagePath.includes('mutant_ape_nft') ||
      imagePath.includes('new_bored_ape') ||
      imagePath.includes('nft_assets')) {
    // Используем относительный путь для проксирования через наш API
    return `/nft-proxy${imagePath}`;
  }

  // Для других изображений возвращаем исходный путь
  return imagePath;
}
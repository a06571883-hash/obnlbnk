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
    return `/nft-proxy/assets/nft/placeholder.png`;
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
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
    return '/assets/nft/fallback/common_nft.png';
  }

  // Преобразуем пути к NFT изображениям из Bored Ape Yacht Club коллекции
  if (imagePath.includes('/bayc_official/')) {
    // Перенаправляем запрос через прокси
    return `/nft-proxy${imagePath}`;
  }

  // Если путь относительный, добавляем слэш в начало
  if (!imagePath.startsWith('/') && !imagePath.startsWith('http')) {
    imagePath = '/' + imagePath;
  }

  // Для других изображений возвращаем исходный путь
  return imagePath;
}
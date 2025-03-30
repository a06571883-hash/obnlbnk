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
    // Обеспечиваем прямой доступ через сервер изображений на порту 8080
    return `http://localhost:8080${imagePath}`;
  }

  // Для других изображений возвращаем исходный путь
  return imagePath;
}
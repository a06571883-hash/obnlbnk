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
    // Генерируем случайное число от 0 до 1759 для выбора реального BAYC изображения
    const randomId = Math.floor(Math.random() * 1760);
    // Форматируем номер с ведущими нулями (0000, 0001 и т.д.)
    const paddedId = randomId.toString().padStart(4, '0');
    return `/nft-proxy/bored_ape_nft/bored_ape_${paddedId}.png`;
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

  // Используем реальное изображение, даже если у нас путь к обезьяне с высоким ID
  // Всегда показываем настоящие изображения вместо SVG заглушек
  if (imagePath.includes('bored_ape_nft')) {
    const match = imagePath.match(/bored_ape_(\d+)/);
    if (match) {
      const id = parseInt(match[1], 10);
      if (id > 2000) {
        // Генерируем случайное число от 0 до 1759 для выбора реального BAYC изображения
        const randomId = Math.floor(Math.random() * 1760);
        // Форматируем номер с ведущими нулями (0000, 0001 и т.д.)
        const paddedId = randomId.toString().padStart(4, '0');
        return `/nft-proxy/bored_ape_nft/bored_ape_${paddedId}.png`;
      }
    }
  }

  // Для Mutant Ape используем реальное изображение вместо заглушки
  if (imagePath.includes('mutant_ape_nft')) {
    // Генерируем случайное число от 15000 до 15103 для выбора реального Mutant Ape изображения
    const randomId = Math.floor(Math.random() * 104) + 15000;
    return `/nft-proxy/mutant_ape_nft/mutant_ape_${randomId}.png`;
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
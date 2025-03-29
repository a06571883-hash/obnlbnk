/**
 * Модуль с функциями для создания запасных изображений NFT
 * Используется, когда не удается загрузить изображения из коллекции Bored Ape
 */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// Тип редкости NFT
type NFTRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

/**
 * Создает запасное изображение NFT для указанной редкости
 * @param rarity Редкость NFT
 * @returns Путь к созданному файлу
 */
export function createFallbackBoredApeNFT(rarity: NFTRarity): string {
  try {
    console.log(`[Bored Ape Fallback] Создаем запасное изображение для редкости: ${rarity}`);
    
    // Директории для файлов
    const clientDir = 'client/public/assets/nft/fallback';
    const publicDir = 'public/assets/nft/fallback';
    
    // Создаем директории, если они не существуют
    if (!fs.existsSync(clientDir)) {
      fs.mkdirSync(clientDir, { recursive: true });
    }
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }
    
    // Формируем имя файла
    const fileName = `${rarity.toLowerCase()}_nft.png`;
    
    // Пути к файлам
    const clientPath = path.join(clientDir, fileName);
    const publicPath = path.join(publicDir, fileName);
    
    // Проверяем, существуют ли уже файлы
    if (fs.existsSync(publicPath) && fs.existsSync(clientPath)) {
      console.log(`[Bored Ape Fallback] Запасное изображение уже существует: ${fileName}`);
      return `/assets/nft/fallback/${fileName}`;
    }
    
    // Генерируем простое цветное изображение в зависимости от редкости
    // Это минимальное базовое изображение, которое будет использоваться только если 
    // не удалось загрузить реальные изображения Bored Ape
    const colors: Record<NFTRarity, string> = {
      common: '#68A357', // Зеленый
      uncommon: '#3D85C6', // Синий
      rare: '#9900FF', // Фиолетовый
      epic: '#FF9900', // Оранжевый
      legendary: '#FF0000' // Красный
    };
    
    // Создаем базовое SVG-изображение
    const svgContent = generateFallbackSVG(rarity, colors[rarity]);
    
    // Сохраняем SVG в обе директории
    fs.writeFileSync(clientPath, svgContent);
    fs.writeFileSync(publicPath, svgContent);
    
    console.log(`[Bored Ape Fallback] Успешно создано запасное изображение: ${fileName}`);
    
    return `/assets/nft/fallback/${fileName}`;
  } catch (error) {
    console.error('[Bored Ape Fallback] Ошибка при создании запасного изображения:', error);
    return `/assets/nft/fallback_error.png`;
  }
}

/**
 * Генерирует SVG-контент для запасного изображения
 */
function generateFallbackSVG(rarity: NFTRarity, color: string): string {
  // Создаем простое SVG с текстом, указывающим редкость NFT
  return `
  <svg width="400" height="400" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="${color}" />
    <rect x="10" y="10" width="380" height="380" fill="none" stroke="#ffffff" stroke-width="3" />
    
    <text x="200" y="180" font-family="Arial" font-size="40" fill="#ffffff" text-anchor="middle">BORED APE</text>
    <text x="200" y="230" font-family="Arial" font-size="36" fill="#ffffff" text-anchor="middle">${rarity.toUpperCase()}</text>
    <text x="200" y="300" font-family="Arial" font-size="16" fill="#ffffff" text-anchor="middle">Fallback Image</text>
  </svg>
  `;
}
/**
 * Упрощенный генератор изображений для NFT, создающий миллионы уникальных вариаций без внешних API
 * Использует базовые изображения роскошных предметов и алгоритмическую модификацию для создания уникальности
 */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import sharp from 'sharp';

// Типы редкости NFT
type NFTRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

/**
 * Генерирует уникальное изображение для NFT с помощью sharp (без внешних API)
 * 
 * @param rarity Редкость NFT
 * @returns Путь к сгенерированному изображению
 */
export async function generateUniqueImage(rarity: NFTRarity): Promise<string> {
  console.log(`[Image Processor] Создание уникального NFT изображения для редкости: ${rarity}`);
  
  try {
    // Получаем базовое изображение в зависимости от редкости
    const basePath = getRandomBasePath(rarity);
    
    // Полный путь к файлу
    const baseImagePath = path.join(process.cwd(), 'public', basePath);
    
    if (!fs.existsSync(baseImagePath)) {
      throw new Error(`Базовое изображение не найдено по пути: ${baseImagePath}`);
    }
    
    console.log(`[Image Processor] Загружено базовое изображение: ${basePath}`);
    
    // Загружаем изображение с помощью sharp
    let sharpImage = sharp(baseImagePath);
    
    // Получаем метаданные изображения (размеры и т.д.)
    const metadata = await sharpImage.metadata();
    
    // Создаем уникальный идентификатор для изображения
    const timestamp = Date.now();
    const randomId = crypto.randomBytes(8).toString('hex');
    
    // Применяем несколько эффектов в зависимости от редкости
    sharpImage = await applyEffects(sharpImage, metadata, rarity, randomId);
    
    // Добавляем уникальную подпись-идентификатор
    sharpImage = await addWatermark(sharpImage, metadata, rarity, randomId);
    
    // Сохраняем модифицированное изображение
    const outputPath = await saveGeneratedImage(sharpImage, rarity, timestamp, randomId);
    
    console.log(`[Image Processor] Изображение успешно сохранено: ${outputPath}`);
    
    return outputPath;
  } catch (error) {
    console.error('[Image Processor] Ошибка при генерации изображения:', error);
    throw error;
  }
}

/**
 * Получает случайный путь к базовому изображению в зависимости от редкости
 */
function getRandomBasePath(rarity: NFTRarity): string {
  // Категории предметов роскоши
  const categories = ['car', 'watch', 'diamond', 'mansion', 'cash'];
  
  // Выбираем случайную категорию с дополнительной энтропией
  const randomValue = Date.now() % categories.length;
  const secondaryRandomValue = crypto.randomBytes(1)[0] % categories.length;
  const categoryIndex = (randomValue + secondaryRandomValue) % categories.length;
  const category = categories[categoryIndex];
  
  // Формируем путь к базовому изображению
  return `/assets/nft/fixed/${rarity}_luxury_${category}_1.jpg`;
}

/**
 * Применяет несколько эффектов к изображению для создания уникального варианта
 */
async function applyEffects(image: sharp.Sharp, metadata: sharp.Metadata, rarity: NFTRarity, seed: string): Promise<sharp.Sharp> {
  // Количество эффектов зависит от редкости
  const effectsCount = 1 + getRarityLevel(rarity);
  
  // Конвертируем seed в число для детерминированной генерации
  const seedNumber = parseInt(seed.substring(0, 8), 16);
  
  // Доступные эффекты
  const effects = [
    'brightness', 
    'contrast', 
    'hue', 
    'blur', 
    'sepia', 
    'tint'
  ];
  
  // Применяем несколько эффектов
  let modifiedImage = image.clone();
  
  // Создаем объект с параметрами для sharp
  let sharpParams: any = {};
  
  // Настройки для эффектов
  for (let i = 0; i < effectsCount; i++) {
    // Выбираем эффект на основе seed и порядкового номера
    const effectIndex = (seedNumber + i * 123) % effects.length;
    const effect = effects[effectIndex];
    
    // Интенсивность эффекта (небольшая, чтобы сохранить узнаваемость)
    const intensity = 0.05 + (0.05 * (seedNumber % 10) / 10) + (0.01 * getRarityLevel(rarity));
    
    console.log(`[Image Processor] Применение эффекта ${effect} с интенсивностью ${intensity.toFixed(2)}`);
    
    switch (effect) {
      case 'brightness':
        // Изменяем яркость (значения от -0.1 до +0.1)
        sharpParams.brightness = intensity * 2;
        break;
        
      case 'contrast':
        // Увеличиваем контраст (значения от 0 до 0.2)
        sharpParams.contrast = 1 + intensity;
        break;
        
      case 'hue':
        // Изменяем оттенок
        const hue = Math.floor(seedNumber % 30) * (intensity * 10);
        sharpParams.hue = Math.floor(hue);
        break;
        
      case 'blur':
        // Небольшое размытие
        const blurAmount = Math.max(0.3, intensity * 2);
        modifiedImage = modifiedImage.blur(blurAmount);
        break;
        
      case 'sepia':
        // Эффект сепии
        modifiedImage = modifiedImage.tint({ r: 112, g: 66, b: 20 });
        break;
        
      case 'tint':
        // Добавляем цветовой оттенок в зависимости от редкости
        const color = getRarityColorRgb(rarity, seedNumber);
        // Применяем тонирование с небольшой насыщенностью
        modifiedImage = modifiedImage.tint(color);
        break;
    }
  }
  
  // Применяем изменения цвета и контраста
  if (Object.keys(sharpParams).length > 0) {
    modifiedImage = modifiedImage.modulate(sharpParams);
  }
  
  // Добавляем виньетку для более редких NFT
  if (getRarityLevel(rarity) >= 3) {
    const vignetteIntensity = 0.2 + (getRarityLevel(rarity) - 3) * 0.05;
    modifiedImage = await addVignette(modifiedImage, metadata, vignetteIntensity);
  }
  
  return modifiedImage;
}

/**
 * Добавляет эффект виньетки (затемнение по краям)
 */
async function addVignette(image: sharp.Sharp, metadata: sharp.Metadata, intensity: number): Promise<sharp.Sharp> {
  const width = metadata.width || 800;
  const height = metadata.height || 600;
  
  // Создаем овальную маску для виньетки
  const mask = Buffer.alloc(width * height);
  const centerX = width / 2;
  const centerY = height / 2;
  const maxDistance = Math.sqrt(centerX * centerX + centerY * centerY);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - centerX;
      const dy = y - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Вычисляем значение прозрачности (0-255)
      // Чем дальше от центра, тем темнее
      let alpha = 255 - (distance / maxDistance) * 255 * intensity * 2;
      alpha = Math.max(0, Math.min(255, alpha));
      
      // Записываем значение в буфер маски
      mask[y * width + x] = Math.floor(alpha);
    }
  }
  
  // Применяем виньетку через композицию
  return image.composite([
    {
      input: {
        create: {
          width,
          height,
          channels: 1,
          background: { r: 0, g: 0, b: 0 }
        }
      },
      blend: 'multiply',
      gravity: 'centre',
      tile: false,
      raw: {
        width,
        height,
        channels: 1
      },
      density: mask
    }
  ]);
}

/**
 * Добавляет водяной знак с идентификатором NFT
 */
async function addWatermark(image: sharp.Sharp, metadata: sharp.Metadata, rarity: NFTRarity, id: string): Promise<sharp.Sharp> {
  // Формируем короткий идентификатор
  const shortId = id.substring(0, 8);
  
  // Формируем текст водяного знака
  const watermarkText = `Bnalbank NFT ${shortId}`;
  
  // Создаем наложение с текстом (в простой версии используем SVG для текста)
  const width = metadata.width || 800;
  const height = metadata.height || 600;
  
  // Определяем цвет в зависимости от редкости
  const textColor = getTextColorByRarity(rarity);
  
  // Создаем SVG с текстом
  const svgText = `
    <svg width="${width}" height="${height}">
      <style>
        .watermark { 
          font-family: Arial; 
          font-size: 14px; 
          fill: ${textColor}; 
          fill-opacity: 0.8;
        }
      </style>
      <text 
        x="${width - 150}" 
        y="${height - 20}" 
        class="watermark"
      >${watermarkText}</text>
    </svg>
  `;
  
  // Применяем водяной знак через композицию
  return image.composite([
    {
      input: Buffer.from(svgText),
      gravity: 'southeast',
    }
  ]);
}

/**
 * Сохраняет сгенерированное изображение
 */
async function saveGeneratedImage(image: sharp.Sharp, rarity: NFTRarity, timestamp: number, randomId: string): Promise<string> {
  // Создаем уникальное имя файла
  const fileName = `${rarity}_enhanced_${timestamp}_${randomId}.jpg`;
  
  // Пути для сохранения файлов
  const clientDir = 'client/public/assets/nft/enhanced';
  const publicDir = 'public/assets/nft/enhanced';
  
  // Создаем директории, если они не существуют
  if (!fs.existsSync(clientDir)) {
    fs.mkdirSync(clientDir, { recursive: true });
  }
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }
  
  // Пути к файлам
  const clientFilePath = path.join(process.cwd(), clientDir, fileName);
  const publicFilePath = path.join(process.cwd(), publicDir, fileName);
  
  // Задаем параметры для сохранения JPEG (качество 90%)
  const outputOptions = { quality: 90 };
  
  // Сохраняем изображение в обе директории
  await image.clone().jpeg(outputOptions).toFile(clientFilePath);
  await image.clone().jpeg(outputOptions).toFile(publicFilePath);
  
  // Возвращаем относительный путь к изображению
  return `/assets/nft/enhanced/${fileName}`;
}

/**
 * Получает числовой уровень редкости (1-5)
 */
function getRarityLevel(rarity: NFTRarity): number {
  const rarityLevels: Record<NFTRarity, number> = {
    common: 1,
    uncommon: 2,
    rare: 3,
    epic: 4,
    legendary: 5
  };
  
  return rarityLevels[rarity];
}

/**
 * Получает цвет в формате RGB объекта в зависимости от редкости
 */
function getRarityColorRgb(rarity: NFTRarity, seedNumber: number): { r: number, g: number, b: number } {
  // Добавляем небольшую вариацию к цветам для большей уникальности
  const variation = seedNumber % 30 - 15;
  
  switch (rarity) {
    case 'common':
      return { 
        r: Math.max(0, Math.min(255, 200 + variation)), 
        g: Math.max(0, Math.min(255, 200 + variation)), 
        b: Math.max(0, Math.min(255, 200 + variation)) 
      };
    case 'uncommon':
      return { 
        r: Math.max(0, Math.min(255, 100 + variation)), 
        g: Math.max(0, Math.min(255, 200 + variation)), 
        b: Math.max(0, Math.min(255, 100 + variation)) 
      };
    case 'rare':
      return { 
        r: Math.max(0, Math.min(255, 100 + variation)), 
        g: Math.max(0, Math.min(255, 100 + variation)), 
        b: Math.max(0, Math.min(255, 220 + variation)) 
      };
    case 'epic':
      return { 
        r: Math.max(0, Math.min(255, 200 + variation)), 
        g: Math.max(0, Math.min(255, 100 + variation)), 
        b: Math.max(0, Math.min(255, 200 + variation)) 
      };
    case 'legendary':
      return { 
        r: Math.max(0, Math.min(255, 220 + variation)), 
        g: Math.max(0, Math.min(255, 200 + variation)), 
        b: Math.max(0, Math.min(255, 100 + variation)) 
      };
    default:
      return { r: 200, g: 200, b: 200 };
  }
}

/**
 * Получает цвет текста в зависимости от редкости
 */
function getTextColorByRarity(rarity: NFTRarity): string {
  switch (rarity) {
    case 'common':
      return 'rgba(255, 255, 255, 0.8)';
    case 'uncommon':
      return 'rgba(100, 255, 100, 0.8)';
    case 'rare':
      return 'rgba(100, 150, 255, 0.8)';
    case 'epic':
      return 'rgba(255, 100, 255, 0.8)';
    case 'legendary':
      return 'rgba(255, 215, 0, 0.8)'; // Gold
    default:
      return 'rgba(255, 255, 255, 0.8)';
  }
}
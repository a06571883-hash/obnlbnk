/**
 * Упрощенный генератор изображений для NFT, создающий миллионы уникальных вариаций без внешних API
 * Использует базовые изображения роскошных предметов и алгоритмическую модификацию для создания уникальности
 */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as JimpLib from 'jimp';
const Jimp = JimpLib;

// Типы редкости NFT
type NFTRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

/**
 * Генерирует уникальное изображение для NFT с помощью Jimp (без внешних API)
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
    
    // Загружаем изображение с помощью Jimp
    const image = await Jimp.read(baseImagePath);
    
    // Создаем уникальный идентификатор для изображения
    const timestamp = Date.now();
    const randomId = crypto.randomBytes(8).toString('hex');
    
    // Применяем несколько эффектов в зависимости от редкости
    await applyEffects(image, rarity, randomId);
    
    // Добавляем уникальную подпись-идентификатор
    addWatermark(image, rarity, randomId);
    
    // Сохраняем модифицированное изображение
    const outputPath = await saveGeneratedImage(image, rarity, timestamp, randomId);
    
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
async function applyEffects(image: Jimp, rarity: NFTRarity, seed: string): Promise<void> {
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
    'overlay'
  ];
  
  // Применяем несколько эффектов
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
        image.brightness(intensity - 0.05);
        break;
        
      case 'contrast':
        // Увеличиваем контраст (значения от 0 до 0.2)
        image.contrast(intensity);
        break;
        
      case 'hue':
        // Изменяем оттенок (значения от 0 до 30 градусов)
        const hue = Math.floor(seedNumber % 30) * (intensity * 10);
        image.colour(hue, 0, 0);
        break;
        
      case 'blur':
        // Небольшое размытие
        const blurAmount = Math.max(1, Math.floor(intensity * 3));
        image.blur(blurAmount);
        break;
        
      case 'sepia':
        // Эффект сепии
        image.sepia();
        break;
        
      case 'overlay':
        // Добавляем цветовой оттенок в зависимости от редкости
        const color = getRarityColor(rarity);
        const colorOverlay = new Jimp(image.getWidth(), image.getHeight(), color);
        colorOverlay.opacity(intensity * 0.3); // Очень низкая непрозрачность
        image.composite(colorOverlay, 0, 0, {
          mode: Jimp.BLEND_OVERLAY,
          opacitySource: intensity * 0.3,
          opacityDest: 1
        });
        break;
    }
  }
  
  // Добавляем небольшой эффект виньетки для более редких NFT
  if (getRarityLevel(rarity) >= 3) {
    addVignette(image, 0.15 + (getRarityLevel(rarity) - 3) * 0.05);
  }
}

/**
 * Добавляет эффект виньетки (затемнение по краям)
 */
function addVignette(image: Jimp, intensity: number): void {
  const width = image.getWidth();
  const height = image.getHeight();
  const centerX = width / 2;
  const centerY = height / 2;
  const maxDistance = Math.sqrt(centerX * centerX + centerY * centerY);
  
  // Для каждого пикселя
  image.scan(0, 0, width, height, function(this: any, x: number, y: number, idx: number) {
    // Вычисляем расстояние от центра
    const distX = x - centerX;
    const distY = y - centerY;
    const distance = Math.sqrt(distX * distX + distY * distY);
    
    // Вычисляем фактор затемнения (чем дальше от центра, тем темнее)
    const factor = 1 - (distance / maxDistance) * intensity * 2;
    
    // Не затемняем центральную область
    if (factor < 1) {
      // Затемняем пиксель
      const red = this.bitmap.data[idx + 0];
      const green = this.bitmap.data[idx + 1];
      const blue = this.bitmap.data[idx + 2];
      
      this.bitmap.data[idx + 0] = Math.max(0, Math.min(255, Math.floor(red * factor)));
      this.bitmap.data[idx + 1] = Math.max(0, Math.min(255, Math.floor(green * factor)));
      this.bitmap.data[idx + 2] = Math.max(0, Math.min(255, Math.floor(blue * factor)));
    }
  });
}

/**
 * Добавляет водяной знак с идентификатором NFT
 */
function addWatermark(image: Jimp, rarity: NFTRarity, id: string): void {
  // Формируем короткий идентификатор
  const shortId = id.substring(0, 8);
  
  // Загружаем шрифт (будет использован встроенный шрифт Jimp)
  Jimp.loadFont(Jimp.FONT_SANS_16_WHITE).then(font => {
    // Формируем текст водяного знака
    const watermarkText = `Bnalbank NFT ${shortId}`;
    
    // Определяем положение текста (в правом нижнем углу)
    const textWidth = Jimp.measureText(font, watermarkText);
    const x = image.getWidth() - textWidth - 20;
    const y = image.getHeight() - 30;
    
    // Добавляем текст на изображение
    image.print(font, x, y, watermarkText);
  }).catch(e => {
    console.error('[Image Processor] Ошибка при добавлении водяного знака:', e);
  });
}

/**
 * Сохраняет сгенерированное изображение
 */
async function saveGeneratedImage(image: Jimp, rarity: NFTRarity, timestamp: number, randomId: string): Promise<string> {
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
  
  // Сохраняем изображение в обе директории
  await image.writeAsync(clientFilePath);
  await image.writeAsync(publicFilePath);
  
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
 * Получает цвет в формате Jimp в зависимости от редкости
 */
function getRarityColor(rarity: NFTRarity): number {
  switch (rarity) {
    case 'common':
      return Jimp.rgbaToInt(200, 200, 200, 255);
    case 'uncommon':
      return Jimp.rgbaToInt(100, 200, 100, 255);
    case 'rare':
      return Jimp.rgbaToInt(100, 100, 220, 255);
    case 'epic':
      return Jimp.rgbaToInt(200, 100, 200, 255);
    case 'legendary':
      return Jimp.rgbaToInt(220, 200, 100, 255);
    default:
      return Jimp.rgbaToInt(200, 200, 200, 255);
  }
}
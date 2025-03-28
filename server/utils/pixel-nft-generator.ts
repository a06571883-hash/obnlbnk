/**
 * Генератор пиксельных NFT изображений в неоновом стиле
 * Создает яркие, красочные NFT изображения в ретро-пиксельном стиле
 */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { createCanvas } from '@napi-rs/canvas';

// Типы редкости NFT
type NFTRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

// Категории для пиксельных NFT
type PixelArtCategory = 'car' | 'mansion' | 'character' | 'cityscape' | 'animal';

/**
 * Создает уникальное пиксельное NFT изображение на основе редкости и категории
 * @param rarity - Редкость NFT
 * @returns Путь к сгенерированному изображению
 */
export async function generatePixelNFTImage(rarity: NFTRarity): Promise<string> {
  try {
    console.log(`[PixelNFT] Генерация пиксельного NFT изображения с редкостью: ${rarity}`);
    
    // Случайно выбираем категорию
    const categories: PixelArtCategory[] = ['car', 'mansion', 'character', 'cityscape', 'animal'];
    const randomCategory = categories[Math.floor(Math.random() * categories.length)];
    
    console.log(`[PixelNFT] Выбрана категория: ${randomCategory}`);
    
    // Создаем уникальный идентификатор для изображения
    const timestamp = Date.now();
    const randomId = crypto.randomBytes(8).toString('hex');
    
    // Получаем параметры цвета и сложности в зависимости от редкости
    const params = getPixelArtParamsByRarity(rarity, randomId);
    
    // Генерируем пиксельное изображение
    const imageBuffer = await createPixelArtImage(
      randomCategory,
      params.colors,
      params.complexity,
      params.pixelSize,
      randomId
    );
    
    // Создаем директории для сохранения изображений
    const outputDir = 'pixel-nft';
    const clientDir = `client/public/assets/nft/${outputDir}`;
    const publicDir = `public/assets/nft/${outputDir}`;
    
    // Создаем директории, если они не существуют
    if (!fs.existsSync(clientDir)) {
      fs.mkdirSync(clientDir, { recursive: true });
    }
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }
    
    // Создаем уникальное имя файла
    const fileName = `${rarity}_${randomCategory}_${timestamp}_${randomId.substring(0, 8)}.png`;
    
    // Сохраняем изображение в обе директории
    const clientFilePath = path.join(process.cwd(), clientDir, fileName);
    const publicFilePath = path.join(process.cwd(), publicDir, fileName);
    
    fs.writeFileSync(clientFilePath, imageBuffer);
    fs.writeFileSync(publicFilePath, imageBuffer);
    
    console.log(`[PixelNFT] Изображение успешно сохранено: /assets/nft/${outputDir}/${fileName}`);
    
    // Возвращаем путь к файлу
    return `/assets/nft/${outputDir}/${fileName}`;
  } catch (error) {
    console.error('[PixelNFT] Ошибка при генерации пиксельного NFT:', error);
    
    // Возвращаем путь к запасному статическому изображению по редкости
    const fallbackPath = `/assets/nft/pixel-fallback/${rarity}.png`;
    
    // Проверим существование запасного файла
    const fullPath = path.join(process.cwd(), 'public', fallbackPath);
    
    if (fs.existsSync(fullPath)) {
      return fallbackPath;
    } else {
      // Если запасного файла нет, создаем простой SVG
      const svgContent = createFallbackSVG(rarity);
      const fallbackSvgPath = `/assets/nft/pixel-fallback/${rarity}.svg`;
      const fullSvgPath = path.join(process.cwd(), 'public', fallbackSvgPath);
      
      // Создаем директорию для запасных изображений
      const fallbackDir = path.dirname(fullSvgPath);
      if (!fs.existsSync(fallbackDir)) {
        fs.mkdirSync(fallbackDir, { recursive: true });
      }
      
      // Сохраняем SVG
      fs.writeFileSync(fullSvgPath, svgContent);
      
      return fallbackSvgPath;
    }
  }
}

/**
 * Получает параметры для генерации пиксельного искусства на основе редкости
 */
function getPixelArtParamsByRarity(rarity: NFTRarity, seed: string): {
  colors: string[];
  complexity: number;
  pixelSize: number;
} {
  // Преобразуем seed в число для создания псевдослучайных значений
  const seedValue = parseInt(seed.substring(0, 8), 16);
  
  // Базовые настройки цветов для неонового пиксельного стиля
  const neonColors = {
    common: ['#ff00ff', '#00ffff', '#ffff00', '#ff0000', '#00ff00', '#0000ff'],
    uncommon: ['#ff42e8', '#42fff0', '#f0ff42', '#ff4242', '#42ff42', '#4242ff'],
    rare: ['#ff00a5', '#00ffa5', '#a5ff00', '#ff5500', '#00ff55', '#5500ff'],
    epic: ['#ff0055', '#00ff55', '#5500ff', '#ff5500', '#00a5ff', '#a500ff'],
    legendary: ['#ffaa00', '#00aaff', '#aa00ff', '#ff00aa', '#00ffaa', '#aaff00']
  };
  
  // Параметры сложности и размера пикселя
  const complexityParams = {
    common: { base: 3, max: 5 },
    uncommon: { base: 4, max: 7 },
    rare: { base: 5, max: 8 },
    epic: { base: 6, max: 10 },
    legendary: { base: 7, max: 12 }
  };
  
  const pixelSizeParams = {
    common: { min: 6, max: 10 },
    uncommon: { min: 5, max: 8 },
    rare: { min: 4, max: 7 },
    epic: { min: 3, max: 6 },
    legendary: { min: 2, max: 5 }
  };
  
  // Выбираем случайные цвета из палитры для редкости
  const baseColors = neonColors[rarity];
  
  // Добавляем вариацию на основе seed
  const randomVariation = (seedValue % 100) / 1000; // Небольшая вариация
  
  // Рассчитываем сложность на основе редкости
  const baseComplexity = complexityParams[rarity].base;
  const maxComplexityBonus = complexityParams[rarity].max - baseComplexity;
  const complexityBonus = (seedValue % maxComplexityBonus);
  const complexity = baseComplexity + complexityBonus;
  
  // Рассчитываем размер пикселя (меньше = больше деталей)
  const pixelSizeRange = pixelSizeParams[rarity];
  const pixelSize = pixelSizeRange.max - (seedValue % (pixelSizeRange.max - pixelSizeRange.min + 1));
  
  return {
    colors: baseColors,
    complexity,
    pixelSize
  };
}

/**
 * Создает пиксельное изображение в зависимости от категории и параметров
 */
async function createPixelArtImage(
  category: PixelArtCategory,
  colors: string[],
  complexity: number,
  pixelSize: number,
  seed: string
): Promise<Buffer> {
  // Размеры канваса
  const width = 512;
  const height = 512;
  
  // Создаем канвас
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  
  // Преобразуем seed в число для создания псевдослучайных значений
  const seedValue = parseInt(seed.substring(0, 8), 16);
  const random = createSeededRandom(seedValue);
  
  // Заполняем фон
  const backgroundColor = getRandomColor(colors, random);
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, width, height);
  
  // Генерируем фон с градиентными полосами в неоновом стиле
  drawNeonBackground(ctx, width, height, colors, random);
  
  // Генерируем пиксельное изображение в зависимости от категории
  switch (category) {
    case 'car':
      drawPixelCar(ctx, width, height, colors, pixelSize, complexity, random);
      break;
    case 'mansion':
      drawPixelMansion(ctx, width, height, colors, pixelSize, complexity, random);
      break;
    case 'character':
      drawPixelCharacter(ctx, width, height, colors, pixelSize, complexity, random);
      break;
    case 'cityscape':
      drawPixelCityscape(ctx, width, height, colors, pixelSize, complexity, random);
      break;
    case 'animal':
      drawPixelAnimal(ctx, width, height, colors, pixelSize, complexity, random);
      break;
  }
  
  // Добавляем эффект шума для более ретро-пиксельного вида
  addPixelNoise(ctx, width, height, pixelSize, 0.1, random);
  
  // Добавляем рамку с эффектом неона
  drawNeonBorder(ctx, width, height, colors, pixelSize, random);
  
  // Преобразуем канвас в буфер PNG
  return canvas.toBuffer('image/png');
}

/**
 * Создает генератор псевдослучайных чисел с фиксированным сидом
 */
function createSeededRandom(seed: number): () => number {
  let value = seed;
  return () => {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  };
}

/**
 * Возвращает случайный цвет из палитры
 */
function getRandomColor(colors: string[], random: () => number): string {
  return colors[Math.floor(random() * colors.length)];
}

/**
 * Рисует неоновый фон с градиентными полосами
 */
function drawNeonBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  colors: string[],
  random: () => number
): void {
  // Рисуем горизонтальные линии с градиентами
  const numStripes = Math.floor(random() * 10) + 5;
  const stripeHeight = height / numStripes;
  
  for (let i = 0; i < numStripes; i++) {
    const y = i * stripeHeight;
    const gradient = ctx.createLinearGradient(0, y, width, y);
    
    // Создаем градиент из случайных цветов
    gradient.addColorStop(0, getRandomColor(colors, random));
    gradient.addColorStop(0.5, getRandomColor(colors, random));
    gradient.addColorStop(1, getRandomColor(colors, random));
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, y, width, stripeHeight);
  }
}

/**
 * Добавляет пиксельный шум на изображение
 */
function addPixelNoise(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  pixelSize: number,
  intensity: number,
  random: () => number
): void {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  
  for (let x = 0; x < width; x += pixelSize) {
    for (let y = 0; y < height; y += pixelSize) {
      if (random() < intensity) {
        const noiseValue = random() < 0.5 ? 0 : 255;
        const noiseColor = [noiseValue, noiseValue, noiseValue, 50]; // Полупрозрачный шум
        
        // Заполняем пиксель шумом
        for (let px = 0; px < pixelSize; px++) {
          for (let py = 0; py < pixelSize; py++) {
            const idx = ((y + py) * width + (x + px)) * 4;
            if (idx < data.length - 3) {
              data[idx] = (data[idx] * 0.8 + noiseColor[0] * 0.2);
              data[idx + 1] = (data[idx + 1] * 0.8 + noiseColor[1] * 0.2);
              data[idx + 2] = (data[idx + 2] * 0.8 + noiseColor[2] * 0.2);
            }
          }
        }
      }
    }
  }
  
  ctx.putImageData(imageData, 0, 0);
}

/**
 * Рисует неоновую рамку вокруг изображения
 */
function drawNeonBorder(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  colors: string[],
  pixelSize: number,
  random: () => number
): void {
  const borderWidth = pixelSize * 3;
  const borderColor = getRandomColor(colors, random);
  
  // Создаем внешний контур с эффектом свечения
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = borderWidth;
  ctx.strokeRect(borderWidth / 2, borderWidth / 2, width - borderWidth, height - borderWidth);
  
  // Добавляем внутренний контур
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = pixelSize;
  ctx.strokeRect(borderWidth, borderWidth, width - borderWidth * 2, height - borderWidth * 2);
  
  // Добавляем пиксельные углы
  const cornerSize = pixelSize * 5;
  
  // Верхний левый угол
  drawPixelCorner(ctx, borderWidth, borderWidth, cornerSize, pixelSize, borderColor);
  
  // Верхний правый угол
  drawPixelCorner(ctx, width - borderWidth - cornerSize, borderWidth, cornerSize, pixelSize, borderColor);
  
  // Нижний левый угол
  drawPixelCorner(ctx, borderWidth, height - borderWidth - cornerSize, cornerSize, pixelSize, borderColor);
  
  // Нижний правый угол
  drawPixelCorner(ctx, width - borderWidth - cornerSize, height - borderWidth - cornerSize, cornerSize, pixelSize, borderColor);
}

/**
 * Рисует пиксельный угол рамки
 */
function drawPixelCorner(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  pixelSize: number,
  color: string
): void {
  ctx.fillStyle = color;
  
  // Рисуем пиксельный угол
  for (let px = 0; px < size; px += pixelSize) {
    for (let py = 0; py < size; py += pixelSize) {
      if (px + py < size) {
        ctx.fillRect(x + px, y + py, pixelSize, pixelSize);
      }
    }
  }
}

/**
 * Рисует пиксельную машину
 */
function drawPixelCar(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  colors: string[],
  pixelSize: number,
  complexity: number,
  random: () => number
): void {
  const carWidth = Math.floor(width * 0.7);
  const carHeight = Math.floor(height * 0.4);
  const carX = Math.floor((width - carWidth) / 2);
  const carY = Math.floor((height - carHeight) / 2);
  
  // Основной корпус
  const bodyColor = getRandomColor(colors, random);
  drawPixelRect(ctx, carX, carY, carWidth, carHeight, bodyColor, pixelSize);
  
  // Колеса
  const wheelSize = Math.floor(carHeight * 0.4);
  const wheelY = carY + carHeight - wheelSize;
  
  // Левое переднее колесо
  drawPixelCircle(ctx, carX + wheelSize, wheelY, wheelSize, '#000000', pixelSize);
  drawPixelCircle(ctx, carX + wheelSize, wheelY, wheelSize / 2, '#333333', pixelSize);
  
  // Правое переднее колесо
  drawPixelCircle(ctx, carX + carWidth - wheelSize, wheelY, wheelSize, '#000000', pixelSize);
  drawPixelCircle(ctx, carX + carWidth - wheelSize, wheelY, wheelSize / 2, '#333333', pixelSize);
  
  // Окна
  const windowColor = getRandomColor(colors, random);
  const windowHeight = Math.floor(carHeight * 0.4);
  const windowY = carY + Math.floor(carHeight * 0.1);
  
  // Лобовое стекло
  drawPixelRect(ctx, carX + Math.floor(carWidth * 0.1), windowY, Math.floor(carWidth * 0.3), windowHeight, windowColor, pixelSize);
  
  // Заднее стекло
  drawPixelRect(ctx, carX + Math.floor(carWidth * 0.6), windowY, Math.floor(carWidth * 0.3), windowHeight, windowColor, pixelSize);
  
  // Фары
  const headlightSize = Math.floor(carHeight * 0.15);
  const headlightY = carY + Math.floor(carHeight * 0.25);
  
  // Левая фара
  drawPixelRect(ctx, carX, headlightY, headlightSize, headlightSize, '#ffff00', pixelSize);
  
  // Правая фара
  drawPixelRect(ctx, carX + carWidth - headlightSize, headlightY, headlightSize, headlightSize, '#ffff00', pixelSize);
  
  // Дополнительные детали в зависимости от сложности
  if (complexity > 5) {
    // Спойлер
    drawPixelRect(ctx, 
      carX + Math.floor(carWidth * 0.6), 
      carY - Math.floor(carHeight * 0.2), 
      Math.floor(carWidth * 0.3), 
      Math.floor(carHeight * 0.1), 
      getRandomColor(colors, random), 
      pixelSize
    );
    
    // Полосы на капоте
    const stripeColor = getRandomColor(colors, random);
    const stripeY = carY + Math.floor(carHeight * 0.5);
    drawPixelRect(ctx, carX + Math.floor(carWidth * 0.1), stripeY, Math.floor(carWidth * 0.8), pixelSize * 2, stripeColor, pixelSize);
  }
  
  if (complexity > 7) {
    // Выхлопная труба
    drawPixelRect(ctx, 
      carX - Math.floor(pixelSize * 3), 
      carY + Math.floor(carHeight * 0.7), 
      Math.floor(pixelSize * 3), 
      Math.floor(pixelSize * 2), 
      '#777777', 
      pixelSize
    );
    
    // Антенна
    drawPixelLine(ctx,
      carX + Math.floor(carWidth * 0.8),
      carY,
      carX + Math.floor(carWidth * 0.8),
      carY - Math.floor(carHeight * 0.3),
      '#ffffff',
      pixelSize
    );
  }
}

/**
 * Рисует пиксельный особняк
 */
function drawPixelMansion(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  colors: string[],
  pixelSize: number,
  complexity: number,
  random: () => number
): void {
  const buildingWidth = Math.floor(width * 0.6);
  const buildingHeight = Math.floor(height * 0.6);
  const buildingX = Math.floor((width - buildingWidth) / 2);
  const buildingY = Math.floor(height - buildingHeight - height * 0.1);
  
  // Основное здание
  const buildingColor = getRandomColor(colors, random);
  drawPixelRect(ctx, buildingX, buildingY, buildingWidth, buildingHeight, buildingColor, pixelSize);
  
  // Крыша
  const roofColor = getRandomColor(colors, random);
  const roofHeight = Math.floor(buildingHeight * 0.3);
  
  // Треугольная крыша
  drawPixelTriangle(
    ctx,
    buildingX - Math.floor(buildingWidth * 0.1),
    buildingY,
    buildingWidth + Math.floor(buildingWidth * 0.2),
    roofHeight,
    roofColor,
    pixelSize
  );
  
  // Окна
  const windowSize = Math.floor(buildingWidth * 0.15);
  const windowColor = getRandomColor(colors, random);
  
  // Массив окон (разное количество в зависимости от сложности)
  const numWindows = Math.min(3, Math.max(2, Math.floor(complexity / 3)));
  const windowSpacing = Math.floor(buildingWidth / (numWindows + 1));
  
  for (let i = 1; i <= numWindows; i++) {
    // Верхние окна
    drawPixelRect(
      ctx,
      buildingX + i * windowSpacing - Math.floor(windowSize / 2),
      buildingY + Math.floor(buildingHeight * 0.2),
      windowSize,
      windowSize,
      windowColor,
      pixelSize
    );
    
    // Нижние окна
    drawPixelRect(
      ctx,
      buildingX + i * windowSpacing - Math.floor(windowSize / 2),
      buildingY + Math.floor(buildingHeight * 0.6),
      windowSize,
      windowSize,
      windowColor,
      pixelSize
    );
  }
  
  // Дверь
  const doorWidth = Math.floor(buildingWidth * 0.2);
  const doorHeight = Math.floor(buildingHeight * 0.3);
  const doorX = buildingX + Math.floor((buildingWidth - doorWidth) / 2);
  const doorY = buildingY + buildingHeight - doorHeight;
  
  drawPixelRect(ctx, doorX, doorY, doorWidth, doorHeight, getRandomColor(colors, random), pixelSize);
  
  // Добавляем дополнительные детали в зависимости от сложности
  if (complexity > 5) {
    // Дорожка к дому
    const pathWidth = Math.floor(doorWidth * 1.5);
    const pathHeight = Math.floor(height * 0.1);
    const pathX = doorX + Math.floor((doorWidth - pathWidth) / 2);
    const pathY = buildingY + buildingHeight;
    
    drawPixelRect(ctx, pathX, pathY, pathWidth, pathHeight, '#777777', pixelSize);
  }
  
  if (complexity > 7) {
    // Деревья или кусты
    const bushSize = Math.floor(buildingWidth * 0.15);
    const bushY = buildingY + buildingHeight - Math.floor(bushSize / 2);
    
    // Левый куст
    drawPixelCircle(
      ctx,
      buildingX - Math.floor(bushSize * 1.2),
      bushY,
      bushSize,
      '#00aa00',
      pixelSize
    );
    
    // Правый куст
    drawPixelCircle(
      ctx,
      buildingX + buildingWidth + Math.floor(bushSize * 1.2),
      bushY,
      bushSize,
      '#00aa00',
      pixelSize
    );
    
    // Дымовая труба
    const chimneyWidth = Math.floor(buildingWidth * 0.1);
    const chimneyHeight = Math.floor(buildingHeight * 0.2);
    const chimneyX = buildingX + Math.floor(buildingWidth * 0.7);
    const chimneyY = buildingY - chimneyHeight;
    
    drawPixelRect(ctx, chimneyX, chimneyY, chimneyWidth, chimneyHeight, buildingColor, pixelSize);
  }
}

/**
 * Рисует пиксельного персонажа
 */
function drawPixelCharacter(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  colors: string[],
  pixelSize: number,
  complexity: number,
  random: () => number
): void {
  const charWidth = Math.floor(width * 0.4);
  const charHeight = Math.floor(height * 0.7);
  const charX = Math.floor((width - charWidth) / 2);
  const charY = Math.floor((height - charHeight) / 2);
  
  // Голова
  const headSize = Math.floor(charWidth * 0.8);
  const headX = charX + Math.floor((charWidth - headSize) / 2);
  const headY = charY;
  const skinColor = getRandomColor(colors, random);
  
  drawPixelCircle(ctx, headX + Math.floor(headSize / 2), headY + Math.floor(headSize / 2), Math.floor(headSize / 2), skinColor, pixelSize);
  
  // Тело
  const bodyWidth = Math.floor(charWidth * 0.6);
  const bodyHeight = Math.floor(charHeight * 0.4);
  const bodyX = charX + Math.floor((charWidth - bodyWidth) / 2);
  const bodyY = headY + headSize;
  const clothesColor = getRandomColor(colors, random);
  
  drawPixelRect(ctx, bodyX, bodyY, bodyWidth, bodyHeight, clothesColor, pixelSize);
  
  // Руки
  const armWidth = Math.floor(charWidth * 0.15);
  const armHeight = Math.floor(bodyHeight * 0.8);
  
  // Левая рука
  drawPixelRect(ctx, bodyX - armWidth, bodyY, armWidth, armHeight, skinColor, pixelSize);
  
  // Правая рука
  drawPixelRect(ctx, bodyX + bodyWidth, bodyY, armWidth, armHeight, skinColor, pixelSize);
  
  // Ноги
  const legWidth = Math.floor(bodyWidth * 0.3);
  const legHeight = Math.floor(charHeight * 0.3);
  const legY = bodyY + bodyHeight;
  
  // Левая нога
  drawPixelRect(ctx, 
    bodyX + Math.floor(bodyWidth * 0.2) - Math.floor(legWidth / 2), 
    legY, 
    legWidth, 
    legHeight, 
    getRandomColor(colors, random), 
    pixelSize
  );
  
  // Правая нога
  drawPixelRect(ctx, 
    bodyX + Math.floor(bodyWidth * 0.8) - Math.floor(legWidth / 2), 
    legY, 
    legWidth, 
    legHeight, 
    getRandomColor(colors, random), 
    pixelSize
  );
  
  // Глаза
  const eyeSize = Math.floor(headSize * 0.15);
  const eyeY = headY + Math.floor(headSize * 0.3);
  
  // Левый глаз
  drawPixelCircle(
    ctx,
    headX + Math.floor(headSize * 0.3),
    eyeY,
    eyeSize,
    '#ffffff',
    pixelSize
  );
  
  // Правый глаз
  drawPixelCircle(
    ctx,
    headX + Math.floor(headSize * 0.7),
    eyeY,
    eyeSize,
    '#ffffff',
    pixelSize
  );
  
  // Зрачки
  const pupilSize = Math.floor(eyeSize * 0.5);
  
  // Левый зрачок
  drawPixelCircle(
    ctx,
    headX + Math.floor(headSize * 0.3),
    eyeY,
    pupilSize,
    '#000000',
    pixelSize
  );
  
  // Правый зрачок
  drawPixelCircle(
    ctx,
    headX + Math.floor(headSize * 0.7),
    eyeY,
    pupilSize,
    '#000000',
    pixelSize
  );
  
  // Рот
  const mouthWidth = Math.floor(headSize * 0.5);
  const mouthHeight = Math.floor(headSize * 0.1);
  const mouthX = headX + Math.floor((headSize - mouthWidth) / 2);
  const mouthY = headY + Math.floor(headSize * 0.6);
  
  drawPixelRect(ctx, mouthX, mouthY, mouthWidth, mouthHeight, '#ff0000', pixelSize);
  
  // Дополнительные детали в зависимости от сложности
  if (complexity > 5) {
    // Волосы
    const hairColor = getRandomColor(colors, random);
    
    for (let i = 0; i < 5; i++) {
      const hairX = headX + Math.floor(headSize * 0.2) + i * Math.floor(headSize * 0.15);
      const hairY = headY - Math.floor(headSize * 0.1);
      const hairHeight = Math.floor(headSize * (0.1 + random() * 0.2));
      
      drawPixelRect(ctx, hairX, hairY - hairHeight, pixelSize * 2, hairHeight, hairColor, pixelSize);
    }
  }
  
  if (complexity > 7) {
    // Аксессуары (шляпа или очки)
    if (random() > 0.5) {
      // Шляпа
      const hatWidth = Math.floor(headSize * 1.2);
      const hatHeight = Math.floor(headSize * 0.3);
      const hatX = headX + Math.floor((headSize - hatWidth) / 2);
      const hatY = headY - Math.floor(hatHeight);
      
      drawPixelRect(ctx, hatX, hatY, hatWidth, hatHeight, getRandomColor(colors, random), pixelSize);
      
      // Верхняя часть шляпы
      drawPixelRect(ctx, 
        hatX + Math.floor(hatWidth * 0.1),
        hatY - Math.floor(hatHeight * 0.8),
        Math.floor(hatWidth * 0.8),
        Math.floor(hatHeight * 0.8),
        getRandomColor(colors, random),
        pixelSize
      );
    } else {
      // Очки
      const glassesWidth = Math.floor(eyeSize * 2);
      const glassesColor = getRandomColor(colors, random);
      
      // Левая линза
      drawPixelCircle(
        ctx,
        headX + Math.floor(headSize * 0.3),
        eyeY,
        eyeSize + pixelSize,
        glassesColor,
        pixelSize
      );
      
      // Правая линза
      drawPixelCircle(
        ctx,
        headX + Math.floor(headSize * 0.7),
        eyeY,
        eyeSize + pixelSize,
        glassesColor,
        pixelSize
      );
      
      // Перемычка
      drawPixelLine(
        ctx,
        headX + Math.floor(headSize * 0.3) + eyeSize,
        eyeY,
        headX + Math.floor(headSize * 0.7) - eyeSize,
        eyeY,
        glassesColor,
        pixelSize
      );
    }
  }
}

/**
 * Рисует пиксельный городской пейзаж
 */
function drawPixelCityscape(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  colors: string[],
  pixelSize: number,
  complexity: number,
  random: () => number
): void {
  // Фон неба (градиент)
  const skyGradient = ctx.createLinearGradient(0, 0, 0, height * 0.7);
  skyGradient.addColorStop(0, getRandomColor(colors, random));
  skyGradient.addColorStop(1, getRandomColor(colors, random));
  
  ctx.fillStyle = skyGradient;
  ctx.fillRect(0, 0, width, height * 0.7);
  
  // Горизонт
  const groundHeight = height * 0.3;
  const groundY = height - groundHeight;
  const groundColor = getRandomColor(colors, random);
  
  ctx.fillStyle = groundColor;
  ctx.fillRect(0, groundY, width, groundHeight);
  
  // Количество зданий зависит от сложности
  const numBuildings = 5 + Math.floor(complexity * 0.7);
  const buildingWidth = width / numBuildings;
  
  // Рисуем здания
  for (let i = 0; i < numBuildings; i++) {
    const buildingX = i * buildingWidth;
    const buildingHeight = Math.floor(height * 0.2 + random() * height * 0.4);
    const buildingY = groundY - buildingHeight;
    const buildingColor = getRandomColor(colors, random);
    
    // Основное здание
    drawPixelRect(ctx, buildingX, buildingY, buildingWidth, buildingHeight, buildingColor, pixelSize);
    
    // Окна
    const windowSize = Math.floor(buildingWidth * 0.15);
    const windowColor = getRandomColor(colors, random);
    
    // Количество этажей и окон на этаж
    const numFloors = Math.floor(buildingHeight / (windowSize * 2));
    const numWindowsPerFloor = Math.floor(buildingWidth / (windowSize * 2));
    
    // Рисуем окна на каждом этаже
    for (let floor = 0; floor < numFloors; floor++) {
      for (let win = 0; win < numWindowsPerFloor; win++) {
        // Случайно решаем, будет ли окно гореть
        const windowLit = random() > 0.4;
        
        drawPixelRect(
          ctx,
          buildingX + win * windowSize * 2 + windowSize / 2,
          buildingY + floor * windowSize * 2 + windowSize / 2,
          windowSize,
          windowSize,
          windowLit ? windowColor : '#333333',
          pixelSize
        );
      }
    }
  }
  
  // Добавляем детали в зависимости от сложности
  if (complexity > 5) {
    // Луна или солнце
    const celestialSize = Math.floor(width * 0.1);
    const celestialX = Math.floor(width * 0.8);
    const celestialY = Math.floor(height * 0.2);
    const celestialColor = random() > 0.5 ? '#ffff00' : '#ffffff';
    
    drawPixelCircle(ctx, celestialX, celestialY, celestialSize, celestialColor, pixelSize);
    
    // Если это луна, добавляем кратеры
    if (celestialColor === '#ffffff') {
      const numCraters = 3 + Math.floor(random() * 3);
      
      for (let i = 0; i < numCraters; i++) {
        const craterSize = Math.floor(celestialSize * 0.2);
        const craterX = celestialX + Math.floor((random() - 0.5) * celestialSize);
        const craterY = celestialY + Math.floor((random() - 0.5) * celestialSize);
        
        drawPixelCircle(ctx, craterX, craterY, craterSize, '#cccccc', pixelSize);
      }
    }
  }
  
  if (complexity > 7) {
    // Дорога
    const roadWidth = width;
    const roadHeight = Math.floor(groundHeight * 0.5);
    const roadY = groundY;
    
    drawPixelRect(ctx, 0, roadY, roadWidth, roadHeight, '#333333', pixelSize);
    
    // Разметка на дороге
    const lineWidth = Math.floor(width * 0.05);
    const lineHeight = pixelSize * 2;
    const numLines = Math.floor(width / (lineWidth * 2));
    
    for (let i = 0; i < numLines; i++) {
      drawPixelRect(
        ctx,
        i * lineWidth * 2,
        roadY + Math.floor(roadHeight / 2) - Math.floor(lineHeight / 2),
        lineWidth,
        lineHeight,
        '#ffffff',
        pixelSize
      );
    }
    
    // Автомобили на дороге
    const numCars = 1 + Math.floor(random() * 3);
    
    for (let i = 0; i < numCars; i++) {
      const carWidth = Math.floor(width * 0.1);
      const carHeight = Math.floor(roadHeight * 0.5);
      const carX = Math.floor(random() * (width - carWidth));
      const carY = roadY + Math.floor((roadHeight - carHeight) / 2);
      
      drawPixelRect(ctx, carX, carY, carWidth, carHeight, getRandomColor(colors, random), pixelSize);
      
      // Фары
      const headlightSize = Math.floor(carHeight * 0.3);
      const headlightY = carY + Math.floor((carHeight - headlightSize) / 2);
      
      // Передние фары
      drawPixelRect(ctx, carX, headlightY, headlightSize, headlightSize, '#ffff00', pixelSize);
      
      // Задние фары
      drawPixelRect(ctx, carX + carWidth - headlightSize, headlightY, headlightSize, headlightSize, '#ff0000', pixelSize);
    }
  }
}

/**
 * Рисует пиксельное животное
 */
function drawPixelAnimal(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  colors: string[],
  pixelSize: number,
  complexity: number,
  random: () => number
): void {
  // Выбираем тип животного (кошка или собака)
  const animalType = random() > 0.5 ? 'cat' : 'dog';
  const animalWidth = Math.floor(width * 0.6);
  const animalHeight = Math.floor(height * 0.5);
  const animalX = Math.floor((width - animalWidth) / 2);
  const animalY = Math.floor((height - animalHeight) / 2);
  
  // Цвет животного
  const animalColor = getRandomColor(colors, random);
  
  if (animalType === 'cat') {
    // Рисуем кошку
    
    // Тело
    const bodyWidth = Math.floor(animalWidth * 0.7);
    const bodyHeight = Math.floor(animalHeight * 0.5);
    const bodyX = animalX + Math.floor((animalWidth - bodyWidth) / 2);
    const bodyY = animalY + Math.floor(animalHeight * 0.3);
    
    drawPixelRect(ctx, bodyX, bodyY, bodyWidth, bodyHeight, animalColor, pixelSize);
    
    // Голова
    const headSize = Math.floor(animalWidth * 0.4);
    const headX = bodyX + Math.floor((bodyWidth - headSize) / 2);
    const headY = bodyY - Math.floor(headSize * 0.8);
    
    drawPixelCircle(ctx, headX + Math.floor(headSize / 2), headY + Math.floor(headSize / 2), Math.floor(headSize / 2), animalColor, pixelSize);
    
    // Уши
    const earSize = Math.floor(headSize * 0.4);
    
    // Левое ухо (треугольник)
    drawPixelTriangle(
      ctx,
      headX,
      headY,
      earSize,
      earSize,
      animalColor,
      pixelSize
    );
    
    // Правое ухо (треугольник)
    drawPixelTriangle(
      ctx,
      headX + headSize - earSize,
      headY,
      earSize,
      earSize,
      animalColor,
      pixelSize
    );
    
    // Глаза
    const eyeSize = Math.floor(headSize * 0.15);
    const eyeY = headY + Math.floor(headSize * 0.3);
    
    // Левый глаз
    drawPixelCircle(
      ctx,
      headX + Math.floor(headSize * 0.3),
      eyeY,
      eyeSize,
      '#ffffff',
      pixelSize
    );
    
    // Правый глаз
    drawPixelCircle(
      ctx,
      headX + Math.floor(headSize * 0.7),
      eyeY,
      eyeSize,
      '#ffffff',
      pixelSize
    );
    
    // Зрачки
    const pupilSize = Math.floor(eyeSize * 0.6);
    
    // Вертикальные зрачки для кошки
    drawPixelRect(
      ctx,
      headX + Math.floor(headSize * 0.3) - Math.floor(pupilSize / 2),
      eyeY - Math.floor(eyeSize * 0.7),
      pixelSize,
      eyeSize * 1.4,
      '#000000',
      pixelSize
    );
    
    drawPixelRect(
      ctx,
      headX + Math.floor(headSize * 0.7) - Math.floor(pupilSize / 2),
      eyeY - Math.floor(eyeSize * 0.7),
      pixelSize,
      eyeSize * 1.4,
      '#000000',
      pixelSize
    );
    
    // Нос
    const noseSize = Math.floor(headSize * 0.1);
    const noseX = headX + Math.floor(headSize / 2) - Math.floor(noseSize / 2);
    const noseY = headY + Math.floor(headSize * 0.5);
    
    drawPixelRect(ctx, noseX, noseY, noseSize, noseSize, '#ff9999', pixelSize);
    
    // Хвост
    const tailWidth = Math.floor(bodyWidth * 0.1);
    const tailHeight = Math.floor(bodyHeight * 1.2);
    const tailX = bodyX + bodyWidth;
    const tailY = bodyY;
    
    // Изогнутый хвост (аппроксимированный)
    drawPixelRect(ctx, tailX, tailY, tailWidth, Math.floor(tailHeight * 0.3), animalColor, pixelSize);
    drawPixelRect(ctx, tailX, tailY - Math.floor(tailHeight * 0.3), tailWidth * 3, Math.floor(tailHeight * 0.3), animalColor, pixelSize);
    drawPixelRect(ctx, tailX + tailWidth * 3, tailY - Math.floor(tailHeight * 0.6), tailWidth, Math.floor(tailHeight * 0.3), animalColor, pixelSize);
    
    // Лапы
    const pawWidth = Math.floor(bodyWidth * 0.15);
    const pawHeight = Math.floor(bodyHeight * 0.3);
    const frontPawY = bodyY + bodyHeight - pawHeight;
    const backPawY = bodyY + bodyHeight - pawHeight;
    
    // Передние лапы
    drawPixelRect(ctx, bodyX, frontPawY, pawWidth, pawHeight, animalColor, pixelSize);
    drawPixelRect(ctx, bodyX + Math.floor(bodyWidth * 0.3), frontPawY, pawWidth, pawHeight, animalColor, pixelSize);
    
    // Задние лапы
    drawPixelRect(ctx, bodyX + Math.floor(bodyWidth * 0.6), backPawY, pawWidth, pawHeight, animalColor, pixelSize);
    drawPixelRect(ctx, bodyX + bodyWidth - pawWidth, backPawY, pawWidth, pawHeight, animalColor, pixelSize);
  } else {
    // Рисуем собаку
    
    // Тело
    const bodyWidth = Math.floor(animalWidth * 0.7);
    const bodyHeight = Math.floor(animalHeight * 0.5);
    const bodyX = animalX + Math.floor((animalWidth - bodyWidth) / 2);
    const bodyY = animalY + Math.floor(animalHeight * 0.3);
    
    drawPixelRect(ctx, bodyX, bodyY, bodyWidth, bodyHeight, animalColor, pixelSize);
    
    // Голова
    const headSize = Math.floor(animalWidth * 0.4);
    const headX = bodyX - Math.floor(headSize * 0.3);
    const headY = bodyY - Math.floor(headSize * 0.5);
    
    drawPixelCircle(ctx, headX + Math.floor(headSize / 2), headY + Math.floor(headSize / 2), Math.floor(headSize / 2), animalColor, pixelSize);
    
    // Мордочка (удлиненная)
    const snoutWidth = Math.floor(headSize * 0.5);
    const snoutHeight = Math.floor(headSize * 0.3);
    const snoutX = headX - Math.floor(snoutWidth * 0.8);
    const snoutY = headY + Math.floor(headSize * 0.4);
    
    drawPixelRect(ctx, snoutX, snoutY, snoutWidth, snoutHeight, animalColor, pixelSize);
    
    // Уши
    const earWidth = Math.floor(headSize * 0.3);
    const earHeight = Math.floor(headSize * 0.5);
    
    // Левое ухо
    drawPixelRect(
      ctx,
      headX,
      headY - Math.floor(earHeight * 0.8),
      earWidth,
      earHeight,
      animalColor,
      pixelSize
    );
    
    // Правое ухо
    drawPixelRect(
      ctx,
      headX + headSize - earWidth,
      headY - Math.floor(earHeight * 0.8),
      earWidth,
      earHeight,
      animalColor,
      pixelSize
    );
    
    // Глаза
    const eyeSize = Math.floor(headSize * 0.15);
    const eyeY = headY + Math.floor(headSize * 0.3);
    
    // Левый глаз
    drawPixelCircle(
      ctx,
      headX + Math.floor(headSize * 0.3),
      eyeY,
      eyeSize,
      '#ffffff',
      pixelSize
    );
    
    // Правый глаз
    drawPixelCircle(
      ctx,
      headX + Math.floor(headSize * 0.7),
      eyeY,
      eyeSize,
      '#ffffff',
      pixelSize
    );
    
    // Зрачки
    const pupilSize = Math.floor(eyeSize * 0.6);
    
    // Левый зрачок
    drawPixelCircle(
      ctx,
      headX + Math.floor(headSize * 0.3),
      eyeY,
      pupilSize,
      '#000000',
      pixelSize
    );
    
    // Правый зрачок
    drawPixelCircle(
      ctx,
      headX + Math.floor(headSize * 0.7),
      eyeY,
      pupilSize,
      '#000000',
      pixelSize
    );
    
    // Нос
    const noseSize = Math.floor(headSize * 0.15);
    const noseX = snoutX;
    const noseY = snoutY;
    
    drawPixelCircle(ctx, noseX, noseY + Math.floor(snoutHeight / 2), noseSize, '#000000', pixelSize);
    
    // Хвост
    const tailWidth = Math.floor(bodyWidth * 0.15);
    const tailHeight = Math.floor(bodyHeight * 0.8);
    const tailX = bodyX + bodyWidth;
    const tailY = bodyY;
    
    // Изогнутый хвост (аппроксимированный)
    drawPixelLine(
      ctx,
      tailX,
      tailY + Math.floor(bodyHeight * 0.2),
      tailX + Math.floor(tailWidth * 2),
      tailY - Math.floor(tailHeight * 0.5),
      animalColor,
      pixelSize * 2
    );
    
    // Лапы
    const pawWidth = Math.floor(bodyWidth * 0.15);
    const pawHeight = Math.floor(bodyHeight * 0.4);
    const frontPawY = bodyY + bodyHeight - pawHeight;
    const backPawY = bodyY + bodyHeight - pawHeight;
    
    // Передние лапы
    drawPixelRect(ctx, bodyX, frontPawY, pawWidth, pawHeight, animalColor, pixelSize);
    drawPixelRect(ctx, bodyX + Math.floor(bodyWidth * 0.3), frontPawY, pawWidth, pawHeight, animalColor, pixelSize);
    
    // Задние лапы
    drawPixelRect(ctx, bodyX + Math.floor(bodyWidth * 0.6), backPawY, pawWidth, pawHeight, animalColor, pixelSize);
    drawPixelRect(ctx, bodyX + bodyWidth - pawWidth, backPawY, pawWidth, pawHeight, animalColor, pixelSize);
  }
  
  // Добавляем дополнительные детали в зависимости от сложности
  if (complexity > 5) {
    // Пятна или полоски
    const numSpots = 3 + Math.floor(random() * 5);
    const spotColor = getRandomColor(colors, random);
    
    for (let i = 0; i < numSpots; i++) {
      const spotSize = Math.floor(animalWidth * 0.1);
      const spotX = animalX + Math.floor(random() * animalWidth);
      const spotY = animalY + Math.floor(random() * animalHeight);
      
      drawPixelCircle(ctx, spotX, spotY, spotSize, spotColor, pixelSize);
    }
  }
  
  if (complexity > 7) {
    // Ошейник или аксессуар
    if (animalType === 'dog') {
      // Ошейник для собаки
      const collarHeight = pixelSize * 2;
      const collarY = headY + Math.floor(headSize * 0.7);
      
      drawPixelRect(
        ctx,
        headX,
        collarY,
        headSize,
        collarHeight,
        getRandomColor(colors, random),
        pixelSize
      );
      
      // Медальон
      const medalSize = Math.floor(collarHeight * 1.5);
      const medalX = headX + Math.floor(headSize / 2) - Math.floor(medalSize / 2);
      const medalY = collarY + collarHeight;
      
      drawPixelCircle(ctx, medalX + Math.floor(medalSize / 2), medalY + Math.floor(medalSize / 2), Math.floor(medalSize / 2), '#ffff00', pixelSize);
    } else {
      // Бантик для кошки
      const bowWidth = Math.floor(headSize * 0.5);
      const bowHeight = Math.floor(headSize * 0.2);
      const bowX = headX + Math.floor((headSize - bowWidth) / 2);
      const bowY = headY + Math.floor(headSize * 0.7);
      
      drawPixelRect(ctx, bowX, bowY, bowWidth, bowHeight, getRandomColor(colors, random), pixelSize);
      
      // Средняя часть бантика
      drawPixelRect(
        ctx,
        bowX + Math.floor(bowWidth / 2) - pixelSize,
        bowY - pixelSize,
        pixelSize * 2,
        bowHeight + pixelSize * 2,
        getRandomColor(colors, random),
        pixelSize
      );
    }
  }
}

/**
 * Рисует пиксельный прямоугольник
 */
function drawPixelRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
  pixelSize: number
): void {
  ctx.fillStyle = color;
  
  for (let px = 0; px < width; px += pixelSize) {
    for (let py = 0; py < height; py += pixelSize) {
      ctx.fillRect(
        Math.floor(x + px),
        Math.floor(y + py),
        pixelSize,
        pixelSize
      );
    }
  }
}

/**
 * Рисует пиксельный круг
 */
function drawPixelCircle(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
  color: string,
  pixelSize: number
): void {
  ctx.fillStyle = color;
  
  for (let px = -radius; px <= radius; px += pixelSize) {
    for (let py = -radius; py <= radius; py += pixelSize) {
      const distance = Math.sqrt(px * px + py * py);
      
      if (distance <= radius) {
        ctx.fillRect(
          Math.floor(centerX + px),
          Math.floor(centerY + py),
          pixelSize,
          pixelSize
        );
      }
    }
  }
}

/**
 * Рисует пиксельную линию
 */
function drawPixelLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  pixelSize: number
): void {
  ctx.fillStyle = color;
  
  // Реализация алгоритма Брезенхэма для пиксельной линии
  const dx = Math.abs(x2 - x1);
  const dy = Math.abs(y2 - y1);
  const sx = x1 < x2 ? pixelSize : -pixelSize;
  const sy = y1 < y2 ? pixelSize : -pixelSize;
  let err = dx - dy;
  
  let currentX = x1;
  let currentY = y1;
  
  while (true) {
    ctx.fillRect(
      Math.floor(currentX),
      Math.floor(currentY),
      pixelSize,
      pixelSize
    );
    
    if (Math.abs(currentX - x2) < pixelSize && Math.abs(currentY - y2) < pixelSize) {
      break;
    }
    
    const e2 = 2 * err;
    
    if (e2 > -dy) {
      err -= dy;
      currentX += sx;
    }
    
    if (e2 < dx) {
      err += dx;
      currentY += sy;
    }
  }
}

/**
 * Рисует пиксельный треугольник
 */
function drawPixelTriangle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
  pixelSize: number
): void {
  ctx.fillStyle = color;
  
  // Вершины треугольника
  const x1 = x;
  const y1 = y + height;
  const x2 = x + width / 2;
  const y2 = y;
  const x3 = x + width;
  const y3 = y + height;
  
  // Определяем область треугольника
  for (let px = x; px < x + width; px += pixelSize) {
    for (let py = y; py < y + height; py += pixelSize) {
      // Проверяем, находится ли точка (px, py) внутри треугольника
      // Используем метод барицентрических координат
      const denominator = (y2 - y3) * (x1 - x3) + (x3 - x2) * (y1 - y3);
      
      // Вычисляем барицентрические координаты точки
      const a = ((y2 - y3) * (px - x3) + (x3 - x2) * (py - y3)) / denominator;
      const b = ((y3 - y1) * (px - x3) + (x1 - x3) * (py - y3)) / denominator;
      const c = 1 - a - b;
      
      // Если все координаты положительные, точка внутри треугольника
      if (a >= 0 && b >= 0 && c >= 0) {
        ctx.fillRect(
          Math.floor(px),
          Math.floor(py),
          pixelSize,
          pixelSize
        );
      }
    }
  }
}

/**
 * Создает запасной SVG для случаев ошибок
 */
function createFallbackSVG(rarity: NFTRarity): string {
  // Определяем цвет в зависимости от редкости
  const colors: Record<NFTRarity, string> = {
    common: '#aaaaaa',
    uncommon: '#55cc55',
    rare: '#5555cc',
    epic: '#cc55cc',
    legendary: '#cccc55'
  };
  
  const color = colors[rarity];
  
  // Создаем простой SVG с текстом о редкости
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
    <rect width="512" height="512" fill="#222222" />
    <rect x="20" y="20" width="472" height="472" fill="#333333" stroke="${color}" stroke-width="4" />
    <text x="256" y="200" font-family="Arial" font-size="32" text-anchor="middle" fill="${color}">Pixel NFT</text>
    <text x="256" y="250" font-family="Arial" font-size="48" text-anchor="middle" fill="${color}">${rarity.toUpperCase()}</text>
    <text x="256" y="300" font-family="Arial" font-size="20" text-anchor="middle" fill="#ffffff">BNALBANK</text>
  </svg>`;
}
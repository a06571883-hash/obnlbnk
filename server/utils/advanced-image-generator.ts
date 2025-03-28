/**
 * Улучшенный генератор изображений, создающий миллионы уникальных вариаций
 * Использует комбинацию фильтров, наложений и эффектов для создания неповторимых NFT
 */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { createCanvas, loadImage, Canvas } from '@napi-rs/canvas';

// Типы редкости NFT
type NFTRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

// Типы эффектов
type EffectType = 'overlay' | 'filter' | 'transform' | 'glow' | 'colorize';

/**
 * Генерирует уникальное изображение, комбинируя несколько базовых изображений
 * и применяя к ним различные эффекты
 * 
 * @param rarity Редкость NFT
 * @returns Путь к сгенерированному изображению
 */
export async function generateUniqueImage(rarity: NFTRarity): Promise<string> {
  console.log(`[Advanced Generator] Создание уникального изображения для редкости: ${rarity}`);
  
  try {
    // Получаем базовое изображение в зависимости от редкости
    const basePath = getRandomBasePath(rarity);
    
    // Загружаем базовое изображение
    const baseImagePath = path.join(process.cwd(), 'public', basePath);
    
    if (!fs.existsSync(baseImagePath)) {
      throw new Error(`Базовое изображение не найдено по пути: ${baseImagePath}`);
    }
    
    console.log(`[Advanced Generator] Загружено базовое изображение: ${basePath}`);
    
    // Загружаем изображение для обработки
    const image = await loadImage(baseImagePath);
    
    // Создаем канвас для изображения
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');
    
    // Рисуем базовое изображение
    ctx.drawImage(image, 0, 0);
    
    // Применяем случайные эффекты в зависимости от редкости
    const effectsCount = 2 + getRarityLevel(rarity);
    await applyRandomEffects(canvas, ctx, rarity, effectsCount);
    
    // Добавляем уникальный водяной знак
    addUniqueWatermark(canvas, ctx, rarity);
    
    // Сохраняем модифицированное изображение
    const outputPath = await saveGeneratedImage(canvas, rarity);
    
    console.log(`[Advanced Generator] Изображение успешно сохранено: ${outputPath}`);
    
    return outputPath;
  } catch (error) {
    console.error('[Advanced Generator] Ошибка при генерации изображения:', error);
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
 * Применяет случайные эффекты к изображению
 */
async function applyRandomEffects(canvas: Canvas, ctx: CanvasRenderingContext2D, rarity: NFTRarity, count: number): Promise<void> {
  // Доступные эффекты
  const effects: EffectType[] = ['overlay', 'filter', 'transform', 'glow', 'colorize'];
  
  // Применяем указанное количество случайных эффектов
  for (let i = 0; i < count; i++) {
    // Генерируем больше вариаций для более редких типов
    const randomSeed = crypto.randomBytes(4).readUInt32LE(0);
    const effectIndex = randomSeed % effects.length;
    const effectType = effects[effectIndex];
    
    console.log(`[Advanced Generator] Применение эффекта: ${effectType}`);
    
    switch (effectType) {
      case 'overlay':
        await applyOverlayEffect(canvas, ctx, rarity, randomSeed);
        break;
      case 'filter':
        applyFilterEffect(canvas, ctx, rarity, randomSeed);
        break;
      case 'transform':
        applyTransformEffect(canvas, ctx, rarity, randomSeed);
        break;
      case 'glow':
        applyGlowEffect(canvas, ctx, rarity, randomSeed);
        break;
      case 'colorize':
        applyColorizeEffect(canvas, ctx, rarity, randomSeed);
        break;
    }
  }
}

/**
 * Добавляет полупрозрачное наложение с эффектом на изображение
 */
async function applyOverlayEffect(canvas: Canvas, ctx: CanvasRenderingContext2D, rarity: NFTRarity, seed: number): Promise<void> {
  // Сохраняем текущий контекст рисования
  ctx.save();
  
  // Разные типы наложений в зависимости от редкости
  const overlayTypes = ['light', 'gradient', 'pattern', 'vignette', 'sparkle'];
  const overlayType = overlayTypes[seed % overlayTypes.length];
  
  // Устанавливаем прозрачность в зависимости от редкости
  const baseOpacity = 0.2 + (getRarityLevel(rarity) * 0.05);
  ctx.globalAlpha = Math.min(baseOpacity, 0.5); // Максимум 0.5, чтобы не сильно затемнять
  
  switch (overlayType) {
    case 'light':
      // Создаем световой эффект
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const radius = Math.max(canvas.width, canvas.height) * 0.7;
      
      const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      break;
      
    case 'gradient':
      // Наложение градиента
      const direction = seed % 4; // 0: сверху вниз, 1: снизу вверх, 2: слева направо, 3: справа налево
      let grd;
      
      // Выбираем цвета в зависимости от редкости
      const colorStart = getColorByRarity(rarity, true);
      const colorEnd = getColorByRarity(rarity, false);
      
      if (direction === 0) {
        grd = ctx.createLinearGradient(0, 0, 0, canvas.height);
      } else if (direction === 1) {
        grd = ctx.createLinearGradient(0, canvas.height, 0, 0);
      } else if (direction === 2) {
        grd = ctx.createLinearGradient(0, 0, canvas.width, 0);
      } else {
        grd = ctx.createLinearGradient(canvas.width, 0, 0, 0);
      }
      
      grd.addColorStop(0, colorStart);
      grd.addColorStop(1, colorEnd);
      
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      break;
      
    case 'pattern':
      // Создаем шаблон наложения
      const patternSize = 20 + (seed % 20);
      const patternCanvas = createCanvas(patternSize * 2, patternSize * 2);
      const patternCtx = patternCanvas.getContext('2d');
      
      patternCtx.fillStyle = getColorByRarity(rarity, true);
      patternCtx.fillRect(0, 0, patternSize, patternSize);
      patternCtx.fillRect(patternSize, patternSize, patternSize, patternSize);
      
      patternCtx.fillStyle = getColorByRarity(rarity, false);
      patternCtx.fillRect(patternSize, 0, patternSize, patternSize);
      patternCtx.fillRect(0, patternSize, patternSize, patternSize);
      
      const pattern = ctx.createPattern(patternCanvas, 'repeat');
      if (pattern) {
        ctx.fillStyle = pattern;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      break;
      
    case 'vignette':
      // Добавляем эффект виньетки (затемнение по краям)
      const innerRadius = Math.min(canvas.width, canvas.height) * 0.5;
      const outerRadius = Math.max(canvas.width, canvas.height) * 0.9;
      
      const vignetteGradient = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, innerRadius,
        canvas.width / 2, canvas.height / 2, outerRadius
      );
      
      vignetteGradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
      vignetteGradient.addColorStop(1, 'rgba(0, 0, 0, 0.7)');
      
      ctx.fillStyle = vignetteGradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      break;
      
    case 'sparkle':
      // Добавляем блестящие точки (больше для более редких)
      const sparklesCount = 10 + (getRarityLevel(rarity) * 5);
      const maxSize = 3 + (getRarityLevel(rarity));
      
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      
      for (let i = 0; i < sparklesCount; i++) {
        const x = (seed + i * 17) % canvas.width;
        const y = (seed + i * 23) % canvas.height;
        const size = (seed + i) % maxSize + 1;
        
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
  }
  
  // Восстанавливаем контекст рисования
  ctx.restore();
}

/**
 * Применяет фильтры к изображению
 */
function applyFilterEffect(canvas: Canvas, ctx: CanvasRenderingContext2D, rarity: NFTRarity, seed: number): void {
  // Сохраняем текущий контекст рисования
  ctx.save();
  
  // Получаем данные изображения
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  
  // Выбираем фильтр в зависимости от seed
  const filterType = seed % 5; // 0: контраст, 1: насыщенность, 2: яркость, 3: сепия, 4: оттенок
  
  // Интенсивность фильтра в зависимости от редкости
  const intensity = 0.2 + (getRarityLevel(rarity) * 0.1);
  
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    
    switch (filterType) {
      case 0: // Контраст
        const factor = (259 * (intensity * 100 + 255)) / (255 * (259 - intensity * 100));
        data[i] = clamp(factor * (r - 128) + 128);
        data[i + 1] = clamp(factor * (g - 128) + 128);
        data[i + 2] = clamp(factor * (b - 128) + 128);
        break;
        
      case 1: // Насыщенность
        const avg = (r + g + b) / 3;
        data[i] = clamp(avg + (r - avg) * (1 + intensity));
        data[i + 1] = clamp(avg + (g - avg) * (1 + intensity));
        data[i + 2] = clamp(avg + (b - avg) * (1 + intensity));
        break;
        
      case 2: // Яркость
        data[i] = clamp(r * (1 + intensity));
        data[i + 1] = clamp(g * (1 + intensity));
        data[i + 2] = clamp(b * (1 + intensity));
        break;
        
      case 3: // Сепия
        const tr = 0.393 * r + 0.769 * g + 0.189 * b;
        const tg = 0.349 * r + 0.686 * g + 0.168 * b;
        const tb = 0.272 * r + 0.534 * g + 0.131 * b;
        data[i] = clamp(tr);
        data[i + 1] = clamp(tg);
        data[i + 2] = clamp(tb);
        break;
        
      case 4: // Оттенок (сдвиг цветов)
        const hueShift = seed % 360; // Сдвиг в градусах (0-359)
        const hsv = rgbToHsv(r, g, b);
        hsv.h = (hsv.h + hueShift) % 360;
        const rgb = hsvToRgb(hsv.h, hsv.s, hsv.v);
        data[i] = rgb.r;
        data[i + 1] = rgb.g;
        data[i + 2] = rgb.b;
        break;
    }
  }
  
  // Применяем измененные данные изображения
  ctx.putImageData(imageData, 0, 0);
  
  // Восстанавливаем контекст рисования
  ctx.restore();
}

/**
 * Применяет эффекты трансформации
 */
function applyTransformEffect(canvas: Canvas, ctx: CanvasRenderingContext2D, rarity: NFTRarity, seed: number): void {
  // Сохраняем текущий контекст рисования и изображение
  ctx.save();
  
  // Создаем временный канвас для сохранения исходного изображения
  const tempCanvas = createCanvas(canvas.width, canvas.height);
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.drawImage(canvas, 0, 0);
  
  // Очищаем оригинальный канвас
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Выбираем тип трансформации
  const transformType = seed % 4; // 0: поворот, 1: масштаб, 2: сдвиг, 3: искажение
  
  // Центр изображения
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  
  // Интенсивность эффекта в зависимости от редкости (меньше для редких, чтобы сохранить детали)
  const intensityFactor = 0.3 - (getRarityLevel(rarity) * 0.05);
  
  switch (transformType) {
    case 0: // Небольшой поворот
      const angle = ((seed % 10) - 5) * intensityFactor * Math.PI / 180;
      ctx.translate(centerX, centerY);
      ctx.rotate(angle);
      ctx.drawImage(tempCanvas, -centerX, -centerY);
      break;
      
    case 1: // Масштабирование
      const scale = 1 + ((seed % 10) - 5) * intensityFactor / 50;
      ctx.translate(centerX, centerY);
      ctx.scale(scale, scale);
      ctx.drawImage(tempCanvas, -centerX, -centerY);
      break;
      
    case 2: // Сдвиг
      const shiftX = ((seed % 20) - 10) * intensityFactor;
      const shiftY = ((seed % 30) - 15) * intensityFactor;
      ctx.drawImage(tempCanvas, shiftX, shiftY);
      break;
      
    case 3: // Легкое искажение с сохранением пропорций
      // Рисуем исходное изображение
      ctx.drawImage(tempCanvas, 0, 0);
      
      // Накладываем "волну" на изображение
      const waveIntensity = intensityFactor * 5;
      const waveFrequency = (seed % 10) + 5;
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const tempData = tempCtx.getImageData(0, 0, canvas.width, canvas.height);
      
      for (let y = 0; y < canvas.height; y++) {
        const waveOffset = Math.sin(y / waveFrequency) * waveIntensity;
        
        for (let x = 0; x < canvas.width; x++) {
          const sourceX = Math.floor(x + waveOffset);
          
          if (sourceX >= 0 && sourceX < canvas.width) {
            const sourcePos = (y * canvas.width + sourceX) * 4;
            const targetPos = (y * canvas.width + x) * 4;
            
            imageData.data[targetPos] = tempData.data[sourcePos];
            imageData.data[targetPos + 1] = tempData.data[sourcePos + 1];
            imageData.data[targetPos + 2] = tempData.data[sourcePos + 2];
            imageData.data[targetPos + 3] = tempData.data[sourcePos + 3];
          }
        }
      }
      
      ctx.putImageData(imageData, 0, 0);
      break;
  }
  
  // Восстанавливаем контекст рисования
  ctx.restore();
}

/**
 * Применяет эффект свечения
 */
function applyGlowEffect(canvas: Canvas, ctx: CanvasRenderingContext2D, rarity: NFTRarity, seed: number): void {
  // Сохраняем текущий контекст рисования
  ctx.save();
  
  // Определяем параметры свечения в зависимости от редкости
  const glowSize = 5 + (getRarityLevel(rarity) * 2);
  const glowOpacity = 0.3 + (getRarityLevel(rarity) * 0.05);
  
  // Выбираем тип свечения
  const glowType = seed % 3; // 0: общее, 1: по краям, 2: выборочно
  
  // Выбираем цвет свечения в зависимости от редкости
  const glowColor = getGlowColorByRarity(rarity, seed);
  
  switch (glowType) {
    case 0: // Общее свечение
      // Создаем размытую копию изображения для свечения
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = glowSize;
      ctx.globalAlpha = glowOpacity;
      
      // Используем композицию, чтобы создать эффект свечения
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(canvas, 0, 0);
      break;
      
    case 1: // Свечение по краям (виньетка)
      ctx.globalCompositeOperation = 'lighter';
      
      // Создаем свечение по краям
      const gradient = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, Math.min(canvas.width, canvas.height) * 0.3,
        canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height) * 0.7
      );
      
      gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
      gradient.addColorStop(1, glowColor);
      
      ctx.globalAlpha = glowOpacity;
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      break;
      
    case 2: // Выборочное свечение (точки)
      ctx.globalCompositeOperation = 'lighter';
      
      // Количество точек свечения зависит от редкости
      const spotsCount = 3 + (getRarityLevel(rarity) * 2);
      
      // Размер точек
      const maxSpotSize = Math.min(canvas.width, canvas.height) * 0.2;
      
      for (let i = 0; i < spotsCount; i++) {
        const x = (seed * (i + 1)) % canvas.width;
        const y = (seed * (i + 2)) % canvas.height;
        const size = (seed % maxSpotSize) + maxSpotSize / 2;
        
        const spotGradient = ctx.createRadialGradient(x, y, 0, x, y, size);
        spotGradient.addColorStop(0, glowColor);
        spotGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        
        ctx.globalAlpha = glowOpacity;
        ctx.fillStyle = spotGradient;
        ctx.fillRect(x - size, y - size, size * 2, size * 2);
      }
      break;
  }
  
  // Восстанавливаем контекст рисования
  ctx.restore();
}

/**
 * Применяет эффекты цветовой коррекции
 */
function applyColorizeEffect(canvas: Canvas, ctx: CanvasRenderingContext2D, rarity: NFTRarity, seed: number): void {
  // Сохраняем текущий контекст рисования
  ctx.save();
  
  // Получаем данные изображения
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  
  // Выбираем тип цветовой коррекции
  const colorizeType = seed % 3; // 0: оттенок, 1: каналы RGB, 2: акцент на один канал
  
  // Интенсивность эффекта в зависимости от редкости
  const intensity = 0.1 + (getRarityLevel(rarity) * 0.05);
  
  switch (colorizeType) {
    case 0: // Изменение оттенка
      const hueShift = seed % 360; // Сдвиг в градусах (0-359)
      
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        const hsv = rgbToHsv(r, g, b);
        hsv.h = (hsv.h + hueShift * intensity) % 360;
        
        const rgb = hsvToRgb(hsv.h, hsv.s, hsv.v);
        data[i] = rgb.r;
        data[i + 1] = rgb.g;
        data[i + 2] = rgb.b;
      }
      break;
      
    case 1: // Регулировка каналов RGB
      const rAdjust = 1 + ((seed % 20) - 10) / 100 * intensity;
      const gAdjust = 1 + ((seed % 30) - 15) / 100 * intensity;
      const bAdjust = 1 + ((seed % 40) - 20) / 100 * intensity;
      
      for (let i = 0; i < data.length; i += 4) {
        data[i] = clamp(data[i] * rAdjust);
        data[i + 1] = clamp(data[i + 1] * gAdjust);
        data[i + 2] = clamp(data[i + 2] * bAdjust);
      }
      break;
      
    case 2: // Акцент на один канал
      const channel = seed % 3; // 0: красный, 1: зеленый, 2: синий
      const channelBoost = 1 + intensity;
      const otherChannelFactor = 1 - intensity / 2;
      
      for (let i = 0; i < data.length; i += 4) {
        if (channel === 0) {
          data[i] = clamp(data[i] * channelBoost);
          data[i + 1] = clamp(data[i + 1] * otherChannelFactor);
          data[i + 2] = clamp(data[i + 2] * otherChannelFactor);
        } else if (channel === 1) {
          data[i] = clamp(data[i] * otherChannelFactor);
          data[i + 1] = clamp(data[i + 1] * channelBoost);
          data[i + 2] = clamp(data[i + 2] * otherChannelFactor);
        } else {
          data[i] = clamp(data[i] * otherChannelFactor);
          data[i + 1] = clamp(data[i + 1] * otherChannelFactor);
          data[i + 2] = clamp(data[i + 2] * channelBoost);
        }
      }
      break;
  }
  
  // Применяем измененные данные изображения
  ctx.putImageData(imageData, 0, 0);
  
  // Восстанавливаем контекст рисования
  ctx.restore();
}

/**
 * Добавляет уникальный водяной знак, идентифицирующий NFT
 */
function addUniqueWatermark(canvas: Canvas, ctx: CanvasRenderingContext2D, rarity: NFTRarity): void {
  // Сохраняем текущий контекст рисования
  ctx.save();
  
  // Генерируем уникальный идентификатор
  const timestamp = Date.now();
  const randomId = crypto.randomBytes(4).toString('hex');
  
  // Задаем стиль для водяного знака
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = getTextColorByRarity(rarity);
  ctx.font = '12px Arial';
  
  // Помещаем водяной знак в нижний правый угол
  const text = `Bnalbank NFT ${randomId}-${timestamp}`;
  const textWidth = ctx.measureText(text).width;
  
  ctx.fillText(text, canvas.width - textWidth - 20, canvas.height - 20);
  
  // Восстанавливаем контекст рисования
  ctx.restore();
}

/**
 * Сохраняет сгенерированное изображение с уникальным именем
 */
async function saveGeneratedImage(canvas: Canvas, rarity: NFTRarity): Promise<string> {
  // Создаем уникальное имя файла
  const timestamp = Date.now();
  const randomId = crypto.randomBytes(8).toString('hex');
  const fileName = `${rarity}_advanced_${timestamp}_${randomId}.jpg`;
  
  // Пути для сохранения файлов
  const clientDir = 'client/public/assets/nft/advanced';
  const publicDir = 'public/assets/nft/advanced';
  
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
  
  // Получаем буфер изображения
  const buffer = canvas.toBuffer('image/jpeg', { quality: 0.9 });
  
  // Сохраняем в обе директории
  fs.writeFileSync(clientFilePath, buffer);
  fs.writeFileSync(publicFilePath, buffer);
  
  // Возвращаем относительный путь к изображению
  return `/assets/nft/advanced/${fileName}`;
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
 * Получает цвет в зависимости от редкости
 */
function getColorByRarity(rarity: NFTRarity, isPrimary: boolean): string {
  const alpha = isPrimary ? 0.3 : 0.2;
  
  switch (rarity) {
    case 'common':
      return `rgba(100, 100, 100, ${alpha})`;
    case 'uncommon':
      return `rgba(80, 180, 80, ${alpha})`;
    case 'rare':
      return `rgba(60, 60, 220, ${alpha})`;
    case 'epic':
      return `rgba(180, 60, 180, ${alpha})`;
    case 'legendary':
      return `rgba(220, 180, 40, ${alpha})`;
    default:
      return `rgba(100, 100, 100, ${alpha})`;
  }
}

/**
 * Получает цвет свечения в зависимости от редкости
 */
function getGlowColorByRarity(rarity: NFTRarity, seed: number): string {
  const intensity = 0.2 + (getRarityLevel(rarity) * 0.1);
  
  // Небольшая вариация в зависимости от seed
  const variation = seed % 40 - 20;
  
  switch (rarity) {
    case 'common':
      return `rgba(200, 200, 200, ${intensity})`;
    case 'uncommon':
      return `rgba(${clamp(80 + variation)}, ${clamp(200 + variation)}, ${clamp(80 + variation)}, ${intensity})`;
    case 'rare':
      return `rgba(${clamp(60 + variation)}, ${clamp(100 + variation)}, ${clamp(220 + variation)}, ${intensity})`;
    case 'epic':
      return `rgba(${clamp(200 + variation)}, ${clamp(60 + variation)}, ${clamp(200 + variation)}, ${intensity})`;
    case 'legendary':
      return `rgba(${clamp(230 + variation)}, ${clamp(200 + variation)}, ${clamp(60 + variation)}, ${intensity})`;
    default:
      return `rgba(200, 200, 200, ${intensity})`;
  }
}

/**
 * Получает цвет текста в зависимости от редкости
 */
function getTextColorByRarity(rarity: NFTRarity): string {
  switch (rarity) {
    case 'common':
      return 'rgba(220, 220, 220, 0.8)';
    case 'uncommon':
      return 'rgba(100, 220, 100, 0.8)';
    case 'rare':
      return 'rgba(80, 80, 240, 0.8)';
    case 'epic':
      return 'rgba(220, 80, 220, 0.8)';
    case 'legendary':
      return 'rgba(240, 200, 60, 0.8)';
    default:
      return 'rgba(220, 220, 220, 0.8)';
  }
}

/**
 * Преобразует RGB в HSV
 */
function rgbToHsv(r: number, g: number, b: number): { h: number, s: number, v: number } {
  r /= 255;
  g /= 255;
  b /= 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const diff = max - min;
  
  let h = 0;
  
  if (diff === 0) {
    h = 0;
  } else if (max === r) {
    h = ((g - b) / diff) % 6;
  } else if (max === g) {
    h = (b - r) / diff + 2;
  } else {
    h = (r - g) / diff + 4;
  }
  
  h = Math.round(h * 60);
  if (h < 0) h += 360;
  
  const s = max === 0 ? 0 : diff / max;
  const v = max;
  
  return { h, s, v };
}

/**
 * Преобразует HSV в RGB
 */
function hsvToRgb(h: number, s: number, v: number): { r: number, g: number, b: number } {
  h /= 60;
  
  const i = Math.floor(h);
  const f = h - i;
  const p = v * (1 - s);
  const q = v * (1 - s * f);
  const t = v * (1 - s * (1 - f));
  
  let r, g, b;
  
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
    default: r = v; g = t; b = p;
  }
  
  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255)
  };
}

/**
 * Ограничивает значение в диапазоне 0-255
 */
function clamp(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}
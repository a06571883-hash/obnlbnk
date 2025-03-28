/**
 * Модуль для генерации фотореалистичных NFT изображений через Replicate API
 * Создает миллионы уникальных изображений с роскошными предметами
 */
import Replicate from 'replicate';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import fetch from 'node-fetch';

// Типы редкости NFT
type NFTRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

// Категории роскошных предметов
const LUXURY_CATEGORIES = ['luxury car', 'expensive watch', 'diamond jewelry', 'luxury mansion', 'cash bundle'];

// Инициализация Replicate API с ключом из переменных окружения
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

/**
 * Генерирует фотореалистичное изображение через Replicate API
 * 
 * @param rarity Редкость NFT, определяющая качество генерации
 * @returns Путь к сгенерированному изображению
 */
export async function generateAIImage(rarity: NFTRarity): Promise<string> {
  try {
    console.log(`Запуск генерации AI изображения для редкости: ${rarity}`);

    // Выбираем случайную категорию роскошных предметов
    const category = LUXURY_CATEGORIES[Math.floor(Math.random() * LUXURY_CATEGORIES.length)];
    
    // Настройки запроса в зависимости от редкости
    const settings = getSettingsByRarity(rarity, category);
    
    // Формируем промпт для генерации изображения
    const prompt = createPrompt(rarity, category);
    
    console.log(`Генерируем изображение по промпту: "${prompt}"`);
    
    // Отправляем запрос на генерацию изображения
    const output = await replicate.run(
      "stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b",
      {
        input: {
          prompt: prompt,
          negative_prompt: "low quality, blurry, distorted, disfigured, cartoon, drawing, painting, crayon, sketch, graphite, impressionist, noisy, highly stylized",
          width: settings.width,
          height: settings.height,
          num_outputs: 1,
          guidance_scale: settings.guidance,
          num_inference_steps: settings.steps,
          refine: "expert_ensemble_refiner",
          high_noise_frac: 0.8
        }
      }
    );
    
    // Проверяем результат
    if (!output || !Array.isArray(output) || output.length === 0) {
      throw new Error('Не удалось получить изображение от Replicate API');
    }
    
    // URL сгенерированного изображения
    const imageUrl = output[0];
    console.log(`Получено изображение от API: ${imageUrl}`);
    
    // Сохраняем изображение локально
    return await saveImageLocally(imageUrl, rarity, category);
    
  } catch (error) {
    console.error('Ошибка при генерации AI изображения:', error);
    throw error;
  }
}

/**
 * Формирует детальный промпт для генерации изображения
 */
function createPrompt(rarity: NFTRarity, category: string): string {
  // Базовые прилагательные для описания роскоши
  const luxuryAdjectives = [
    'elegant', 'luxurious', 'premium', 'high-end', 'exclusive', 'opulent',
    'exquisite', 'pristine', 'magnificent', 'prestigious', 'lavish'
  ];
  
  // Выбираем случайные прилагательные
  const randomAdjectives: string[] = [];
  const adjectiveCount = Math.min(3 + getRarityLevel(rarity), luxuryAdjectives.length);
  
  for (let i = 0; i < adjectiveCount; i++) {
    // Добавляем случайное прилагательное, которого еще нет в списке
    const randomIndex = Math.floor(Math.random() * luxuryAdjectives.length);
    const adjective = luxuryAdjectives[randomIndex];
    
    if (!randomAdjectives.includes(adjective)) {
      randomAdjectives.push(adjective);
    }
  }
  
  // Описания в зависимости от категории
  let specificDetails = '';
  
  switch(category) {
    case 'luxury car':
      specificDetails = 'professionally photographed, detailed, 8k ultra HD';
      break;
    case 'expensive watch':
      specificDetails = 'macro photography, detailed mechanism, reflective surface, 8k ultra HD';
      break;
    case 'diamond jewelry':
      specificDetails = 'sparkling, brilliant cut, professional studio lighting, 8k ultra HD';
      break;
    case 'luxury mansion':
      specificDetails = 'architectural photography, landscaped grounds, swimming pool, 8k ultra HD';
      break;
    case 'cash bundle':
      specificDetails = 'stacked money, crisp bills, professional photography, 8k ultra HD';
      break;
  }
  
  // Делаем промпт более сложным в зависимости от редкости
  const complexityDetails = getRarityLevel(rarity) >= 3 ? 
    ', professional lighting, detailed textures, realistic materials, hyperrealistic, photorealistic' : 
    '';
  
  // Окончательный промпт
  return `${randomAdjectives.join(', ')} ${category}, ${specificDetails}${complexityDetails}`;
}

/**
 * Возвращает настройки генерации в зависимости от редкости
 */
function getSettingsByRarity(rarity: NFTRarity, category: string): { 
  width: number, 
  height: number, 
  guidance: number, 
  steps: number 
} {
  // Базовые настройки
  const baseSettings = {
    width: 768,
    height: 768,
    guidance: 7.5,
    steps: 30
  };
  
  // Определяем пропорции для разных категорий
  if (category === 'luxury car') {
    baseSettings.width = 1024;
    baseSettings.height = 768;
  } else if (category === 'luxury mansion') {
    baseSettings.width = 1024;
    baseSettings.height = 768;
  }
  
  // Улучшаем настройки в зависимости от редкости
  switch (rarity) {
    case 'common':
      // Базовые настройки
      break;
    case 'uncommon':
      baseSettings.steps = 35;
      baseSettings.guidance = 8.0;
      break;
    case 'rare':
      baseSettings.steps = 40;
      baseSettings.guidance = 8.5;
      break;
    case 'epic':
      baseSettings.steps = 45;
      baseSettings.guidance = 9.0;
      break;
    case 'legendary':
      baseSettings.steps = 50;
      baseSettings.guidance = 10.0;
      break;
  }
  
  return baseSettings;
}

/**
 * Сохраняет изображение локально и возвращает путь к нему
 */
async function saveImageLocally(imageUrl: string, rarity: NFTRarity, category: string): Promise<string> {
  try {
    // Загружаем изображение
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Ошибка загрузки изображения: ${response.statusText}`);
    }
    
    // Получаем данные изображения
    const imageBuffer = await response.arrayBuffer();
    
    // Создаем уникальное имя файла
    const timestamp = Date.now();
    const randomId = crypto.randomBytes(8).toString('hex');
    const categorySlug = category.replace(/\s+/g, '_').toLowerCase();
    const fileName = `${rarity}_${categorySlug}_${timestamp}_${randomId}.jpg`;
    
    // Пути для сохранения файлов
    const clientDir = 'client/public/assets/nft/ai-generated';
    const publicDir = 'public/assets/nft/ai-generated';
    
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
    
    // Сохраняем изображения в обе директории
    fs.writeFileSync(clientFilePath, Buffer.from(imageBuffer));
    fs.writeFileSync(publicFilePath, Buffer.from(imageBuffer));
    
    console.log(`Сохранено AI изображение: /assets/nft/ai-generated/${fileName}`);
    
    // Возвращаем относительный путь к изображению
    return `/assets/nft/ai-generated/${fileName}`;
  } catch (error) {
    console.error('Ошибка при сохранении изображения:', error);
    throw error;
  }
}

/**
 * Возвращает числовой уровень редкости (1-5)
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
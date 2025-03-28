/**
 * Генератор фотореалистичных NFT изображений с элементами роскоши
 * Использует Replicate API для создания высококачественных изображений:
 * - Дорогие автомобили (Гелендваген, Рендж Ровер, Феррари, Ламборгини)
 * - Элитные часы (Ролекс, Патек Филипп, Одемар Пиге)
 * - Бриллианты, деньги и другие премиальные предметы
 */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import Replicate from 'replicate';
import fetch from 'node-fetch';

// Путь до директории с публичными файлами
const PUBLIC_DIR = path.join(process.cwd(), 'client', 'public');

// Типы редкости NFT
export type NFTRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

// Типы роскошных предметов
export type LuxuryItemType = 'car' | 'watch' | 'diamond' | 'mansion' | 'money';

// Инициализация клиента Replicate с API ключом из переменных окружения
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN || '',
});

// Доступные модели для генерации изображений
const MODELS = {
  // Модель Stable Diffusion XL для высококачественных изображений
  SDXL: "stability-ai/sdxl:2b017d9b67edd2ee1401238df49d75da53c523f36e363881e057f5dc3ed3c5b2" as `stability-ai/sdxl:2b017d9b67edd2ee1401238df49d75da53c523f36e363881e057f5dc3ed3c5b2`,
  // Модель Stable Diffusion 3 для максимального качества
  SD3: "stability-ai/stable-diffusion-3-medium:4fa5742bd43203b658e9a8b551ef0d758d11b1860a56b8ba0dca0f66fafdac53" as `stability-ai/stable-diffusion-3-medium:4fa5742bd43203b658e9a8b551ef0d758d11b1860a56b8ba0dca0f66fafdac53`
};

/**
 * Создает фотореалистичное изображение NFT с помощью Replicate API
 * @param rarity Редкость NFT
 * @returns Путь к созданному файлу
 */
export async function generateNFTImage(rarity: NFTRarity): Promise<string> {
  try {
    console.log(`=== ГЕНЕРАЦИЯ NFT: Начинаем генерацию фотореалистичного NFT с редкостью: ${rarity} ===`);
    console.log(`API токен Replicate ${process.env.REPLICATE_API_TOKEN ? 'присутствует' : 'отсутствует'}, длина: ${process.env.REPLICATE_API_TOKEN?.length || 0}`);
    
    // Создаем директорию для NFT, если она еще не существует
    const nftDir = path.join(PUBLIC_DIR, 'assets', 'nft');
    if (!fs.existsSync(nftDir)) {
      fs.mkdirSync(nftDir, { recursive: true });
      console.log(`Создана директория для NFT: ${nftDir}`);
    } else {
      console.log(`Директория для NFT уже существует: ${nftDir}`);
    }
    
    // Выбираем тип роскошного предмета в зависимости от редкости
    const itemType = selectLuxuryType(rarity);
    console.log(`ГЕНЕРАЦИЯ NFT: Выбран тип предмета: ${itemType}`);
    
    // Генерируем уникальное имя файла
    const uniqueId = crypto.randomBytes(8).toString('hex');
    const timestamp = Date.now();
    const fileName = `${rarity}_${itemType}_${timestamp}_${uniqueId}.png`;
    const filePath = path.join(nftDir, fileName);
    console.log(`ГЕНЕРАЦИЯ NFT: Файл будет сохранен как: ${filePath}`);
    
    // Создаем промпт в зависимости от типа предмета и редкости
    const prompt = createPrompt(itemType, rarity);
    console.log(`ГЕНЕРАЦИЯ NFT: Создан промпт: ${prompt}`);
    
    // Негативный промпт для избегания нежелательных элементов
    const negativePrompt = "low quality, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry, bad feet, bad drawing, text, signature, logo";
    
    // Вызываем Replicate API для генерации изображения
    console.log(`ГЕНЕРАЦИЯ NFT: Вызов Replicate API...`);
    const model = "stability-ai/sdxl:2b017d9b67edd2ee1401238df49d75da53c523f36e363881e057f5dc3ed3c5b2";
    console.log(`ГЕНЕРАЦИЯ NFT: Используем модель: ${model}`);
    
    try {
      console.log(`ГЕНЕРАЦИЯ NFT: Начало запроса к Replicate API для модели ${model}`);
      
      const output = await replicate.run(
        model,
        {
          input: {
            prompt: prompt,
            negative_prompt: negativePrompt,
            width: 1024,
            height: 1024,
            num_outputs: 1,
            num_inference_steps: 50,
            guidance_scale: 7.5,
            scheduler: "K_EULER",
            seed: Math.floor(Math.random() * 100000)
          }
        }
      ) as string[];

      console.log(`ГЕНЕРАЦИЯ NFT: Ответ от Replicate API получен:`, output);
      
      if (!output || output.length === 0) {
        console.error(`ГЕНЕРАЦИЯ NFT: Пустой ответ от Replicate API`);
        throw new Error('Не удалось получить изображение от Replicate API: пустой ответ');
      }

      // Получаем URL изображения из результата
      const imageUrl = output[0];
      console.log(`ГЕНЕРАЦИЯ NFT: Получен URL изображения: ${imageUrl}`);
      
      // Скачиваем изображение
      console.log(`ГЕНЕРАЦИЯ NFT: Начинаем скачивание изображения с URL: ${imageUrl}`);
      const response = await fetch(imageUrl);
      
      if (!response.ok) {
        console.error(`ГЕНЕРАЦИЯ NFT: Ошибка при скачивании изображения: ${response.status} ${response.statusText}`);
        throw new Error(`Ошибка при скачивании изображения: ${response.status} ${response.statusText}`);
      }
      
      const buffer = await response.buffer();
      console.log(`ГЕНЕРАЦИЯ NFT: Изображение успешно скачано, размер: ${buffer.length} байт`);
      
      // Сохраняем изображение
      console.log(`ГЕНЕРАЦИЯ NFT: Сохраняем изображение в: ${filePath}`);
      fs.writeFileSync(filePath, buffer);
      console.log(`ГЕНЕРАЦИЯ NFT: Изображение успешно сохранено: ${filePath}`);
      
      // Возвращаем публичный путь к файлу
      const publicPath = `/assets/nft/${fileName}`;
      console.log(`ГЕНЕРАЦИЯ NFT: Возвращаем публичный путь: ${publicPath}`);
      return publicPath;
    } catch (error) {
      console.error('ГЕНЕРАЦИЯ NFT: Ошибка при вызове Replicate API:', error);
      throw error; // Перебрасываем ошибку для обработки в основном блоке try-catch
    }
  } catch (error) {
    console.error('ГЕНЕРАЦИЯ NFT: Ошибка при генерации NFT изображения:', error);
    
    // В случае ошибки, возвращаем запасное изображение
    console.log('ГЕНЕРАЦИЯ NFT: Создаем запасное SVG изображение');
    return createFallbackImage(rarity);
  }
}

/**
 * Создает запасное изображение в случае ошибки API
 * @param rarity Редкость NFT
 * @returns Путь к созданному файлу
 */
function createFallbackImage(rarity: NFTRarity): string {
  try {
    console.log(`Создание запасного изображения для редкости: ${rarity}`);
    // Выбираем тип роскошного предмета
    const itemType = selectLuxuryType(rarity);
    
    // Генерируем уникальное имя файла
    const uniqueId = crypto.randomBytes(8).toString('hex');
    const timestamp = Date.now();
    const fileName = `${rarity}_${itemType}_${timestamp}_${uniqueId}.svg`;
    const filePath = path.join(PUBLIC_DIR, 'assets', 'nft', fileName);
    
    // Создаем базовое SVG-изображение
    const svgContent = generateFallbackSVG(rarity, itemType);
    
    // Записываем файл
    fs.writeFileSync(filePath, svgContent);
    
    // Возвращаем публичный путь к файлу
    return `/assets/nft/${fileName}`;
  } catch (error) {
    console.error('Ошибка при создании запасного изображения:', error);
    // Возвращаем стандартное изображение NFT
    return `/assets/nft/default.svg`;
  }
}

/**
 * Генерирует SVG для запасного изображения
 */
function generateFallbackSVG(rarity: NFTRarity, itemType: LuxuryItemType): string {
  // Цвета в зависимости от редкости
  const colors = {
    common: { bg: '#1A1A1A', primary: '#4B5563', accent: '#6B7280' },
    uncommon: { bg: '#064E3B', primary: '#10B981', accent: '#34D399' },
    rare: { bg: '#1E40AF', primary: '#3B82F6', accent: '#60A5FA' },
    epic: { bg: '#581C87', primary: '#8B5CF6', accent: '#A78BFA' },
    legendary: { bg: '#92400E', primary: '#F59E0B', accent: '#FBBF24' }
  };
  
  const color = colors[rarity];
  
  // Текст для изображения
  const texts = {
    car: 'Роскошный Автомобиль',
    watch: 'Элитные Часы',
    diamond: 'Драгоценный Камень',
    mansion: 'Роскошный Особняк',
    money: 'Денежный Поток'
  };
  
  const text = texts[itemType];
  
  return `
    <svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
      <rect width="1024" height="1024" fill="${color.bg}" />
      
      <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${color.primary}" stop-opacity="0.8" />
        <stop offset="100%" stop-color="${color.accent}" stop-opacity="0.8" />
      </linearGradient>
      
      <rect x="50" y="50" width="924" height="924" rx="20" ry="20" fill="url(#grad)" opacity="0.3" />
      
      <text x="512" y="400" font-family="Arial" font-size="48" text-anchor="middle" fill="white">
        ${text}
      </text>
      
      <text x="512" y="500" font-family="Arial" font-size="36" text-anchor="middle" fill="white">
        ${rarity.toUpperCase()}
      </text>
      
      <text x="512" y="624" font-family="Arial" font-size="24" text-anchor="middle" fill="white">
        Изображение создается...
      </text>
    </svg>
  `;
}

/**
 * Выбирает тип роскошного предмета в зависимости от редкости
 */
function selectLuxuryType(rarity: NFTRarity): LuxuryItemType {
  // Создаем случайное число на основе редкости и текущего времени
  const seed = crypto.createHash('sha256')
    .update(rarity + Date.now().toString())
    .digest('hex');
  const randomValue = parseInt(seed.substring(0, 8), 16) / 0xffffffff;
  
  // Разные вероятности для разных типов в зависимости от редкости
  switch (rarity) {
    case 'legendary':
      // Для легендарной редкости больше шансов на автомобили и особняки
      if (randomValue < 0.4) return 'car';
      if (randomValue < 0.7) return 'mansion';
      if (randomValue < 0.85) return 'diamond';
      if (randomValue < 0.95) return 'watch';
      return 'money';
    
    case 'epic':
      // Для эпической редкости больше шансов на часы и бриллианты
      if (randomValue < 0.3) return 'car';
      if (randomValue < 0.5) return 'watch';
      if (randomValue < 0.7) return 'diamond';
      if (randomValue < 0.85) return 'mansion';
      return 'money';
    
    case 'rare':
      // Для редкой редкости более равномерное распределение
      if (randomValue < 0.25) return 'car';
      if (randomValue < 0.5) return 'watch';
      if (randomValue < 0.7) return 'diamond';
      if (randomValue < 0.85) return 'money';
      return 'mansion';
    
    case 'uncommon':
      // Для необычной редкости больше шансов на деньги и часы
      if (randomValue < 0.2) return 'car';
      if (randomValue < 0.4) return 'watch';
      if (randomValue < 0.6) return 'money';
      if (randomValue < 0.8) return 'diamond';
      return 'mansion';
    
    case 'common':
    default:
      // Для обычной редкости больше шансов на деньги
      if (randomValue < 0.15) return 'car';
      if (randomValue < 0.35) return 'watch';
      if (randomValue < 0.65) return 'money';
      if (randomValue < 0.85) return 'diamond';
      return 'mansion';
  }
}

/**
 * Создает промпт для генерации изображения в зависимости от типа предмета и редкости
 */
function createPrompt(itemType: LuxuryItemType, rarity: NFTRarity): string {
  // Базовые настройки промпта для высокого качества
  const basePrompt = "8k, ultra realistic, highly detailed, professional photography, high end, luxury";
  
  // Дополнительные характеристики в зависимости от редкости
  let rarityDesc = "";
  switch (rarity) {
    case 'legendary':
      rarityDesc = "extremely rare, one of a kind, masterpiece, perfect, iconic, legendary";
      break;
    case 'epic':
      rarityDesc = "very rare, exceptional quality, impressive, extraordinary, elite";
      break;
    case 'rare':
      rarityDesc = "rare, valuable, premium quality, limited edition";
      break;
    case 'uncommon':
      rarityDesc = "uncommon, good quality, distinctive";
      break;
    case 'common':
      rarityDesc = "standard quality";
      break;
  }
  
  // Специфические промпты для каждого типа предмета
  let specificPrompt = "";
  
  switch (itemType) {
    case 'car':
      // Автомобили премиум-класса в зависимости от редкости
      if (rarity === 'legendary') {
        // Для легендарных - суперкары или редкие лимитированные модели
        const luxuryCars = [
          "Lamborghini Veneno, sports car, luxury, exclusive, futuristic design, limited edition, V12 engine, carbon fiber",
          "Ferrari LaFerrari, hypercar, luxury, exclusive, aerodynamic design, hybrid V12 engine, elegant",
          "Bugatti Chiron, hypercar, luxury exclusive, W16 engine, carbon fiber, elegant, sophisticated",
          "Mercedes-Maybach S-Class, ultra-luxury car, elegant, sophisticated, premium interior, exclusive",
          "Rolls-Royce Phantom, luxury car, handcrafted, premium leather interior, iconic Spirit of Ecstasy"
        ];
        specificPrompt = luxuryCars[Math.floor(Math.random() * luxuryCars.length)];
      } else if (rarity === 'epic' || rarity === 'rare') {
        // Для эпических и редких - премиум автомобили
        const premiumCars = [
          "Mercedes G-Class (G-Wagon), luxury SUV, iconic boxy design, premium interior, off-road capability",
          "Range Rover, luxury SUV, premium interior, elegant design, all-terrain capability",
          "Porsche 911, sports car, iconic design, precision engineering, powerful engine",
          "Aston Martin DB11, luxury GT car, elegant design, powerful engine, handcrafted interior",
          "Bentley Continental GT, luxury coupe, handcrafted interior, powerful W12 engine, elegant"
        ];
        specificPrompt = premiumCars[Math.floor(Math.random() * premiumCars.length)];
      } else {
        // Для uncommon и common - более доступные премиум автомобили
        const standardCars = [
          "BMW 7 Series, luxury sedan, advanced technology, comfort, premium interior",
          "Audi A8, luxury sedan, premium interior, advanced technology, elegant design",
          "Lexus LS, luxury sedan, quality craftsmanship, comfortable interior, elegant design",
          "Mercedes E-Class, luxury sedan, advanced safety features, premium materials, elegant",
          "Cadillac Escalade, luxury SUV, spacious interior, premium features, commanding presence"
        ];
        specificPrompt = standardCars[Math.floor(Math.random() * standardCars.length)];
      }
      break;
    
    case 'watch':
      // Часы премиум-класса в зависимости от редкости
      if (rarity === 'legendary') {
        // Для легендарных - самые дорогие и редкие часы
        const legendaryWatches = [
          "Patek Philippe Grandmaster Chime, luxury watch, extremely rare, complicated movement, handcrafted, gold case",
          "Audemars Piguet Royal Oak Concept, luxury watch, innovative design, complex mechanism, limited edition",
          "Richard Mille RM 56-02, luxury watch, sapphire case, skeleton movement, exclusive, high-tech materials",
          "Vacheron Constantin Les Cabinotiers, luxury watch, unique piece, complicated movement, artisanal craftsmanship",
          "Jacob & Co Astronomia, luxury watch, astronomical complications, rotating mechanism, diamonds, sapphire"
        ];
        specificPrompt = legendaryWatches[Math.floor(Math.random() * legendaryWatches.length)];
      } else if (rarity === 'epic' || rarity === 'rare') {
        // Для эпических и редких - высококлассные часы
        const premiumWatches = [
          "Rolex Daytona, luxury watch, chronograph, precision, iconic design, stainless steel, gold",
          "Patek Philippe Nautilus, luxury watch, iconic design, mechanical movement, stainless steel, blue dial",
          "Audemars Piguet Royal Oak, luxury watch, octagonal bezel, iconic design, mechanical movement",
          "Jaeger-LeCoultre Reverso, luxury watch, reversible case, art deco design, handcrafted",
          "Omega Speedmaster Moonwatch, luxury watch, chronograph, moon landing history, iconic"
        ];
        specificPrompt = premiumWatches[Math.floor(Math.random() * premiumWatches.length)];
      } else {
        // Для uncommon и common - более доступные премиум часы
        const standardWatches = [
          "TAG Heuer Carrera, luxury watch, chronograph, sporty design, precision engineering",
          "Breitling Navitimer, luxury watch, pilot's watch, chronograph, slide rule bezel",
          "IWC Portugieser, luxury watch, classic design, mechanical movement, elegant",
          "Tudor Black Bay, luxury watch, diving watch, vintage-inspired, robust construction",
          "Longines Master Collection, luxury watch, elegant design, automatic movement, tradition"
        ];
        specificPrompt = standardWatches[Math.floor(Math.random() * standardWatches.length)];
      }
      break;
    
    case 'diamond':
      // Драгоценности в зависимости от редкости
      if (rarity === 'legendary') {
        // Для легендарных - самые редкие и крупные бриллианты
        const legendaryDiamonds = [
          "Flawless pink diamond, large carat, brilliant cut, extremely rare, perfect clarity, dazzling sparkle, premium jewelry",
          "Blue diamond, large carat, extremely rare, perfect clarity, intense color, brilliant cut, luxury jewelry",
          "Yellow diamond, large carat, cushion cut, extremely rare, perfect clarity, vibrant color, luxury jewelry",
          "Emerald cut diamond, large carat, perfect clarity, colorless, exceptional cut, luxury jewelry",
          "Heart shaped diamond, large carat, perfect clarity, colorless, brilliant facets, luxury jewelry"
        ];
        specificPrompt = legendaryDiamonds[Math.floor(Math.random() * legendaryDiamonds.length)];
      } else if (rarity === 'epic' || rarity === 'rare') {
        // Для эпических и редких - высококлассные драгоценности
        const premiumDiamonds = [
          "Diamond necklace, brilliant cut, multiple stones, platinum setting, luxury jewelry, sparkling",
          "Diamond ring, halo setting, center stone, platinum band, luxury jewelry, engagement",
          "Diamond earrings, drop style, white gold, luxury jewelry, elegant, brilliant sparkle",
          "Diamond bracelet, tennis style, white gold setting, luxury jewelry, multiple stones",
          "Diamond pendant, solitaire, platinum chain, luxury jewelry, elegant, brilliant sparkle"
        ];
        specificPrompt = premiumDiamonds[Math.floor(Math.random() * premiumDiamonds.length)];
      } else {
        // Для uncommon и common - более доступные драгоценности
        const standardDiamonds = [
          "Diamond stud earrings, round cut, white gold setting, luxury jewelry, classic",
          "Diamond pendant, small solitaire, gold chain, luxury jewelry, simple elegance",
          "Diamond wedding band, channel set, white gold, luxury jewelry, classic design",
          "Diamond bracelet, delicate design, small stones, gold setting, luxury jewelry",
          "Diamond fashion ring, cluster design, white gold, luxury jewelry, modern"
        ];
        specificPrompt = standardDiamonds[Math.floor(Math.random() * standardDiamonds.length)];
      }
      break;
    
    case 'mansion':
      // Особняки в зависимости от редкости
      if (rarity === 'legendary') {
        // Для легендарных - невероятные резиденции
        const legendaryMansions = [
          "Ultra luxury mansion, oceanfront, infinity pool, modern architecture, palm trees, sunset view, marble, glass walls",
          "Historic castle, luxury estate, stone architecture, towers, extensive grounds, historic, majestic",
          "Private island resort, luxury villa, tropical setting, white sand beaches, infinity pool, exclusive",
          "Mountain chateau, luxury mansion, snow-capped peaks, stone and timber construction, exclusive",
          "Modern architectural masterpiece mansion, clifftop, ocean view, minimalist design, infinity pool, glass"
        ];
        specificPrompt = legendaryMansions[Math.floor(Math.random() * legendaryMansions.length)];
      } else if (rarity === 'epic' || rarity === 'rare') {
        // Для эпических и редких - впечатляющие дома
        const premiumMansions = [
          "Beverly Hills mansion, luxury estate, palm trees, swimming pool, modern architecture, gated",
          "Mediterranean villa, luxury estate, terracotta roof, arched doorways, landscaped gardens, pool",
          "Hamptons beach house, luxury residence, oceanfront, cedar shingles, wrap-around porch, elegant",
          "French chateau style mansion, luxury estate, formal gardens, stone facade, elegant, historic",
          "Modern glass mansion, luxury residence, architectural design, infinity pool, city view, exclusive"
        ];
        specificPrompt = premiumMansions[Math.floor(Math.random() * premiumMansions.length)];
      } else {
        // Для uncommon и common - красивые дома
        const standardMansions = [
          "Colonial style house, luxury home, pillared entrance, symmetrical windows, landscaped yard",
          "Craftsman style house, luxury home, covered porch, wooden details, quality construction",
          "Ranch style house, luxury home, single story, expansive, well-maintained grounds",
          "Tudor style house, luxury home, steep roof, decorative half-timbering, brick construction",
          "Spanish style house, luxury home, stucco walls, terracotta roof, arched doorways"
        ];
        specificPrompt = standardMansions[Math.floor(Math.random() * standardMansions.length)];
      }
      break;
    
    case 'money':
      // Финансовые сюжеты в зависимости от редкости
      if (rarity === 'legendary') {
        // Для легендарных - максимальное богатство
        const legendaryMoney = [
          "Stacks of 100 dollar bills, luxury vault, gold bars, diamonds, wealth, fortune, financial success",
          "Private jet interior with luxury briefcase full of money, wealth, exclusive, business success",
          "Luxury yacht deck with open briefcase of money, ocean view, wealth, success, exclusive lifestyle",
          "Wall Street trading floor, stock market success, financial district, wealth generation, power",
          "Gold bars pyramid with diamond on top, luxury vault, wealth, fortune, financial success"
        ];
        specificPrompt = legendaryMoney[Math.floor(Math.random() * legendaryMoney.length)];
      } else if (rarity === 'epic' || rarity === 'rare') {
        // Для эпических и редких - значительное богатство
        const premiumMoney = [
          "Stack of 100 dollar bills, luxury desk, expensive pen, wealth, business success",
          "Gold coins, treasure, wealth, valuable collection, financial success",
          "Luxury safe with money, organized cash, security, wealth management",
          "Stock market graph showing growth, financial success, trading, investment",
          "Bitcoin, cryptocurrency, digital wealth, financial technology, modern investment"
        ];
        specificPrompt = premiumMoney[Math.floor(Math.random() * premiumMoney.length)];
      } else {
        // Для uncommon и common - умеренное богатство
        const standardMoney = [
          "Wallet with cash, credit cards, financial security, personal finance",
          "Piggy bank with coins, saving, financial planning, investment",
          "Paycheck, financial stability, income, compensation, career success",
          "Budget planner with calculator, financial organization, planning, management",
          "Coins in jar, saving, collecting, financial discipline, goals"
        ];
        specificPrompt = standardMoney[Math.floor(Math.random() * standardMoney.length)];
      }
      break;
  }
  
  // Собираем финальный промпт
  return `${specificPrompt}, ${basePrompt}, ${rarityDesc}`;
}
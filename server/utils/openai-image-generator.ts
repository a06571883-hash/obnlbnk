/**
 * Генератор фотореалистичных NFT изображений с использованием OpenAI DALL-E
 * Создаёт высококачественные изображения роскошных предметов:
 * - Премиальные автомобили (Mercedes G-Wagon, Range Rover, Ferrari, Lamborghini)
 * - Элитные часы (Rolex, Patek Philippe, Audemars Piguet)
 * - Бриллианты, особняки и деньги
 */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import OpenAI from 'openai';

const PUBLIC_DIR = path.join(process.cwd(), 'client', 'public');

// Типы редкостей NFT
export type NFTRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

// Типы роскошных предметов
export type LuxuryItemType = 'car' | 'watch' | 'diamond' | 'mansion' | 'money';

// Инициализация OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Создает фотореалистичное изображение NFT с помощью OpenAI DALL-E
 * @param rarity Редкость NFT
 * @returns Путь к созданному файлу
 */
export async function generateNFTImage(rarity: NFTRarity): Promise<string> {
  try {
    console.log(`=== ГЕНЕРАЦИЯ NFT: Начинаем генерацию фотореалистичного NFT с редкостью: ${rarity} ===`);
    console.log(`API токен OpenAI ${process.env.OPENAI_API_KEY ? 'присутствует' : 'отсутствует'}, длина: ${process.env.OPENAI_API_KEY?.length || 0}`);
    
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
    
    try {
      console.log(`ГЕНЕРАЦИЯ NFT: Начало запроса к OpenAI DALL-E API...`);
      
      // Вызываем DALL-E для генерации изображения
      const response = await openai.images.generate({
        model: "dall-e-3", // Используем DALL-E 3 для фотореалистичных изображений
        prompt: prompt,
        n: 1, // Один вариант
        size: "1024x1024", // Размер изображения
        quality: "hd", // Высокое качество
        style: "vivid", // Яркий стиль для большей реалистичности
        response_format: "b64_json" // Возвращаем base64 для сохранения локально
      });

      console.log(`ГЕНЕРАЦИЯ NFT: Ответ от OpenAI DALL-E API получен`);
      
      if (!response.data || response.data.length === 0) {
        console.error(`ГЕНЕРАЦИЯ NFT: Пустой ответ от OpenAI DALL-E API`);
        throw new Error('Не удалось получить изображение от OpenAI: пустой ответ');
      }

      // Получаем данные изображения в формате base64
      const base64Data = response.data[0].b64_json;
      if (!base64Data) {
        console.error(`ГЕНЕРАЦИЯ NFT: Отсутствуют данные изображения в ответе`);
        throw new Error('Не удалось получить данные изображения из ответа API');
      }
      
      console.log(`ГЕНЕРАЦИЯ NFT: Данные base64 успешно получены, длина: ${base64Data.length}`);
      
      // Декодируем base64 в буфер
      const imageBuffer = Buffer.from(base64Data, 'base64');
      console.log(`ГЕНЕРАЦИЯ NFT: Изображение декодировано, размер: ${imageBuffer.length} байт`);
      
      // Сохраняем изображение
      console.log(`ГЕНЕРАЦИЯ NFT: Сохраняем изображение в: ${filePath}`);
      fs.writeFileSync(filePath, imageBuffer);
      console.log(`ГЕНЕРАЦИЯ NFT: Изображение успешно сохранено: ${filePath}`);
      
      // Возвращаем публичный путь к файлу
      const publicPath = `/assets/nft/${fileName}`;
      console.log(`ГЕНЕРАЦИЯ NFT: Возвращаем публичный путь: ${publicPath}`);
      return publicPath;
    } catch (error) {
      console.error('ГЕНЕРАЦИЯ NFT: Ошибка при вызове OpenAI DALL-E API:', error);
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
 * Генерирует SVG для запасного изображения с улучшенным дизайном
 */
function generateFallbackSVG(rarity: NFTRarity, itemType: LuxuryItemType): string {
  // Цвета в зависимости от редкости с градиентами
  const colors = {
    common: { bg: '#1E293B', primary: '#4B5563', accent: '#6B7280', grad1: '#374151', grad2: '#4B5563' },
    uncommon: { bg: '#064E3B', primary: '#10B981', accent: '#34D399', grad1: '#059669', grad2: '#10B981' },
    rare: { bg: '#1E3A8A', primary: '#3B82F6', accent: '#60A5FA', grad1: '#2563EB', grad2: '#3B82F6' },
    epic: { bg: '#581C87', primary: '#8B5CF6', accent: '#A78BFA', grad1: '#7C3AED', grad2: '#8B5CF6' },
    legendary: { bg: '#7C2D12', primary: '#F59E0B', accent: '#FBBF24', grad1: '#EA580C', grad2: '#F59E0B' }
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
  
  // Иконки в зависимости от типа предмета
  const icons = {
    car: '<path d="M35,56H14c-2.2,0-4-1.8-4-4v-4c0-2.2,1.8-4,4-4h21c2.2,0,4,1.8,4,4v4C39,54.2,37.2,56,35,56z M84,49v4c0,2.2-1.8,4-4,4H59 c-2.2,0-4-1.8-4-4v-4c0-2.2,1.8-4,4-4h21C82.2,45,84,46.8,84,49z M76.5,33h-45c-6.6,0-12,5.4-12,12v3h5.2c0.7-5.7,5.6-10,11.4-10 h7.9c5.8,0,10.6,4.3,11.4,10h6c0.7-5.7,5.6-10,11.4-10h7.9c5.8,0,10.6,4.3,11.4,10H87v-3C87,38.4,82.2,33,76.5,33z" fill="${color.primary}"/>',
    watch: '<path d="M50,25c-13.8,0-25,11.2-25,25s11.2,25,25,25s25-11.2,25-25S63.8,25,50,25z M50,70c-11,0-20-9-20-20s9-20,20-20s20,9,20,20 S61,70,50,70z M50,45c-2.8,0-5,2.2-5,5s2.2,5,5,5s5-2.2,5-5S52.8,45,50,45z M45,23.6c0-1.4,1.1-2.6,2.5-2.6h5c1.4,0,2.5,1.2,2.5,2.6 V30h-10V23.6z M55,70v6.4c0,1.4-1.1,2.6-2.5,2.6h-5c-1.4,0-2.5-1.2-2.5-2.6V70H55z" fill="${color.primary}"/>',
    diamond: '<path d="M50,20L30,40l20,40l20-40L50,20z M42,42l8-14l8,14H42z M63,42l-13,26L37,42H63z" fill="${color.primary}"/>',
    mansion: '<path d="M85,45V85H15V45H85z M50,20L15,40v5h70v-5L50,20z M65,75H35V55h30V75z" fill="${color.primary}"/>',
    money: '<path d="M80,30H20v40h60V30z M50,62c-6.6,0-12-5.4-12-12s5.4-12,12-12s12,5.4,12,12S56.6,62,50,62z M50,42c-4.4,0-8,3.6-8,8 s3.6,8,8,8s8-3.6,8-8S54.4,42,50,42z M30,38c-2.2,0-4-1.8-4-4s1.8-4,4-4s4,1.8,4,4S32.2,38,30,38z M70,66c-2.2,0-4-1.8-4-4 s1.8-4,4-4s4,1.8,4,4S72.2,66,70,66z" fill="${color.primary}"/>'
  };
  
  const icon = icons[itemType];
  
  return `
    <svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
      <!-- Фон с градиентом -->
      <defs>
        <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${color.bg}" />
          <stop offset="100%" stop-color="${color.bg}" stop-opacity="0.8" />
        </linearGradient>
        <linearGradient id="cardGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${color.grad1}" />
          <stop offset="100%" stop-color="${color.grad2}" />
        </linearGradient>
        <filter id="dropShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="15" />
          <feOffset dx="0" dy="10" result="offsetblur" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.3" />
          </feComponentTransfer>
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <clipPath id="roundedRect">
          <rect x="100" y="100" width="824" height="824" rx="40" ry="40" />
        </clipPath>
      </defs>
      
      <!-- Основной фон -->
      <rect width="1024" height="1024" fill="url(#bgGradient)" />
      
      <!-- Светящийся эффект -->
      <circle cx="512" cy="300" r="300" fill="${color.primary}" opacity="0.15" />
      
      <!-- Основная карточка -->
      <g filter="url(#dropShadow)">
        <rect x="100" y="100" width="824" height="824" rx="40" ry="40" fill="url(#cardGradient)" />
      </g>
      
      <!-- Декоративные элементы -->
      <rect x="150" y="150" width="724" height="724" rx="30" ry="30" fill="none" stroke="${color.accent}" stroke-width="2" opacity="0.7" />
      <rect x="170" y="170" width="684" height="684" rx="20" ry="20" fill="none" stroke="${color.accent}" stroke-width="1" opacity="0.5" />
      
      <!-- Иконка -->
      <g transform="translate(512, 400) scale(6)">
        ${icon}
      </g>
      
      <!-- Текст -->
      <text x="512" y="650" font-family="Arial, sans-serif" font-size="48" text-anchor="middle" fill="white" font-weight="bold">
        ${text}
      </text>
      
      <text x="512" y="720" font-family="Arial, sans-serif" font-size="36" text-anchor="middle" fill="white">
        ${rarity.toUpperCase()}
      </text>
      
      <!-- Блестящий эффект -->
      <g clip-path="url(#roundedRect)">
        <rect x="-200" y="-200" width="300" height="2000" fill="white" opacity="0.05" transform="rotate(45, 512, 512)" />
        <rect x="-250" y="-200" width="100" height="2000" fill="white" opacity="0.1" transform="rotate(45, 512, 512)" />
      </g>
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
  const basePrompt = "ultra realistic, 8k, highly detailed professional photography, luxury, high-end, showcase, studio lighting, no text, no watermarks";
  
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
          "Photo of a Lamborghini Veneno, sports car, luxury exclusive, futuristic design, limited edition, V12 engine, carbon fiber, dramatic lighting, elegant",
          "Photo of a Ferrari LaFerrari, hypercar, luxury, exclusive, aerodynamic design, hybrid V12 engine, elegant, perfect specimen on display",
          "Photo of a Bugatti Chiron, hypercar, luxury exclusive, W16 engine, carbon fiber, elegant, sophisticated, studio lighting",
          "Photo of a Mercedes-Maybach S-Class, ultra-luxury car, elegant, sophisticated, premium interior, exclusive, perfect condition",
          "Photo of a Rolls-Royce Phantom, luxury car, handcrafted, premium leather interior, iconic Spirit of Ecstasy, perfect studio lighting"
        ];
        specificPrompt = luxuryCars[Math.floor(Math.random() * luxuryCars.length)];
      } else if (rarity === 'epic' || rarity === 'rare') {
        // Для эпических и редких - премиум автомобили
        const premiumCars = [
          "Photo of a Mercedes G-Class (G-Wagon), luxury SUV, iconic boxy design, premium interior, off-road capability, perfect condition",
          "Photo of a Range Rover, luxury SUV, premium interior, elegant design, all-terrain capability, studio lighting",
          "Photo of a Porsche 911, sports car, iconic design, precision engineering, powerful engine, perfect showcase",
          "Photo of an Aston Martin DB11, luxury GT car, elegant design, powerful engine, handcrafted interior, studio lighting",
          "Photo of a Bentley Continental GT, luxury coupe, handcrafted interior, powerful W12 engine, elegant, perfect showcase"
        ];
        specificPrompt = premiumCars[Math.floor(Math.random() * premiumCars.length)];
      } else {
        // Для uncommon и common - более доступные премиум автомобили
        const standardCars = [
          "Photo of a BMW 7 Series, luxury sedan, advanced technology, comfort, premium interior, studio lighting",
          "Photo of an Audi A8, luxury sedan, premium interior, advanced technology, elegant design, showroom condition",
          "Photo of a Lexus LS, luxury sedan, quality craftsmanship, comfortable interior, elegant design, professional photography",
          "Photo of a Mercedes E-Class, luxury sedan, advanced safety features, premium materials, elegant, studio lighting",
          "Photo of a Cadillac Escalade, luxury SUV, spacious interior, premium features, commanding presence, perfect condition"
        ];
        specificPrompt = standardCars[Math.floor(Math.random() * standardCars.length)];
      }
      break;
    
    case 'watch':
      // Часы премиум-класса в зависимости от редкости
      if (rarity === 'legendary') {
        // Для легендарных - самые дорогие и редкие часы
        const legendaryWatches = [
          "Photo of a Patek Philippe Grandmaster Chime, luxury watch, extremely rare, complicated movement, handcrafted, gold case, perfect macro photography",
          "Photo of an Audemars Piguet Royal Oak Concept, luxury watch, innovative design, complex mechanism, limited edition, studio lighting",
          "Photo of a Richard Mille RM 56-02, luxury watch, sapphire case, skeleton movement, exclusive, high-tech materials, dramatic lighting",
          "Photo of a Vacheron Constantin Les Cabinotiers, luxury watch, unique piece, complicated movement, artisanal craftsmanship, perfect showcase",
          "Photo of a Jacob & Co Astronomia, luxury watch, astronomical complications, rotating mechanism, diamonds, sapphire, studio lighting"
        ];
        specificPrompt = legendaryWatches[Math.floor(Math.random() * legendaryWatches.length)];
      } else if (rarity === 'epic' || rarity === 'rare') {
        // Для эпических и редких - высококлассные часы
        const premiumWatches = [
          "Photo of a Rolex Daytona, luxury watch, chronograph, precision, iconic design, stainless steel, gold, macro photography",
          "Photo of a Patek Philippe Nautilus, luxury watch, iconic design, mechanical movement, stainless steel, blue dial, studio lighting",
          "Photo of an Audemars Piguet Royal Oak, luxury watch, octagonal bezel, iconic design, mechanical movement, perfect lighting",
          "Photo of a Jaeger-LeCoultre Reverso, luxury watch, reversible case, art deco design, handcrafted, studio lighting",
          "Photo of an Omega Speedmaster Moonwatch, luxury watch, chronograph, moon landing history, iconic, dramatic lighting"
        ];
        specificPrompt = premiumWatches[Math.floor(Math.random() * premiumWatches.length)];
      } else {
        // Для uncommon и common - более доступные премиум часы
        const standardWatches = [
          "Photo of a TAG Heuer Carrera, luxury watch, chronograph, sporty design, precision engineering, macro photography",
          "Photo of a Breitling Navitimer, luxury watch, pilot's watch, chronograph, slide rule bezel, studio lighting",
          "Photo of an IWC Portugieser, luxury watch, classic design, mechanical movement, elegant, perfect showcase",
          "Photo of a Tudor Black Bay, luxury watch, diving watch, vintage-inspired, robust construction, dramatic lighting",
          "Photo of a Longines Master Collection, luxury watch, elegant design, automatic movement, tradition, studio photography"
        ];
        specificPrompt = standardWatches[Math.floor(Math.random() * standardWatches.length)];
      }
      break;
    
    case 'diamond':
      // Драгоценности в зависимости от редкости
      if (rarity === 'legendary') {
        // Для легендарных - самые редкие и крупные бриллианты
        const legendaryDiamonds = [
          "Photo of a flawless pink diamond, large carat, brilliant cut, extremely rare, perfect clarity, dazzling sparkle, premium jewelry, macro photography",
          "Photo of a blue diamond, large carat, extremely rare, perfect clarity, intense color, brilliant cut, luxury jewelry, studio lighting",
          "Photo of a yellow diamond, large carat, cushion cut, extremely rare, perfect clarity, vibrant color, luxury jewelry, dramatic lighting",
          "Photo of an emerald cut diamond, large carat, perfect clarity, colorless, exceptional cut, luxury jewelry, perfect showcase",
          "Photo of a heart shaped diamond, large carat, perfect clarity, colorless, brilliant facets, luxury jewelry, studio lighting"
        ];
        specificPrompt = legendaryDiamonds[Math.floor(Math.random() * legendaryDiamonds.length)];
      } else if (rarity === 'epic' || rarity === 'rare') {
        // Для эпических и редких - высококлассные драгоценности
        const premiumDiamonds = [
          "Photo of a diamond necklace, brilliant cut, multiple stones, platinum setting, luxury jewelry, sparkling, studio lighting",
          "Photo of a diamond ring, halo setting, center stone, platinum band, luxury jewelry, engagement, macro photography",
          "Photo of diamond earrings, drop style, white gold, luxury jewelry, elegant, brilliant sparkle, studio lighting",
          "Photo of a diamond bracelet, tennis style, white gold setting, luxury jewelry, multiple stones, dramatic lighting",
          "Photo of a diamond pendant, solitaire, platinum chain, luxury jewelry, elegant, brilliant sparkle, perfect showcase"
        ];
        specificPrompt = premiumDiamonds[Math.floor(Math.random() * premiumDiamonds.length)];
      } else {
        // Для uncommon и common - более доступные драгоценности
        const standardDiamonds = [
          "Photo of diamond stud earrings, round cut, white gold setting, luxury jewelry, classic, studio lighting",
          "Photo of a diamond pendant, small solitaire, gold chain, luxury jewelry, simple elegance, macro photography",
          "Photo of a diamond wedding band, channel set, white gold, luxury jewelry, classic design, studio lighting",
          "Photo of a diamond bracelet, delicate design, small stones, gold setting, luxury jewelry, dramatic lighting",
          "Photo of a diamond fashion ring, cluster design, white gold, luxury jewelry, modern, perfect showcase"
        ];
        specificPrompt = standardDiamonds[Math.floor(Math.random() * standardDiamonds.length)];
      }
      break;
    
    case 'mansion':
      // Особняки в зависимости от редкости
      if (rarity === 'legendary') {
        // Для легендарных - невероятные резиденции
        const legendaryMansions = [
          "Photo of an ultra luxury mansion, oceanfront, infinity pool, modern architecture, palm trees, sunset view, marble, glass walls, aerial photography",
          "Photo of a historic castle, luxury estate, stone architecture, towers, extensive grounds, historic, majestic, dramatic lighting",
          "Photo of a private island resort, luxury villa, tropical paradise, white sand beaches, overwater bungalows, exclusive, paradise, aerial view",
          "Photo of a mountain luxury chalet, snowy peaks, timber construction, floor to ceiling windows, outdoor hot tub, premium interiors, scenic view",
          "Photo of a penthouse in skyscraper, ultra luxury apartment, floor to ceiling windows, city view, modern design, exclusive, penthouse terrace"
        ];
        specificPrompt = legendaryMansions[Math.floor(Math.random() * legendaryMansions.length)];
      } else if (rarity === 'epic' || rarity === 'rare') {
        // Для эпических и редких - роскошные дома
        const premiumMansions = [
          "Photo of a modern luxury villa, infinity pool, ocean view, contemporary architecture, glass walls, sunset, premium photography",
          "Photo of a luxury estate, manicured gardens, fountain, classical architecture, luxury property, exclusive neighborhood, perfect showcase",
          "Photo of a beachfront property, luxury home, private beach access, modern design, exclusive location, perfect condition, aerial view",
          "Photo of a countryside manor, historic home, premium renovation, extensive grounds, luxury estate, perfect photography",
          "Photo of a luxury mountain retreat, timber frame, stone fireplace, panoramic windows, scenic views, premium finish, dramatic lighting"
        ];
        specificPrompt = premiumMansions[Math.floor(Math.random() * premiumMansions.length)];
      } else {
        // Для uncommon и common - хорошие дома
        const standardMansions = [
          "Photo of a suburban luxury home, modern design, well-maintained garden, swimming pool, architectural photography",
          "Photo of a modern condominium, upscale building, city views, contemporary design, balcony, studio lighting",
          "Photo of a renovated townhouse, urban luxury, modern interior, premium finishes, perfect condition, real estate photography",
          "Photo of a lakeside cabin, luxury finish, wooden deck, panoramic windows, peaceful setting, dramatic lighting",
          "Photo of a mediterranean villa, terracotta roof, swimming pool, landscaped garden, warm climate, architectural photography"
        ];
        specificPrompt = standardMansions[Math.floor(Math.random() * standardMansions.length)];
      }
      break;
    
    case 'money':
      // Деньги/богатство в зависимости от редкости
      if (rarity === 'legendary') {
        // Для легендарных - невероятное богатство
        const legendaryMoney = [
          "Photo of stacks of 100 dollar bills, money vault, massive wealth, bundles of cash, fortune, dramatic lighting, studio photography",
          "Photo of gold bars stacked, bank vault, precious metal, wealth, fortune, investment, dramatic lighting",
          "Photo of a luxury safe filled with diamonds, gold coins, paper money, extreme wealth, fortune, studio lighting",
          "Photo of a billionaire's investment portfolio, stocks, gold, real estate, digital assets, wealth management, dramatic visualization",
          "Photo of a luxury lifestyle, private jet, yacht, mansion, sports cars, ultimate wealth display, professional photography"
        ];
        specificPrompt = legendaryMoney[Math.floor(Math.random() * legendaryMoney.length)];
      } else if (rarity === 'epic' || rarity === 'rare') {
        // Для эпических и редких - серьезное богатство
        const premiumMoney = [
          "Photo of stacks of currency, financial success, business profit, investment return, studio lighting",
          "Photo of gold coins, precious metal investment, wealth, valuable collection, numismatic, studio photography",
          "Photo of a business deal, contract signing, successful investment, financial opportunity, dramatic lighting",
          "Photo of stock market success, trading, financial charts, upward trends, wealth building, professional visualization",
          "Photo of crypto investment, digital currency, blockchain visualization, financial technology, modern wealth, studio setting"
        ];
        specificPrompt = premiumMoney[Math.floor(Math.random() * premiumMoney.length)];
      } else {
        // Для uncommon и common - умеренное богатство
        const standardMoney = [
          "Photo of savings account growth, financial planning, investment strategy, money management, studio setting",
          "Photo of investment portfolio, diversified assets, financial security, wealth building, professional composition",
          "Photo of real estate investment, property value, home equity, wealth building, architectural photography",
          "Photo of retirement savings, financial security, investment growth, future planning, studio setting",
          "Photo of business success, small company growth, entrepreneurship, profit increase, professional photography"
        ];
        specificPrompt = standardMoney[Math.floor(Math.random() * standardMoney.length)];
      }
      break;
  }
  
  // Собираем полный промпт
  return `${specificPrompt}. ${rarityDesc}. ${basePrompt}`;
}
/**
 * Генератор реалистичных NFT изображений с элементами роскоши
 * - Дорогие автомобили (Гелендваген, Рендж Ровер, Феррари, Ламборгини)
 * - Элитные часы (Ролекс, Патек Филипп, Одемар Пиге)
 * - Бриллианты, деньги и другие премиальные предметы
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// Путь до директории с публичными файлами
const PUBLIC_DIR = path.join(process.cwd(), 'client', 'public');

// Типы редкости NFT
type NFTRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

// Типы роскошных предметов
type LuxuryItemType = 'car' | 'watch' | 'diamond' | 'money' | 'mansion';

/**
 * Создает SVG-изображение NFT в реалистичном стиле с премиальными объектами
 * @param rarity Редкость NFT
 * @returns Путь к созданному файлу
 */
export async function generateRealisticNFTImage(rarity: NFTRarity): Promise<string> {
  // Создаем директорию для NFT, если она еще не существует
  const nftDir = path.join(PUBLIC_DIR, 'assets', 'nft');
  if (!fs.existsSync(nftDir)) {
    fs.mkdirSync(nftDir, { recursive: true });
  }
  
  // Определяем тип роскошного предмета и стили в зависимости от редкости
  const luxuryType = selectLuxuryType(rarity);
  const styles = getRarityStyles(rarity, luxuryType);
  
  // Генерируем уникальное имя файла с использованием хеша для уникальности
  const uniqueId = crypto.randomBytes(8).toString('hex');
  const fileName = `${rarity}_${Date.now()}_${uniqueId}.svg`;
  const filePath = path.join(nftDir, fileName);
  
  // Генерируем SVG-контент с реалистичным объектом
  const svgContent = generateRealisticSVG(styles);
  
  // Записываем файл
  fs.writeFileSync(filePath, svgContent);
  
  // Возвращаем публичный путь к файлу
  return `/assets/nft/${fileName}`;
}

/**
 * Выбирает тип роскошного предмета в зависимости от редкости
 */
function selectLuxuryType(rarity: NFTRarity): LuxuryItemType {
  // Распределение типов роскошных предметов
  const luxuryTypes: LuxuryItemType[] = ['car', 'car', 'car', 'watch', 'watch', 'diamond', 'money', 'mansion'];
  return luxuryTypes[Math.floor(Math.random() * luxuryTypes.length)];
}

/**
 * Создает генератор случайных чисел с фиксированным семенем для повторяемости
 */
function createRandomGenerator(seed: number) {
  let currentSeed = seed;
  return () => {
    currentSeed = (currentSeed * 9301 + 49297) % 233280;
    return currentSeed / 233280;
  };
}

/**
 * Генерирует SVG в реалистичном стиле
 */
function generateRealisticSVG(styles: {
  backgroundColor: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  gradientColors: string[];
  itemType: LuxuryItemType;
  luxuryBrand: string;
  complexity: number;
}): string {
  const { backgroundColor, primaryColor, secondaryColor, accentColor, gradientColors, itemType, luxuryBrand } = styles;
  
  // Создаем уникальный сид для каждого изображения
  const seed = crypto.randomBytes(4).toString('hex');
  const seedNumber = parseInt(seed, 16);
  const randomGenerator = createRandomGenerator(seedNumber);
  
  // Выбираем контент в зависимости от типа предмета роскоши
  let mainContent = '';
  switch (itemType) {
    case 'car':
      mainContent = generateLuxuryCar(randomGenerator, luxuryBrand, primaryColor, secondaryColor, accentColor);
      break;
    case 'watch':
      mainContent = generateLuxuryWatch(randomGenerator, luxuryBrand, primaryColor, secondaryColor, accentColor);
      break;
    case 'diamond':
      mainContent = generateDiamond(randomGenerator, primaryColor, secondaryColor, accentColor);
      break;
    case 'money':
      mainContent = generateMoneyStack(randomGenerator, primaryColor, secondaryColor, accentColor);
      break;
    case 'mansion':
      mainContent = generateMansion(randomGenerator, primaryColor, secondaryColor, accentColor);
      break;
  }
  
  // Создаем фильтры для реалистичных эффектов
  const filters = `
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="4" flood-opacity="0.3" />
    </filter>
    
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="4" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
    
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${gradientColors[0]}" />
      <stop offset="50%" stop-color="${gradientColors[1]}" />
      <stop offset="100%" stop-color="${gradientColors[2]}" />
    </linearGradient>
    
    <radialGradient id="lightEffect" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
      <stop offset="0%" stop-color="white" stop-opacity="0.7" />
      <stop offset="100%" stop-color="white" stop-opacity="0" />
    </radialGradient>
  `;
  
  // Создаем фирменную метку NFT
  const brandMark = `
    <g transform="translate(10, 236)">
      <rect x="0" y="0" width="100" height="20" rx="5" fill="${accentColor}" opacity="0.8" />
      <text x="10" y="15" font-family="Arial, sans-serif" font-size="12" fill="white">BNALBANK NFT</text>
    </g>
  `;
  
  // Добавляем логотип люксового бренда
  const brandLogo = `
    <g transform="translate(200, 236)">
      <rect x="0" y="0" width="46" height="20" rx="5" fill="#111" opacity="0.8" />
      <text x="5" y="15" font-family="Arial, sans-serif" font-size="10" fill="#FFF">${luxuryBrand}</text>
    </g>
  `;
  
  // Финальный SVG с реалистичным изображением
  return `
  <svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
    <defs>
      ${filters}
    </defs>
    
    <!-- Фон с премиальным градиентом -->
    <rect width="256" height="256" fill="url(#bgGradient)" />
    
    <!-- Эффект освещения -->
    <circle cx="128" cy="128" r="150" fill="url(#lightEffect)" opacity="0.3" />
    
    <!-- Основной контент NFT по центру -->
    <g filter="url(#shadow)">
      ${mainContent}
    </g>
    
    <!-- Брендирование NFT -->
    ${brandMark}
    
    <!-- Логотип люксового бренда -->
    ${brandLogo}
  </svg>
  `;
}

/**
 * Возвращает стили NFT в зависимости от редкости и типа роскошного предмета
 */
function getRarityStyles(rarity: NFTRarity, itemType: LuxuryItemType): {
  backgroundColor: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  gradientColors: string[];
  itemType: LuxuryItemType;
  luxuryBrand: string;
  complexity: number;
} {
  // Список премиальных брендов для каждого типа предмета
  const luxuryBrands: Record<LuxuryItemType, string[]> = {
    car: ['G-Wagon', 'Range Rover', 'Ferrari', 'Lamborghini', 'Bentley', 'Rolls-Royce'],
    watch: ['Rolex', 'Patek Philippe', 'Audemars Piguet', 'Richard Mille', 'Jacob & Co.'],
    diamond: ['Blue Diamond', 'Pink Diamond', 'Emerald Cut', 'Yellow Canary', 'Flawless'],
    money: ['Cash Stack', 'Gold Bars', 'Stock Portfolio', 'Crypto Wallet', 'Gold Coins'],
    mansion: ['Beverly Hills', 'Manhattan', 'Monaco', 'Saint-Tropez', 'Dubai']
  };
  
  // Выбираем случайный бренд из списка
  const brand = luxuryBrands[itemType][Math.floor(Math.random() * luxuryBrands[itemType].length)];
  
  // Базовые цвета для всех вариантов
  const baseColors = {
    backgroundColor: '#0F0F0F',
    primaryColor: '#101010',
    secondaryColor: '#303030',
    accentColor: '#FFD700', // Золотой акцент
    gradientColors: ['#0A0A0A', '#101010', '#1A1A1A']
  };
  
  // Разные стили в зависимости от редкости
  switch (rarity) {
    case 'common':
      return {
        ...baseColors,
        primaryColor: '#333333',
        secondaryColor: '#555555',
        accentColor: '#C0C0C0', // Серебро для обычных
        gradientColors: ['#1A1A1A', '#2A2A2A', '#1A1A1A'],
        itemType,
        luxuryBrand: brand,
        complexity: 1
      };
    
    case 'uncommon':
      return {
        ...baseColors,
        primaryColor: '#1E3A8A',
        secondaryColor: '#2563EB',
        accentColor: '#93C5FD', // Синий
        gradientColors: ['#0F172A', '#1E3A8A', '#0F172A'],
        itemType,
        luxuryBrand: brand,
        complexity: 2
      };
    
    case 'rare':
      return {
        ...baseColors,
        primaryColor: '#4F46E5',
        secondaryColor: '#6366F1',
        accentColor: '#FFD700', // Золото
        gradientColors: ['#1E1B4B', '#4338CA', '#1E1B4B'],
        itemType,
        luxuryBrand: brand,
        complexity: 3
      };
    
    case 'epic':
      return {
        ...baseColors,
        primaryColor: '#9D174D',
        secondaryColor: '#DB2777',
        accentColor: '#FFFFFF', // Платина
        gradientColors: ['#500724', '#9D174D', '#500724'],
        itemType,
        luxuryBrand: brand,
        complexity: 4
      };
    
    case 'legendary':
      return {
        ...baseColors,
        primaryColor: '#B91C1C',
        secondaryColor: '#DC2626',
        accentColor: '#FEF08A', // Золотистый блеск
        gradientColors: ['#7F1D1D', '#B91C1C', '#7F1D1D'],
        itemType,
        luxuryBrand: brand,
        complexity: 5
      };
    
    default:
      return {
        ...baseColors,
        itemType,
        luxuryBrand: brand,
        complexity: 1
      };
  }
}

/**
 * Генерирует изображение роскошного автомобиля
 * Включает премиальные марки: Гелендваген, Рендж Ровер, Феррари, Ламборгини
 */
function generateLuxuryCar(
  randomGenerator: () => number, 
  brand: string, 
  primaryColor: string, 
  secondaryColor: string, 
  accentColor: string
): string {
  // Выбираем форму авто в зависимости от бренда
  let carShape = '';
  
  if (brand === 'G-Wagon') {
    // Геленедваген - квадратный внедорожник с характерной формой
    carShape = `
      <g transform="translate(55, 70) scale(0.7)">
        <!-- Кузов Гелендвагена -->
        <rect x="20" y="60" width="160" height="80" rx="8" fill="${primaryColor}" />
        <rect x="25" y="20" width="150" height="40" rx="5" fill="${primaryColor}" />
        
        <!-- Крыша и стойки -->
        <rect x="25" y="60" width="150" height="5" fill="#333" />
        <rect x="25" y="20" width="5" height="45" fill="#333" />
        <rect x="170" y="20" width="5" height="45" fill="#333" />
        <rect x="90" y="20" width="5" height="45" fill="#333" />
        
        <!-- Колеса -->
        <circle cx="50" cy="140" r="25" fill="#222" />
        <circle cx="50" cy="140" r="15" fill="#444" />
        <circle cx="150" cy="140" r="25" fill="#222" />
        <circle cx="150" cy="140" r="15" fill="#444" />
        
        <!-- Решетка радиатора (характерная для G-класса) -->
        <rect x="30" y="70" width="45" height="20" rx="2" fill="#111" />
        <rect x="35" y="75" width="35" height="10" rx="1" fill="#222" />
        <circle cx="65" cy="80" r="8" fill="${primaryColor}" stroke="#444" stroke-width="1" />
        <text x="62" y="83" font-family="Arial, sans-serif" font-size="10" fill="#DDD">M</text>
        
        <!-- Фары (квадратные, типичные для Гелендвагена) -->
        <rect x="20" y="70" width="10" height="10" rx="1" fill="#FFF" />
        <rect x="170" y="70" width="10" height="10" rx="1" fill="#FFF" />
        
        <!-- Боковые зеркала -->
        <rect x="20" y="65" width="10" height="8" rx="2" fill="${primaryColor}" />
        <rect x="170" y="65" width="10" height="8" rx="2" fill="${primaryColor}" />
        
        <!-- Дверные ручки -->
        <rect x="60" y="80" width="10" height="3" rx="1" fill="${accentColor}" />
        <rect x="110" y="80" width="10" height="3" rx="1" fill="${accentColor}" />
        
        <!-- Окна -->
        <rect x="35" y="30" width="40" height="25" rx="3" fill="#86C5DA" />
        <rect x="85" y="30" width="40" height="25" rx="3" fill="#86C5DA" />
        <rect x="130" y="30" width="40" height="25" rx="3" fill="#86C5DA" />
        
        <!-- Бампер и нижняя часть -->
        <rect x="15" y="110" width="170" height="15" rx="3" fill="#111" />
        
        <!-- Дополнительное освещение на крыше (как часто бывает у G-Wagon) -->
        <rect x="40" y="15" width="120" height="5" rx="2" fill="#222" />
        <circle cx="60" cy="18" r="3" fill="#FFD" />
        <circle cx="80" cy="18" r="3" fill="#FFD" />
        <circle cx="100" cy="18" r="3" fill="#FFD" />
        <circle cx="120" cy="18" r="3" fill="#FFD" />
        <circle cx="140" cy="18" r="3" fill="#FFD" />
        
        <!-- Номерной знак -->
        <rect x="80" y="115" width="40" height="10" rx="1" fill="#FFF" />
        <text x="85" y="123" font-family="Arial, sans-serif" font-size="7" fill="#111">VIP 777</text>
      </g>
    `;
  } else if (brand === 'Range Rover') {
    // Range Rover - плавные линии, элегантный внедорожник
    carShape = `
      <g transform="translate(55, 70) scale(0.7)">
        <!-- Кузов Range Rover -->
        <rect x="20" y="70" width="160" height="70" rx="10" fill="${primaryColor}" />
        <path d="M20,70 C20,60 30,20 50,20 L150,20 C170,20 180,60 180,70 Z" fill="${primaryColor}" />
        
        <!-- Колеса -->
        <circle cx="60" cy="140" r="25" fill="#222" />
        <circle cx="60" cy="140" r="15" fill="#444" />
        <circle cx="140" cy="140" r="25" fill="#222" />
        <circle cx="140" cy="140" r="15" fill="#444" />
        
        <!-- Решетка радиатора (Range Rover) -->
        <rect x="35" y="80" width="35" height="15" rx="2" fill="#111" />
        <text x="40" y="92" font-family="Arial, sans-serif" font-size="7" fill="#DDD">RANGE</text>
        
        <!-- Фары (характерные для Range Rover) -->
        <rect x="25" y="75" width="15" height="10" rx="2" fill="#FFF" />
        <rect x="160" y="75" width="15" height="10" rx="2" fill="#FFF" />
        
        <!-- Окна -->
        <path d="M45,30 L155,30 C160,30 165,35 165,40 L165,70 L35,70 L35,40 C35,35 40,30 45,30 Z" fill="#86C5DA" />
        <line x1="100" y1="30" x2="100" y2="70" stroke="#555" stroke-width="1" />
        
        <!-- Тонировка задних стекол -->
        <path d="M100,30 L155,30 C160,30 165,35 165,40 L165,70 L100,70 Z" fill="#86C5DA" opacity="0.7" />
        
        <!-- Крыша и панорамное окно -->
        <rect x="40" y="25" width="120" height="10" rx="5" fill="#86C5DA" opacity="0.8" />
        
        <!-- Бампер -->
        <rect x="15" y="110" width="170" height="15" rx="5" fill="#222" />
        
        <!-- Номерной знак -->
        <rect x="80" y="115" width="40" height="10" rx="1" fill="#FFF" />
        <text x="85" y="123" font-family="Arial, sans-serif" font-size="7" fill="#111">LUX 999</text>
      </g>
    `;
  } else if (brand === 'Ferrari') {
    // Ferrari - низкий, спортивный, с плавными аэродинамическими линиями
    carShape = `
      <g transform="translate(45, 90) scale(0.8)">
        <!-- Кузов Ferrari -->
        <path d="M10,80 C30,90 50,100 100,100 C150,100 170,90 190,80 C180,70 170,60 150,60 L50,60 C30,60 20,70 10,80 Z" fill="${primaryColor}" />
        <path d="M50,60 L150,60 C150,40 120,30 100,30 C80,30 50,40 50,60 Z" fill="${primaryColor}" />
        
        <!-- Колеса -->
        <circle cx="50" cy="100" r="20" fill="#222" />
        <circle cx="50" cy="100" r="12" fill="#444" />
        <circle cx="150" cy="100" r="20" fill="#222" />
        <circle cx="150" cy="100" r="12" fill="#444" />
        
        <!-- Ветровое стекло и окна -->
        <path d="M65,45 L135,45 C135,40 120,35 100,35 C80,35 65,40 65,45 Z" fill="#86C5DA" />
        
        <!-- Фары и решетка -->
        <path d="M30,70 L45,65 L45,75 L30,80 Z" fill="#FFF" />
        <path d="M170,70 L155,65 L155,75 L170,80 Z" fill="#FFF" />
        <path d="M80,80 L120,80 C125,80 130,75 130,70 L120,70 L80,70 L70,70 C70,75 75,80 80,80 Z" fill="#222" />
        
        <!-- Логотип Ferrari -->
        <rect x="95" y="75" width="10" height="10" rx="5" fill="#FFDD00" />
        <text x="97" y="83" font-family="Arial, sans-serif" font-size="8" fill="#111">F</text>
        
        <!-- Спойлер -->
        <path d="M160,60 L175,55 L175,65 L160,70 Z" fill="${primaryColor}" />
        
        <!-- Выхлопные трубы -->
        <circle cx="165" cy="90" r="3" fill="#555" />
        <circle cx="175" cy="90" r="3" fill="#555" />
        
        <!-- Боковые воздухозаборники -->
        <path d="M60,70 L80,70 L80,80 L60,80 Z" fill="#222" />
        <path d="M120,70 L140,70 L140,80 L120,80 Z" fill="#222" />
      </g>
    `;
  } else if (brand === 'Lamborghini') {
    // Lamborghini - агрессивный, с острыми углами, низкий спорткар
    carShape = `
      <g transform="translate(45, 90) scale(0.8)">
        <!-- Кузов Lamborghini -->
        <path d="M10,80 L50,65 L150,65 L190,80 L160,90 L40,90 Z" fill="${primaryColor}" />
        <path d="M50,65 L150,65 L130,40 L70,40 Z" fill="${primaryColor}" />
        
        <!-- Колеса -->
        <circle cx="50" cy="90" r="20" fill="#222" />
        <circle cx="50" cy="90" r="12" fill="#444" />
        <circle cx="150" cy="90" r="20" fill="#222" />
        <circle cx="150" cy="90" r="12" fill="#444" />
        
        <!-- Ветровое стекло и окна -->
        <path d="M70,40 L130,40 L120,50 L80,50 Z" fill="#86C5DA" />
        
        <!-- Фары и решетка (угловатые, типичные для Lamborghini) -->
        <polygon points="30,75 50,65 50,80 30,85" fill="#FFF" />
        <polygon points="170,75 150,65 150,80 170,85" fill="#FFF" />
        <path d="M70,80 L130,80 L130,70 L70,70 Z" fill="#222" />
        
        <!-- Воздухозаборники на капоте -->
        <polygon points="90,55 110,55 105,65 95,65" fill="#222" />
        
        <!-- Логотип Lamborghini (бык) -->
        <circle cx="100" cy="75" r="5" fill="#FFDD00" />
        <text x="97" y="78" font-family="Arial, sans-serif" font-size="6" fill="#111">L</text>
        
        <!-- Спойлер -->
        <path d="M155,50 L170,55 L170,60 L155,65 Z" fill="${primaryColor}" />
        <path d="M45,50 L30,55 L30,60 L45,65 Z" fill="${primaryColor}" />
        
        <!-- Задний спойлер -->
        <rect x="135" y="35" width="20" height="5" rx="1" fill="${primaryColor}" />
        
        <!-- Выхлопные трубы -->
        <rect x="160" y="85" width="5" height="5" rx="1" fill="#555" />
        <rect x="170" y="85" width="5" height="5" rx="1" fill="#555" />
      </g>
    `;
  } else if (brand === 'Bentley') {
    // Bentley - элегантный, роскошный седан с характерной решеткой
    carShape = `
      <g transform="translate(45, 90) scale(0.8)">
        <!-- Кузов Bentley -->
        <path d="M20,80 C40,75 60,70 100,70 C140,70 160,75 180,80 C175,90 160,100 100,100 C40,100 25,90 20,80 Z" fill="${primaryColor}" />
        <path d="M40,70 L160,70 C160,50 140,40 100,40 C60,40 40,50 40,70 Z" fill="${primaryColor}" />
        
        <!-- Колеса -->
        <circle cx="50" cy="100" r="20" fill="#222" />
        <circle cx="50" cy="100" r="12" fill="#444" />
        <circle cx="150" cy="100" r="20" fill="#222" />
        <circle cx="150" cy="100" r="12" fill="#444" />
        
        <!-- Окна -->
        <path d="M50,50 L150,50 C145,45 130,45 100,45 C70,45 55,45 50,50 Z" fill="#86C5DA" />
        <line x1="100" y1="50" x2="100" y2="70" stroke="#555" stroke-width="1" />
        
        <!-- Характерная решетка Bentley -->
        <rect x="90" y="80" width="20" height="15" rx="2" fill="#CCC" stroke="#777" stroke-width="1" />
        <line x1="95" y1="81" x2="95" y2="94" stroke="#777" stroke-width="1" />
        <line x1="100" y1="81" x2="100" y2="94" stroke="#777" stroke-width="1" />
        <line x1="105" y1="81" x2="105" y2="94" stroke="#777" stroke-width="1" />
        
        <!-- Фары (круглые, типичные для Bentley) -->
        <circle cx="35" cy="80" r="8" fill="#FFF" />
        <circle cx="165" cy="80" r="8" fill="#FFF" />
        
        <!-- Логотип Bentley на капоте -->
        <circle cx="100" cy="55" r="5" fill="${accentColor}" />
        <text x="97" y="58" font-family="Arial, sans-serif" font-size="6" fill="#111">B</text>
      </g>
    `;
  } else if (brand === 'Rolls-Royce') {
    // Rolls-Royce - классический роскошный автомобиль с фирменной статуэткой
    carShape = `
      <g transform="translate(45, 90) scale(0.8)">
        <!-- Кузов Rolls-Royce -->
        <path d="M30,85 C50,80 70,75 100,75 C130,75 150,80 170,85 C165,95 150,100 100,100 C50,100 35,95 30,85 Z" fill="${primaryColor}" />
        <path d="M40,75 L160,75 C155,55 140,45 100,45 C60,45 45,55 40,75 Z" fill="${primaryColor}" />
        
        <!-- Колеса -->
        <circle cx="50" cy="100" r="20" fill="#222" />
        <circle cx="50" cy="100" r="12" fill="#444" />
        <circle cx="150" cy="100" r="20" fill="#222" />
        <circle cx="150" cy="100" r="12" fill="#444" />
        
        <!-- Окна -->
        <path d="M50,55 L150,55 C145,50 130,50 100,50 C70,50 55,50 50,55 Z" fill="#86C5DA" />
        <line x1="100" y1="55" x2="100" y2="75" stroke="#555" stroke-width="1" />
        
        <!-- Знаменитая решетка Rolls-Royce -->
        <rect x="85" y="75" width="30" height="20" rx="1" fill="#CCC" stroke="#777" stroke-width="1" />
        <line x1="90" y1="76" x2="90" y2="94" stroke="#777" stroke-width="1" />
        <line x1="95" y1="76" x2="95" y2="94" stroke="#777" stroke-width="1" />
        <line x1="100" y1="76" x2="100" y2="94" stroke="#777" stroke-width="1" />
        <line x1="105" y1="76" x2="105" y2="94" stroke="#777" stroke-width="1" />
        <line x1="110" y1="76" x2="110" y2="94" stroke="#777" stroke-width="1" />
        
        <!-- Spirit of Ecstasy (фирменная статуэтка) -->
        <path d="M100,45 L100,40 C100,38 103,35 100,32 C97,35 100,38 100,40 Z" fill="${accentColor}" />
        
        <!-- Фары (круглые) -->
        <circle cx="40" cy="80" r="8" fill="#FFF" />
        <circle cx="160" cy="80" r="8" fill="#FFF" />
        
        <!-- Двери с характерными петлями -->
        <line x1="70" y1="65" x2="70" y2="85" stroke="#555" stroke-width="1" />
        <line x1="130" y1="65" x2="130" y2="85" stroke="#555" stroke-width="1" />
      </g>
    `;
  } else {
    // Дефолтный спорткар премиум-класса
    carShape = `
      <g transform="translate(45, 90) scale(0.8)">
        <!-- Кузов премиум-спорткара -->
        <path d="M20,80 C40,75 60,70 100,70 C140,70 160,75 180,80 C175,90 160,100 100,100 C40,100 25,90 20,80 Z" fill="${primaryColor}" />
        <path d="M40,70 L160,70 C160,50 140,40 100,40 C60,40 40,50 40,70 Z" fill="${primaryColor}" />
        
        <!-- Колеса -->
        <circle cx="50" cy="100" r="20" fill="#222" />
        <circle cx="50" cy="100" r="12" fill="#444" />
        <circle cx="150" cy="100" r="20" fill="#222" />
        <circle cx="150" cy="100" r="12" fill="#444" />
        
        <!-- Окна -->
        <path d="M50,50 L150,50 C145,45 130,45 100,45 C70,45 55,45 50,50 Z" fill="#86C5DA" />
        
        <!-- Фары -->
        <path d="M35,75 L45,70 L45,80 L35,85 Z" fill="#FFF" />
        <path d="M165,75 L155,70 L155,80 L165,85 Z" fill="#FFF" />
        
        <!-- Решетка радиатора -->
        <rect x="85" y="80" width="30" height="10" rx="2" fill="#222" />
        
        <!-- Логотип -->
        <circle cx="100" cy="60" r="5" fill="${accentColor}" />
        <text x="97" y="63" font-family="Arial, sans-serif" font-size="6" fill="#111">P</text>
      </g>
    `;
  }
  
  // Добавляем эффекты и детали
  const reflections = `
    <!-- Реалистичные отражения -->
    <ellipse cx="100" cy="60" rx="60" ry="5" fill="white" opacity="0.2" />
    <ellipse cx="100" cy="80" rx="80" ry="3" fill="white" opacity="0.1" />
  `;
  
  // Добавляем эффект тени
  const shadows = `
    <!-- Тень под автомобилем -->
    <ellipse cx="100" cy="155" rx="90" ry="15" fill="black" opacity="0.3" />
  `;
  
  // Добавляем эффект блеска на кузове
  const shine = `
    <!-- Блик на кузове -->
    <ellipse cx="70" cy="50" rx="30" ry="10" fill="white" opacity="0.2" transform="rotate(-20, 70, 50)" />
    <ellipse cx="130" cy="50" rx="30" ry="10" fill="white" opacity="0.15" transform="rotate(20, 130, 50)" />
  `;
  
  // Финальное изображение автомобиля
  return `
    <g>
      ${shadows}
      ${carShape}
      ${reflections}
      ${shine}
    </g>
  `;
}

/**
 * Генерирует изображение элитных часов
 * Включает бренды: Ролекс, Патек Филипп, Одемар Пиге, и т.д.
 */
function generateLuxuryWatch(
  randomGenerator: () => number, 
  brand: string, 
  primaryColor: string, 
  secondaryColor: string, 
  accentColor: string
): string {
  // Выбираем стиль часов в зависимости от бренда
  let watchShape = '';
  
  if (brand === 'Rolex') {
    // Rolex - классический дизайн с характерным безелем и браслетом Oyster
    watchShape = `
      <g transform="translate(80, 80) scale(0.9)">
        <!-- Корпус часов Rolex -->
        <circle cx="100" cy="100" r="60" fill="${primaryColor}" stroke="${accentColor}" stroke-width="2" />
        
        <!-- Безель с характерными насечками -->
        <circle cx="100" cy="100" r="60" fill="none" stroke="${accentColor}" stroke-width="8" stroke-dasharray="3,3" />
        
        <!-- Циферблат -->
        <circle cx="100" cy="100" r="52" fill="#111" />
        
        <!-- Маркеры часов -->
        ${Array.from({length: 12}).map((_, i) => {
          const angle = i * 30 * Math.PI / 180;
          const x1 = 100 + 45 * Math.sin(angle);
          const y1 = 100 - 45 * Math.cos(angle);
          const x2 = 100 + 52 * Math.sin(angle);
          const y2 = 100 - 52 * Math.cos(angle);
          return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${accentColor}" stroke-width="2" />`;
        }).join('')}
        
        <!-- Окно даты -->
        <rect x="130" y="95" width="10" height="10" fill="#FFF" stroke="#777" stroke-width="0.5" />
        <text x="131" y="103" font-family="Arial, sans-serif" font-size="7" fill="#000">28</text>
        
        <!-- Стрелки -->
        <line x1="100" y1="100" x2="100" y2="65" stroke="${accentColor}" stroke-width="2" />
        <line x1="100" y1="100" x2="120" y2="110" stroke="${accentColor}" stroke-width="1.5" />
        <line x1="100" y1="100" x2="100" y2="130" stroke="red" stroke-width="1" />
        
        <!-- Логотип -->
        <text x="85" y="80" font-family="Arial, sans-serif" font-size="10" fill="${accentColor}">ROLEX</text>
        <text x="83" y="130" font-family="Arial, sans-serif" font-size="6" fill="#CCC">OYSTER</text>
        
        <!-- Браслет Oyster -->
        <path d="M40,100 C40,130 60,160 100,160 C140,160 160,130 160,100" fill="none" stroke="${primaryColor}" stroke-width="20" />
        <path d="M40,100 C40,130 60,160 100,160 C140,160 160,130 160,100" fill="none" stroke="#444" stroke-width="20" stroke-dasharray="2,2" opacity="0.3" />
      </g>
    `;
  } else if (brand === 'Patek Philippe') {
    // Patek Philippe - элегантный дизайн с тонким корпусом и кожаным ремешком
    watchShape = `
      <g transform="translate(80, 80) scale(0.9)">
        <!-- Корпус часов Patek Philippe -->
        <circle cx="100" cy="100" r="55" fill="${primaryColor}" stroke="${accentColor}" stroke-width="1" />
        
        <!-- Циферблат -->
        <circle cx="100" cy="100" r="50" fill="#EEE" />
        
        <!-- Маркеры часов (римские цифры) -->
        <text x="95" y="60" font-family="Times New Roman, serif" font-size="10" fill="#000">XII</text>
        <text x="140" y="105" font-family="Times New Roman, serif" font-size="10" fill="#000">III</text>
        <text x="97" y="145" font-family="Times New Roman, serif" font-size="10" fill="#000">VI</text>
        <text x="55" y="105" font-family="Times New Roman, serif" font-size="10" fill="#000">IX</text>
        
        <!-- Дополнительные циферблаты (усложнения) -->
        <circle cx="100" cy="75" r="10" fill="#FFF" stroke="#000" stroke-width="0.5" />
        <text x="97" y="78" font-family="Arial, sans-serif" font-size="6" fill="#000">31</text>
        <circle cx="100" cy="125" r="10" fill="#FFF" stroke="#000" stroke-width="0.5" />
        <text x="97" y="128" font-family="Arial, sans-serif" font-size="6" fill="#000">60</text>
        
        <!-- Стрелки -->
        <line x1="100" y1="100" x2="100" y2="70" stroke="#000" stroke-width="1.5" />
        <line x1="100" y1="100" x2="120" y2="110" stroke="#000" stroke-width="1" />
        <line x1="100" y1="100" x2="100" y2="130" stroke="#000" stroke-width="0.5" />
        
        <!-- Логотип -->
        <text x="75" y="85" font-family="Times New Roman, serif" font-size="8" fill="#000">PATEK</text>
        <text x="75" y="95" font-family="Times New Roman, serif" font-size="8" fill="#000">PHILIPPE</text>
        <text x="80" y="115" font-family="Times New Roman, serif" font-size="5" fill="#000">GENEVE</text>
        
        <!-- Ремешок из крокодиловой кожи -->
        <path d="M45,100 C45,130 60,160 100,160 C140,160 155,130 155,100" fill="${secondaryColor}" />
        <path d="M45,100 C45,130 60,160 100,160 C140,160 155,130 155,100" fill="none" stroke="#000" stroke-width="0.5" stroke-dasharray="10,1" />
        
        <!-- Застежка ремешка -->
        <rect x="90" y="155" width="20" height="5" rx="2" fill="${accentColor}" />
      </g>
    `;
  } else if (brand === 'Audemars Piguet') {
    // Audemars Piguet - характерный восьмиугольный корпус Royal Oak
    watchShape = `
      <g transform="translate(80, 80) scale(0.9)">
        <!-- Корпус Royal Oak (восьмиугольный) -->
        <polygon points="70,50 130,50 150,70 150,130 130,150 70,150 50,130 50,70" 
                 fill="${primaryColor}" stroke="${accentColor}" stroke-width="2" />
        
        <!-- Циферблат -->
        <circle cx="100" cy="100" r="45" fill="#333" />
        
        <!-- Характерный узор "Grand Tapisserie" -->
        ${Array.from({length: 6}).map((_, i) => 
          Array.from({length: 6}).map((_, j) => 
            `<rect x="${70 + i*10}" y="${70 + j*10}" width="10" height="10" fill="#333" stroke="#444" stroke-width="0.5" />`
          ).join('')
        ).join('')}
        
        <!-- Маркеры часов -->
        ${Array.from({length: 12}).map((_, i) => {
          const angle = i * 30 * Math.PI / 180;
          const x = 100 + 40 * Math.sin(angle);
          const y = 100 - 40 * Math.cos(angle);
          return `<rect x="${x-2}" y="${y-2}" width="4" height="4" fill="${accentColor}" />`;
        }).join('')}
        
        <!-- Стрелки -->
        <line x1="100" y1="100" x2="100" y2="70" stroke="${accentColor}" stroke-width="2" />
        <line x1="100" y1="100" x2="120" y2="110" stroke="${accentColor}" stroke-width="1.5" />
        <line x1="100" y1="100" x2="100" y2="130" stroke="${accentColor}" stroke-width="1" />
        
        <!-- Логотип -->
        <text x="75" y="80" font-family="Arial, sans-serif" font-size="6" fill="${accentColor}">AUDEMARS</text>
        <text x="80" y="88" font-family="Arial, sans-serif" font-size="6" fill="${accentColor}">PIGUET</text>
        <text x="70" y="130" font-family="Arial, sans-serif" font-size="5" fill="#CCC">ROYAL OAK</text>
        
        <!-- Металлический браслет Royal Oak -->
        <path d="M55,100 C55,130 70,160 100,160 C130,160 145,130 145,100" fill="${primaryColor}" />
        <path d="M55,100 C55,130 70,160 100,160 C130,160 145,130 145,100" fill="none" stroke="${accentColor}" stroke-width="1" stroke-dasharray="5,2" />
        
        <!-- Винты по углам безеля (характерная особенность Royal Oak) -->
        <circle cx="70" cy="70" r="3" fill="#777" />
        <circle cx="130" cy="70" r="3" fill="#777" />
        <circle cx="70" cy="130" r="3" fill="#777" />
        <circle cx="130" cy="130" r="3" fill="#777" />
      </g>
    `;
  } else if (brand === 'Richard Mille') {
    // Richard Mille - современный скелетонизированный дизайн в форме бочонка
    watchShape = `
      <g transform="translate(80, 80) scale(0.9)">
        <!-- Корпус Richard Mille (форма бочонка) -->
        <path d="M60,60 C50,80 50,120 60,140 C80,155 120,155 140,140 C150,120 150,80 140,60 C120,45 80,45 60,60 Z" 
              fill="${primaryColor}" stroke="${accentColor}" stroke-width="3" />
        
        <!-- Скелетонизированный циферблат -->
        <path d="M70,70 C65,85 65,115 70,130 C85,140 115,140 130,130 C135,115 135,85 130,70 C115,60 85,60 70,70 Z" 
              fill="#222" stroke="#333" stroke-width="0.5" />
        
        <!-- Механизм (видимый через скелетонизацию) -->
        <circle cx="100" cy="100" r="25" fill="none" stroke="#777" stroke-width="0.5" />
        <circle cx="100" cy="100" r="20" fill="none" stroke="#777" stroke-width="0.5" />
        <circle cx="100" cy="100" r="15" fill="none" stroke="#777" stroke-width="0.5" />
        <circle cx="80" cy="95" r="7" fill="none" stroke="#777" stroke-width="1" />
        <circle cx="120" cy="105" r="7" fill="none" stroke="#777" stroke-width="1" />
        
        <!-- Характерные винты по периметру -->
        ${Array.from({length: 12}).map((_, i) => {
          const angle = i * 30 * Math.PI / 180;
          const x = 100 + 45 * Math.sin(angle);
          const y = 100 - 45 * Math.cos(angle);
          return `<circle cx="${x}" cy="${y}" r="3" fill="#777" />`;
        }).join('')}
        
        <!-- Стрелки скелетонизированные -->
        <path d="M100,100 L100,70 L103,70 L103,100 Z" fill="${accentColor}" />
        <path d="M100,100 L125,110 L123,113 L100,103 Z" fill="${accentColor}" />
        <path d="M100,100 L100,130 L101,130 L101,100 Z" fill="red" />
        
        <!-- Логотип -->
        <text x="83" y="85" font-family="Arial, sans-serif" font-weight="bold" font-size="5" fill="${accentColor}">RICHARD</text>
        <text x="88" y="92" font-family="Arial, sans-serif" font-weight="bold" font-size="5" fill="${accentColor}">MILLE</text>
        
        <!-- Ремешок с перфорацией -->
        <path d="M65,70 C60,80 50,100 50,100 C50,100 60,120 65,130" fill="none" stroke="${secondaryColor}" stroke-width="10" />
        <path d="M135,70 C140,80 150,100 150,100 C150,100 140,120 135,130" fill="none" stroke="${secondaryColor}" stroke-width="10" />
        
        <!-- Перфорация ремешка -->
        <circle cx="50" cy="85" r="2" fill="#222" />
        <circle cx="50" cy="95" r="2" fill="#222" />
        <circle cx="50" cy="105" r="2" fill="#222" />
        <circle cx="50" cy="115" r="2" fill="#222" />
        <circle cx="150" cy="85" r="2" fill="#222" />
        <circle cx="150" cy="95" r="2" fill="#222" />
        <circle cx="150" cy="105" r="2" fill="#222" />
        <circle cx="150" cy="115" r="2" fill="#222" />
      </g>
    `;
  } else if (brand === 'Jacob & Co.') {
    // Jacob & Co. - экстравагантный дизайн с множеством бриллиантов
    watchShape = `
      <g transform="translate(80, 80) scale(0.9)">
        <!-- Корпус Jacob & Co. (круглый с бриллиантами) -->
        <circle cx="100" cy="100" r="55" fill="${primaryColor}" stroke="${accentColor}" stroke-width="2" />
        
        <!-- Безель с бриллиантами -->
        ${Array.from({length: 36}).map((_, i) => {
          const angle = i * 10 * Math.PI / 180;
          const x = 100 + 55 * Math.sin(angle);
          const y = 100 - 55 * Math.cos(angle);
          return `<circle cx="${x}" cy="${y}" r="2" fill="white" stroke="${accentColor}" stroke-width="0.5" />`;
        }).join('')}
        
        <!-- Циферблат -->
        <circle cx="100" cy="100" r="48" fill="#111" />
        
        <!-- Бриллианты вместо часовых маркеров -->
        ${Array.from({length: 12}).map((_, i) => {
          const angle = i * 30 * Math.PI / 180;
          const x = 100 + 40 * Math.sin(angle);
          const y = 100 - 40 * Math.cos(angle);
          return `
            <polygon points="${x},${y-3} ${x+2},${y} ${x},${y+3} ${x-2},${y}" 
                     fill="white" stroke="${accentColor}" stroke-width="0.2" />
          `;
        }).join('')}
        
        <!-- Дополнительные циферблаты и украшения -->
        <circle cx="100" cy="75" r="10" fill="#222" stroke="${accentColor}" stroke-width="0.5" />
        <circle cx="75" cy="100" r="10" fill="#222" stroke="${accentColor}" stroke-width="0.5" />
        <circle cx="125" cy="100" r="10" fill="#222" stroke="${accentColor}" stroke-width="0.5" />
        <circle cx="100" cy="125" r="10" fill="#222" stroke="${accentColor}" stroke-width="0.5" />
        
        <!-- Стрелки с бриллиантами -->
        <path d="M100,100 L100,65 L102,65 L102,100 Z" fill="white" />
        <circle cx="101" cy="70" r="2" fill="white" />
        <path d="M100,100 L130,100 L130,102 L100,102 Z" fill="white" />
        <circle cx="125" cy="101" r="2" fill="white" />
        
        <!-- Логотип -->
        <text x="80" y="90" font-family="Arial, sans-serif" font-weight="bold" font-size="6" fill="${accentColor}">JACOB</text>
        <text x="82" y="98" font-family="Arial, sans-serif" font-weight="bold" font-size="6" fill="${accentColor}">&amp; CO.</text>
        
        <!-- Ремешок из кожи аллигатора -->
        <path d="M45,100 C45,130 60,160 100,160 C140,160 155,130 155,100" fill="${secondaryColor}" />
        <path d="M45,100 C45,130 60,160 100,160 C140,160 155,130 155,100" fill="none" stroke="#000" stroke-width="0.5" stroke-dasharray="8,2" />
        
        <!-- Застежка с бриллиантами -->
        <rect x="90" y="155" width="20" height="5" rx="2" fill="${accentColor}" />
        ${Array.from({length: 5}).map((_, i) => 
          `<circle cx="${93 + i*4}" cy="157.5" r="1" fill="white" />`
        ).join('')}
      </g>
    `;
  } else {
    // Дефолтные роскошные часы
    watchShape = `
      <g transform="translate(80, 80) scale(0.9)">
        <!-- Корпус часов -->
        <circle cx="100" cy="100" r="55" fill="${primaryColor}" stroke="${accentColor}" stroke-width="2" />
        
        <!-- Циферблат -->
        <circle cx="100" cy="100" r="50" fill="#111" />
        
        <!-- Маркеры часов -->
        ${Array.from({length: 12}).map((_, i) => {
          const angle = i * 30 * Math.PI / 180;
          const x1 = 100 + 40 * Math.sin(angle);
          const y1 = 100 - 40 * Math.cos(angle);
          const x2 = 100 + 48 * Math.sin(angle);
          const y2 = 100 - 48 * Math.cos(angle);
          return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${accentColor}" stroke-width="2" />`;
        }).join('')}
        
        <!-- Стрелки -->
        <line x1="100" y1="100" x2="100" y2="70" stroke="${accentColor}" stroke-width="2" />
        <line x1="100" y1="100" x2="120" y2="110" stroke="${accentColor}" stroke-width="1.5" />
        <line x1="100" y1="100" x2="100" y2="130" stroke="${accentColor}" stroke-width="1" />
        
        <!-- Логотип -->
        <text x="80" y="85" font-family="Arial, sans-serif" font-size="8" fill="${accentColor}">LUXURY</text>
        <text x="83" y="125" font-family="Arial, sans-serif" font-size="6" fill="#CCC">SWISS MADE</text>
        
        <!-- Ремешок -->
        <path d="M45,100 C45,130 60,160 100,160 C140,160 155,130 155,100" fill="${secondaryColor}" />
      </g>
    `;
  }
  
  // Добавляем эффекты блеска и отражения
  const reflections = `
    <!-- Блики на стекле -->
    <ellipse cx="80" cy="80" rx="20" ry="10" fill="white" opacity="0.2" transform="rotate(-30, 80, 80)" />
    <ellipse cx="120" cy="80" rx="10" ry="5" fill="white" opacity="0.15" transform="rotate(30, 120, 80)" />
  `;
  
  // Финальное изображение часов
  return `
    <g>
      ${watchShape}
      ${reflections}
    </g>
  `;
}

/**
 * Генерирует изображение бриллианта
 */
function generateDiamond(
  randomGenerator: () => number, 
  primaryColor: string, 
  secondaryColor: string, 
  accentColor: string
): string {
  // Выбираем случайный оттенок бриллианта 
  const diamondColors = ['white', '#B9F2FF', '#FFFAB9', '#FFCAB9', '#E0B9FF'];
  const diamondColor = diamondColors[Math.floor(randomGenerator() * diamondColors.length)];
  
  // Создаем огранку бриллианта
  const diamondShape = `
    <g transform="translate(80, 80) scale(0.9)">
      <!-- Основная форма бриллианта (круглая огранка) -->
      <polygon points="100,50 70,80 60,120 100,150 140,120 130,80" 
               fill="${diamondColor}" stroke="#FFF" stroke-width="0.5" opacity="0.8" />
      
      <!-- Внутренние грани -->
      <line x1="100" y1="50" x2="100" y2="150" stroke="white" stroke-width="0.3" opacity="0.5" />
      <line x1="70" y1="80" x2="140" y2="120" stroke="white" stroke-width="0.3" opacity="0.5" />
      <line x1="60" y1="120" x2="130" y2="80" stroke="white" stroke-width="0.3" opacity="0.5" />
      <line x1="100" y1="50" x2="60" y2="120" stroke="white" stroke-width="0.3" opacity="0.5" />
      <line x1="100" y1="50" x2="140" y2="120" stroke="white" stroke-width="0.3" opacity="0.5" />
      <line x1="70" y1="80" x2="100" y2="150" stroke="white" stroke-width="0.3" opacity="0.5" />
      <line x1="130" y1="80" x2="100" y2="150" stroke="white" stroke-width="0.3" opacity="0.5" />
      
      <!-- Эффект игры света внутри бриллианта -->
      <polygon points="90,60 100,100 110,60" fill="white" opacity="0.7" />
      <polygon points="90,140 100,100 110,140" fill="white" opacity="0.7" />
      <polygon points="80,90 100,100 80,110" fill="white" opacity="0.7" />
      <polygon points="120,90 100,100 120,110" fill="white" opacity="0.7" />
      
      <!-- Блики и отражения -->
      <circle cx="90" cy="70" r="5" fill="white" opacity="0.8" />
      <circle cx="110" cy="130" r="4" fill="white" opacity="0.6" />
      
      <!-- Подставка или оправа -->
      <rect x="85" y="150" width="30" height="10" rx="2" fill="${accentColor}" />
    </g>
  `;
  
  // Эффекты свечения для бриллианта
  const glowEffects = `
    <!-- Эффект свечения вокруг бриллианта -->
    <circle cx="128" cy="128" r="80" fill="url(#diamondGlow)" opacity="0.5" />
    
    <!-- Радиальный градиент для свечения -->
    <radialGradient id="diamondGlow" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
      <stop offset="0%" stop-color="white" stop-opacity="0.5" />
      <stop offset="100%" stop-color="white" stop-opacity="0" />
    </radialGradient>
  `;
  
  // Добавляем маленькие бриллианты вокруг основного
  const smallDiamonds = Array.from({length: 8}).map((_, i) => {
    const angle = i * 45 * Math.PI / 180;
    const x = 128 + 100 * Math.sin(angle);
    const y = 128 - 100 * Math.cos(angle);
    const size = 10 + randomGenerator() * 20;
    return `
      <polygon points="${x},${y-size/2} ${x-size/2},${y} ${x},${y+size/2} ${x+size/2},${y}" 
               fill="${diamondColor}" stroke="white" stroke-width="0.3" opacity="0.6" />
    `;
  }).join('');
  
  // Финальное изображение бриллианта
  return `
    <g>
      ${glowEffects}
      ${smallDiamonds}
      ${diamondShape}
    </g>
  `;
}

/**
 * Генерирует изображение стопки денег
 */
function generateMoneyStack(
  randomGenerator: () => number, 
  primaryColor: string, 
  secondaryColor: string, 
  accentColor: string
): string {
  // Выбираем валюту: доллары, евро или фунты
  const currencies = ['$', '€', '£'];
  const currencySymbol = currencies[Math.floor(randomGenerator() * currencies.length)];
  
  // Создаем стопку купюр
  const moneyStack = `
    <g transform="translate(80, 80) scale(0.9)">
      <!-- Основная стопка купюр -->
      ${Array.from({length: 12}).map((_, i) => {
        const offsetX = (randomGenerator() - 0.5) * 10;
        const offsetY = -i * 3;
        return `
          <rect x="${70 + offsetX}" y="${120 + offsetY}" width="60" height="30" rx="2" 
                fill="#4CAF50" stroke="#388E3C" stroke-width="0.5" />
          <circle cx="${80 + offsetX}" cy="${135 + offsetY}" r="10" fill="#E8F5E9" stroke="#388E3C" stroke-width="0.3" />
          <text x="${77 + offsetX}" y="${138 + offsetY}" font-family="Arial, sans-serif" font-size="8" fill="#1B5E20">${currencySymbol}</text>
          <text x="${95 + offsetX}" y="${138 + offsetY}" font-family="Arial, sans-serif" font-size="6" fill="#E8F5E9">100</text>
        `;
      }).join('')}
      
      <!-- Пачка денег перевязанная резинкой -->
      <rect x="60" y="80" width="80" height="45" rx="2" fill="#4CAF50" stroke="#388E3C" stroke-width="1" />
      <rect x="65" y="85" width="70" height="35" rx="1" fill="#388E3C" opacity="0.3" />
      <path d="M60,100 H140" stroke="#D32F2F" stroke-width="3" />
      <circle cx="80" cy="100" r="12" fill="#E8F5E9" stroke="#388E3C" stroke-width="0.5" />
      <text x="77" y="103" font-family="Arial, sans-serif" font-size="10" fill="#1B5E20">${currencySymbol}</text>
      <text x="100" y="105" font-family="Arial, sans-serif" font-size="8" fill="#E8F5E9">500</text>
      
      <!-- Золотые монеты рядом со стопкой -->
      ${Array.from({length: 8}).map((_, i) => {
        const x = 45 + (randomGenerator() * 20);
        const y = 130 - (i * 2);
        return `
          <circle cx="${x}" cy="${y}" r="8" fill="#FFC107" stroke="#FFA000" stroke-width="0.5" />
          <circle cx="${x}" cy="${y}" r="5" fill="#FFA000" opacity="0.5" />
          <text x="${x-2}" y="${y+2}" font-family="Arial, sans-serif" font-size="6" fill="#5D4037">${currencySymbol}</text>
        `;
      }).join('')}
      
      <!-- Дополнительные монеты с другой стороны -->
      ${Array.from({length: 6}).map((_, i) => {
        const x = 150 + (randomGenerator() * 15);
        const y = 135 - (i * 3);
        return `
          <circle cx="${x}" cy="${y}" r="10" fill="#FFC107" stroke="#FFA000" stroke-width="0.5" />
          <circle cx="${x}" cy="${y}" r="6" fill="#FFA000" opacity="0.5" />
          <text x="${x-3}" y="${y+3}" font-family="Arial, sans-serif" font-size="8" fill="#5D4037">${currencySymbol}</text>
        `;
      }).join('')}
      
      <!-- Разбросанные купюры -->
      ${Array.from({length: 3}).map((_, i) => {
        const rotAngle = (randomGenerator() - 0.5) * 60;
        const x = 150 + (randomGenerator() - 0.5) * 30;
        const y = 80 + (randomGenerator() - 0.5) * 20;
        return `
          <g transform="translate(${x}, ${y}) rotate(${rotAngle})">
            <rect x="-30" y="-15" width="60" height="30" rx="2" 
                  fill="#4CAF50" stroke="#388E3C" stroke-width="0.5" />
            <circle cx="-20" cy="0" r="10" fill="#E8F5E9" stroke="#388E3C" stroke-width="0.3" />
            <text x="-23" y="3" font-family="Arial, sans-serif" font-size="8" fill="#1B5E20">${currencySymbol}</text>
            <text x="-5" y="3" font-family="Arial, sans-serif" font-size="6" fill="#E8F5E9">100</text>
          </g>
        `;
      }).join('')}
    </g>
  `;
  
  // Добавляем эффекты
  const effects = `
    <!-- Эффект богатства -->
    <filter id="gold-shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="0" stdDeviation="5" flood-color="${accentColor}" flood-opacity="0.5" />
    </filter>
  `;
  
  // Финальное изображение денег
  return `
    <g filter="url(#gold-shadow)">
      ${effects}
      ${moneyStack}
    </g>
  `;
}

/**
 * Генерирует изображение роскошного особняка
 */
function generateMansion(
  randomGenerator: () => number, 
  primaryColor: string, 
  secondaryColor: string, 
  accentColor: string
): string {
  // Выбираем случайный стиль особняка: современный или классический
  const mansionStyle = randomGenerator() > 0.5 ? 'modern' : 'classic';
  
  // Создаем особняк в зависимости от стиля
  let mansionShape = '';
  
  if (mansionStyle === 'modern') {
    // Современный особняк с большими окнами и минималистичным дизайном
    mansionShape = `
      <g transform="translate(60, 60) scale(0.75)">
        <!-- Основная структура современного особняка -->
        <rect x="40" y="100" width="180" height="100" rx="0" fill="#E0E0E0" />
        <rect x="20" y="150" width="80" height="50" rx="0" fill="#EEEEEE" />
        <rect x="160" y="120" width="80" height="80" rx="0" fill="#E0E0E0" />
        
        <!-- Большие панорамные окна -->
        <rect x="50" y="120" width="100" height="60" rx="0" fill="#86C5DA" opacity="0.7" />
        <path d="M50,120 v60 h100 v-60 Z" fill="none" stroke="#FAFAFA" stroke-width="2" stroke-dasharray="5,5" />
        <rect x="30" y="160" width="60" height="30" rx="0" fill="#86C5DA" opacity="0.7" />
        <rect x="170" y="140" width="60" height="40" rx="0" fill="#86C5DA" opacity="0.7" />
        
        <!-- Плоская крыша с террасой -->
        <rect x="40" y="90" width="180" height="10" rx="0" fill="#BDBDBD" />
        <rect x="160" y="110" width="80" height="10" rx="0" fill="#BDBDBD" />
        
        <!-- Бассейн бесконечности -->
        <rect x="120" y="170" width="80" height="30" rx="0" fill="#40C4FF" opacity="0.6" />
        <rect x="120" y="170" width="80" height="5" rx="0" fill="white" opacity="0.3" />
        
        <!-- Ландшафтный дизайн вокруг дома -->
        <rect x="10" y="200" width="240" height="20" rx="0" fill="#7CB342" />
        <path d="M10,200 C50,190 100,198 150,193 C200,190 250,200 250,200 v20 h-240 Z" fill="#7CB342" />
        
        <!-- Современная подъездная дорожка -->
        <path d="M100,220 v-30 h30 v30" fill="none" stroke="#BDBDBD" stroke-width="10" />
        
        <!-- Дорогие автомобили на подъездной дорожке -->
        <rect x="105" y="195" width="20" height="10" rx="2" fill="#F44336" />
        <rect x="107" y="197" width="14" height="6" rx="1" fill="#FFCDD2" opacity="0.5" />
        
        <!-- Современные элементы декора -->
        <rect x="70" y="190" width="5" height="10" rx="0" fill="#BDBDBD" />
        <circle cx="72.5" cy="190" r="3" fill="#FFEB3B" />
        <rect x="180" y="190" width="5" height="10" rx="0" fill="#BDBDBD" />
        <circle cx="182.5" cy="190" r="3" fill="#FFEB3B" />
      </g>
    `;
  } else {
    // Классический особняк с колоннами и традиционным дизайном
    mansionShape = `
      <g transform="translate(60, 60) scale(0.75)">
        <!-- Основная структура классического особняка -->
        <rect x="30" y="120" width="200" height="80" rx="0" fill="#FFECB3" />
        <path d="M20,120 h220 v-30 h-220 Z" fill="#FFE082" />
        
        <!-- Треугольный фронтон -->
        <polygon points="130,60 30,120 230,120" fill="#FFE082" stroke="#FFC107" stroke-width="1" />
        
        <!-- Колонны в классическом стиле -->
        ${Array.from({length: 5}).map((_, i) => {
          const x = 60 + i * 35;
          return `
            <rect x="${x-5}" y="120" width="10" height="80" rx="2" fill="#FAFAFA" />
            <rect x="${x-7}" y="115" width="14" height="5" rx="1" fill="#F5F5F5" />
            <rect x="${x-7}" y="195" width="14" height="5" rx="1" fill="#F5F5F5" />
          `;
        }).join('')}
        
        <!-- Окна в классическом стиле -->
        ${Array.from({length: 7}).map((_, i) => {
          const x = 45 + i * 30;
          return `
            <rect x="${x}" y="135" width="20" height="30" rx="3" fill="#B3E5FC" stroke="#FAFAFA" stroke-width="2" />
            <path d="M${x},135 v30 h20 v-30 Z" fill="none" stroke="#FAFAFA" stroke-width="1" stroke-dasharray="2,2" />
            <path d="M${x+10},135 v30" fill="none" stroke="#FAFAFA" stroke-width="1" />
          `;
        }).join('')}
        
        <!-- Роскошная входная дверь -->
        <rect x="120" y="160" width="20" height="40" rx="3" fill="#A1887F" stroke="#8D6E63" stroke-width="2" />
        <circle cx="125" cy="180" r="2" fill="#FFC107" />
        
        <!-- Статуи и фонтаны во дворе -->
        <circle cx="90" cy="220" r="15" fill="#B3E5FC" opacity="0.6" />
        <path d="M90,205 v5" fill="none" stroke="#FAFAFA" stroke-width="2" />
        <path d="M90,205 c-5,3 -10,10 -15,15" fill="none" stroke="#FAFAFA" stroke-width="1" opacity="0.7" />
        <path d="M90,205 c5,3 10,10 15,15" fill="none" stroke="#FAFAFA" stroke-width="1" opacity="0.7" />
        
        <circle cx="170" cy="220" r="15" fill="#B3E5FC" opacity="0.6" />
        <path d="M170,205 v5" fill="none" stroke="#FAFAFA" stroke-width="2" />
        <path d="M170,205 c-5,3 -10,10 -15,15" fill="none" stroke="#FAFAFA" stroke-width="1" opacity="0.7" />
        <path d="M170,205 c5,3 10,10 15,15" fill="none" stroke="#FAFAFA" stroke-width="1" opacity="0.7" />
        
        <!-- Круговая подъездная дорожка -->
        <path d="M130,240 a50,30 0 1,0 0,-60 a50,30 0 1,0 0,60 Z" fill="none" stroke="#BDBDBD" stroke-width="10" />
        
        <!-- Ландшафтный дизайн вокруг особняка -->
        <rect x="10" y="220" width="240" height="20" rx="0" fill="#7CB342" />
      </g>
    `;
  }
  
  // Добавляем эффекты для создания атмосферы роскоши
  const luxuryEffects = `
    <!-- Эффект солнечного света -->
    <radialGradient id="sunlight" cx="70%" cy="30%" r="100%" fx="70%" fy="30%">
      <stop offset="0%" stop-color="white" stop-opacity="0.7" />
      <stop offset="100%" stop-color="white" stop-opacity="0" />
    </radialGradient>
    <circle cx="180" cy="80" r="150" fill="url(#sunlight)" opacity="0.3" />
    
    <!-- Эффект легкого тумана для создания атмосферы -->
    <rect x="0" y="200" width="256" height="56" fill="white" opacity="0.1" />
  `;
  
  // Финальное изображение особняка
  return `
    <g>
      ${luxuryEffects}
      ${mansionShape}
    </g>
  `;
}

/**
 * Используйте эту функцию вместо стандартной generateNFTImage для создания
 * реалистичных NFT вместо пиксельных
 */
// Экспортируем основную функцию генерации
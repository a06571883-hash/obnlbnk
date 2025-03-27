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
export async function generateNFTImage(rarity: NFTRarity): Promise<string> {
  // Создаем директорию для NFT, если она еще не существует
  const nftDir = path.join(PUBLIC_DIR, 'assets', 'nft');
  if (!fs.existsSync(nftDir)) {
    fs.mkdirSync(nftDir, { recursive: true });
  }
  
  // Выбираем тип роскошного предмета в зависимости от редкости
  const itemType = selectLuxuryType(rarity);
  
  // Создаем уникальное имя файла с использованием хеша для уникальности
  const uniqueId = crypto.randomBytes(8).toString('hex');
  const fileName = `${rarity}_${itemType}_${Date.now()}_${uniqueId}.svg`;
  const filePath = path.join(nftDir, fileName);
  
  // Получаем стили на основе редкости и типа предмета
  const styles = getRarityStyles(rarity, itemType);
  
  // Генерируем SVG-контент в реалистичном стиле с премиальными объектами
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
      if (randomValue < 0.85) return 'watch';
      if (randomValue < 0.95) return 'diamond';
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
  glowColor: string;
  glowSize: number;
  complexity: number;
  itemType: LuxuryItemType;
}): string {
  const { backgroundColor, primaryColor, secondaryColor, accentColor, glowColor, glowSize, itemType } = styles;
  
  // Создаем уникальный сид для каждого изображения
  const seed = crypto.randomBytes(4).toString('hex');
  const seedNumber = parseInt(seed, 16);
  const randomGenerator = createRandomGenerator(seedNumber);
  
  // Градиент фона в зависимости от типа предмета и случайных вариаций
  const backgroundGradient = `
    <linearGradient id="backgroundGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${backgroundColor}" />
      <stop offset="50%" stop-color="${primaryColor}" stop-opacity="0.3" />
      <stop offset="100%" stop-color="${backgroundColor}" />
    </linearGradient>
  `;
  
  // Эффект сияния вокруг предмета
  const glowEffect = `
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="${glowSize}" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  `;
  
  // Эффект металлического блеска
  const metalEffect = `
    <filter id="metal" x="-10%" y="-10%" width="120%" height="120%">
      <feSpecularLighting result="specOut" specularExponent="20" lighting-color="#ffffff">
        <fePointLight x="50" y="50" z="200" />
      </feSpecularLighting>
      <feComposite in="SourceGraphic" in2="specOut" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" />
    </filter>
  `;
  
  // Эффект переливания (шиммер)
  const shimmerEffect = `
    <filter id="shimmer" x="-20%" y="-20%" width="140%" height="140%">
      <feTurbulence type="fractalNoise" baseFrequency="0.01" numOctaves="2" seed="${seedNumber % 100}">
        <animate attributeName="baseFrequency" from="0.01" to="0.02" dur="30s" repeatCount="indefinite" />
      </feTurbulence>
      <feDisplacementMap in="SourceGraphic" scale="5" />
      <feGaussianBlur stdDeviation="1" />
      <feComposite in="SourceGraphic" operator="over" />
    </filter>
  `;
  
  // Эффект блика для бриллиантов
  const diamondEffect = `
    <filter id="diamond" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="4" result="blur" />
      <feSpecularLighting in="blur" surfaceScale="5" specularConstant="1" specularExponent="20" result="specOut">
        <fePointLight x="50" y="50" z="90" />
      </feSpecularLighting>
      <feComposite in="specOut" in2="SourceAlpha" operator="in" result="specOut" />
      <feComposite in="SourceGraphic" in2="specOut" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" />
    </filter>
  `;
  
  // Генерируем контент в зависимости от типа предмета
  let mainContent = '';
  
  switch (itemType) {
    case 'car':
      mainContent = generateLuxuryCar(randomGenerator, primaryColor, secondaryColor, accentColor);
      break;
    case 'watch':
      mainContent = generateLuxuryWatch(randomGenerator, primaryColor, secondaryColor, accentColor);
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
  
  // Создаем финальный SVG с реалистичным роскошным предметом
  return `
  <svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
    <defs>
      ${backgroundGradient}
      ${glowEffect}
      ${metalEffect}
      ${shimmerEffect}
      ${diamondEffect}
    </defs>
    
    <!-- Фон с градиентом -->
    <rect width="256" height="256" fill="url(#backgroundGradient)" />
    
    <!-- Декоративные элементы для создания глубины -->
    <circle cx="${50 + randomGenerator() * 150}" cy="${50 + randomGenerator() * 150}" r="${10 + randomGenerator() * 30}" 
            fill="${accentColor}" opacity="${0.1 + randomGenerator() * 0.2}" filter="url(#shimmer)" />
    <circle cx="${50 + randomGenerator() * 150}" cy="${50 + randomGenerator() * 150}" r="${5 + randomGenerator() * 15}" 
            fill="${glowColor}" opacity="${0.1 + randomGenerator() * 0.2}" filter="url(#glow)" />
    
    <!-- Основное содержимое - роскошный предмет -->
    <g transform="translate(0, 0)">
      ${mainContent}
    </g>
    
    <!-- Добавляем декоративную рамку с эффектом шиммера -->
    <rect x="8" y="8" width="240" height="240" fill="none" stroke="${glowColor}" stroke-width="1" 
          opacity="0.5" stroke-dasharray="2,2" filter="url(#shimmer)" />
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
  glowColor: string;
  glowSize: number;
  complexity: number;
  itemType: LuxuryItemType;
} {
  // Базовые стили в зависимости от редкости
  let styles = {
    backgroundColor: '#0D1117',
    primaryColor: '#FFFFFF',
    secondaryColor: '#C9D1D9',
    accentColor: '#58A6FF',
    glowColor: '#58A6FF',
    glowSize: 5,
    complexity: 1,
    itemType
  };
  
  // Настраиваем стили в зависимости от редкости
  switch (rarity) {
    case 'common':
      styles.backgroundColor = '#0D1117';
      styles.primaryColor = '#C9D1D9';
      styles.secondaryColor = '#8B949E';
      styles.accentColor = '#79C0FF';
      styles.glowColor = '#79C0FF';
      styles.glowSize = 3;
      styles.complexity = 1;
      break;
    
    case 'uncommon':
      styles.backgroundColor = '#0D1117';
      styles.primaryColor = '#D2A8FF';
      styles.secondaryColor = '#A371F7';
      styles.accentColor = '#6E40C9';
      styles.glowColor = '#D2A8FF';
      styles.glowSize = 4;
      styles.complexity = 2;
      break;
    
    case 'rare':
      styles.backgroundColor = '#0E1624';
      styles.primaryColor = '#58A6FF';
      styles.secondaryColor = '#388BFD';
      styles.accentColor = '#1F6FEB';
      styles.glowColor = '#58A6FF';
      styles.glowSize = 5;
      styles.complexity = 3;
      break;
    
    case 'epic':
      styles.backgroundColor = '#24162D';
      styles.primaryColor = '#FA7970';
      styles.secondaryColor = '#F85149';
      styles.accentColor = '#DA3633';
      styles.glowColor = '#FA7970';
      styles.glowSize = 6;
      styles.complexity = 4;
      break;
    
    case 'legendary':
      styles.backgroundColor = '#261D03';
      styles.primaryColor = '#F0B429';
      styles.secondaryColor = '#E3A008';
      styles.accentColor = '#D97706';
      styles.glowColor = '#F0B429';
      styles.glowSize = 8;
      styles.complexity = 5;
      break;
  }
  
  // Дополнительные настройки в зависимости от типа предмета
  switch (itemType) {
    case 'car':
      // Для премиальных автомобилей используем более темные и насыщенные цвета
      styles.backgroundColor = rarity === 'legendary' ? '#1A0F00' : styles.backgroundColor;
      break;
    
    case 'watch':
      // Для элитных часов используем золотистые и темные цвета
      styles.backgroundColor = rarity === 'legendary' ? '#170D00' : styles.backgroundColor;
      if (rarity === 'legendary' || rarity === 'epic') {
        styles.primaryColor = '#F0B429';
      }
      break;
    
    case 'diamond':
      // Для бриллиантов используем голубоватые и светлые цвета
      styles.backgroundColor = rarity === 'legendary' ? '#0A192F' : styles.backgroundColor;
      styles.glowSize += 2; // Увеличиваем свечение для бриллиантов
      break;
    
    case 'money':
      // Для денег используем зеленоватые оттенки
      styles.backgroundColor = rarity === 'legendary' ? '#052e16' : styles.backgroundColor;
      if (rarity === 'legendary' || rarity === 'epic') {
        styles.accentColor = '#10b981';
      }
      break;
    
    case 'mansion':
      // Для особняков используем более элегантные цвета
      styles.backgroundColor = rarity === 'legendary' ? '#1F2937' : styles.backgroundColor;
      break;
  }
  
  return styles;
}

/**
 * Генерирует изображение роскошного автомобиля
 * Включает премиальные марки: Гелендваген, Рендж Ровер, Феррари, Ламборгини
 */
function generateLuxuryCar(
  randomGenerator: () => number,
  primaryColor: string,
  secondaryColor: string,
  accentColor: string
): string {
  // Выбираем тип автомобиля
  const carTypes = ['suv', 'sport', 'luxury', 'hyper'];
  const carType = carTypes[Math.floor(randomGenerator() * carTypes.length)];
  
  // Создаем базовую форму автомобиля в зависимости от типа
  let carShape = '';
  
  switch (carType) {
    case 'suv': // Гелендваген или Рендж Ровер
      carShape = `
        <!-- Гелендваген или Рендж Ровер в реалистичном стиле -->
        <g transform="translate(28, 80)">
          <!-- Корпус -->
          <path d="M10,60 L30,30 L170,30 L190,60 L190,100 L10,100 Z" fill="${primaryColor}" stroke="#000" stroke-width="1" />
          
          <!-- Крыша -->
          <path d="M40,30 L60,10 L140,10 L160,30" fill="none" stroke="#000" stroke-width="1" />
          <path d="M40,30 L60,10 L140,10 L160,30 L160,30 L40,30 Z" fill="${primaryColor}" stroke="#000" stroke-width="1" />
          
          <!-- Окна -->
          <path d="M45,30 L60,15 L140,15 L155,30" fill="none" stroke="#000" stroke-width="1" />
          <rect x="45" y="30" width="110" height="25" fill="${secondaryColor}" opacity="0.7" />
          
          <!-- Колеса -->
          <circle cx="50" cy="100" r="20" fill="#000" />
          <circle cx="50" cy="100" r="10" fill="#333" />
          <circle cx="150" cy="100" r="20" fill="#000" />
          <circle cx="150" cy="100" r="10" fill="#333" />
          
          <!-- Фары -->
          <rect x="15" y="60" width="20" height="10" fill="${accentColor}" filter="url(#glow)" />
          <rect x="165" y="60" width="20" height="10" fill="${accentColor}" filter="url(#glow)" />
          
          <!-- Решетка радиатора -->
          <rect x="80" y="70" width="40" height="15" fill="#111" />
          <line x1="85" y1="70" x2="85" y2="85" stroke="#222" stroke-width="2" />
          <line x1="95" y1="70" x2="95" y2="85" stroke="#222" stroke-width="2" />
          <line x1="105" y1="70" x2="105" y2="85" stroke="#222" stroke-width="2" />
          <line x1="115" y1="70" x2="115" y2="85" stroke="#222" stroke-width="2" />
        </g>
      `;
      break;
    
    case 'sport': // Спортивный автомобиль типа Феррари
      carShape = `
        <!-- Феррари в реалистичном стиле -->
        <g transform="translate(28, 100)">
          <!-- Корпус -->
          <path d="M10,70 L40,70 L60,40 L140,40 L180,70 L190,70 L190,85 L10,85 Z" fill="${primaryColor}" stroke="#000" stroke-width="1" />
          
          <!-- Купол -->
          <path d="M80,40 L100,20 L120,40" fill="none" stroke="#000" stroke-width="1" />
          <path d="M80,40 L100,20 L120,40 L80,40 Z" fill="${primaryColor}" stroke="#000" stroke-width="1" />
          
          <!-- Окно -->
          <path d="M85,40 L100,25 L115,40" fill="none" stroke="#000" stroke-width="1" />
          <path d="M85,40 L100,25 L115,40 L85,40 Z" fill="${secondaryColor}" opacity="0.7" />
          
          <!-- Колеса -->
          <circle cx="60" cy="85" r="15" fill="#000" />
          <circle cx="60" cy="85" r="8" fill="#333" />
          <circle cx="140" cy="85" r="15" fill="#000" />
          <circle cx="140" cy="85" r="8" fill="#333" />
          
          <!-- Фары -->
          <ellipse cx="35" cy="60" rx="15" ry="5" fill="${accentColor}" filter="url(#glow)" />
          <ellipse cx="165" cy="60" rx="15" ry="5" fill="${accentColor}" filter="url(#glow)" />
          
          <!-- Логотип -->
          <rect x="90" y="55" width="20" height="10" fill="#FFDD00" filter="url(#shimmer)" />
        </g>
      `;
      break;
    
    case 'luxury': // Роскошный седан
      carShape = `
        <!-- Роскошный седан в реалистичном стиле -->
        <g transform="translate(28, 90)">
          <!-- Корпус -->
          <path d="M20,70 L40,50 L160,50 L180,70 L190,80 L10,80 L20,70 Z" fill="${primaryColor}" stroke="#000" stroke-width="1" />
          
          <!-- Купол -->
          <path d="M60,50 L80,30 L120,30 L140,50" fill="none" stroke="#000" stroke-width="1" />
          <path d="M60,50 L80,30 L120,30 L140,50 L60,50 Z" fill="${primaryColor}" stroke="#000" stroke-width="1" />
          
          <!-- Окна -->
          <path d="M65,50 L80,35 L120,35 L135,50" fill="none" stroke="#000" stroke-width="1" />
          <path d="M65,50 L80,35 L120,35 L135,50 L65,50 Z" fill="${secondaryColor}" opacity="0.7" />
          
          <!-- Колеса -->
          <circle cx="50" cy="80" r="15" fill="#000" />
          <circle cx="50" cy="80" r="8" fill="#333" />
          <circle cx="150" cy="80" r="15" fill="#000" />
          <circle cx="150" cy="80" r="8" fill="#333" />
          
          <!-- Фары -->
          <rect x="20" y="60" width="15" height="5" fill="${accentColor}" filter="url(#glow)" />
          <rect x="165" y="60" width="15" height="5" fill="${accentColor}" filter="url(#glow)" />
          
          <!-- Решетка радиатора -->
          <rect x="80" y="65" width="40" height="10" fill="#111" />
        </g>
      `;
      break;
    
    case 'hyper': // Ламборгини
      carShape = `
        <!-- Ламборгини в реалистичном стиле -->
        <g transform="translate(28, 100)">
          <!-- Острый корпус -->
          <path d="M30,60 L60,40 L140,40 L170,60 L190,70 L10,70 L30,60 Z" fill="${primaryColor}" stroke="#000" stroke-width="1" />
          
          <!-- Низкий купол -->
          <path d="M70,40 L90,25 L110,25 L130,40" fill="none" stroke="#000" stroke-width="1" />
          <path d="M70,40 L90,25 L110,25 L130,40 L70,40 Z" fill="${primaryColor}" stroke="#000" stroke-width="1" />
          
          <!-- Окно -->
          <path d="M75,40 L90,30 L110,30 L125,40" fill="none" stroke="#000" stroke-width="1" />
          <path d="M75,40 L90,30 L110,30 L125,40 L75,40 Z" fill="${secondaryColor}" opacity="0.7" />
          
          <!-- Колеса -->
          <circle cx="45" cy="70" r="15" fill="#000" />
          <circle cx="45" cy="70" r="8" fill="#333" />
          <circle cx="155" cy="70" r="15" fill="#000" />
          <circle cx="155" cy="70" r="8" fill="#333" />
          
          <!-- Острые фары -->
          <polygon points="30,55 45,50 45,60 30,60" fill="${accentColor}" filter="url(#glow)" />
          <polygon points="170,55 155,50 155,60 170,60" fill="${accentColor}" filter="url(#glow)" />
          
          <!-- Агрессивный воздухозаборник -->
          <polygon points="80,55 120,55 110,65 90,65" fill="#000" />
          
          <!-- Спойлер -->
          <rect x="150" y="40" width="20" height="2" fill="${primaryColor}" stroke="#000" stroke-width="0.5" />
        </g>
      `;
      break;
  }
  
  // Добавляем эффекты блеска для создания реалистичного вида
  const reflections = `
    <!-- Блики и отражения для реалистичности -->
    <ellipse cx="${100 + randomGenerator() * 60}" cy="${30 + randomGenerator() * 40}" rx="${20 + randomGenerator() * 30}" ry="10" 
             fill="white" opacity="${0.1 + randomGenerator() * 0.15}" filter="url(#shimmer)" />
    <ellipse cx="${80 + randomGenerator() * 50}" cy="${80 + randomGenerator() * 30}" rx="${10 + randomGenerator() * 20}" ry="5" 
             fill="white" opacity="${0.05 + randomGenerator() * 0.1}" />
  `;
  
  // Создаем эффект доргои или фона
  const background = `
    <!-- Дорога или фон -->
    <rect x="0" y="180" width="256" height="76" fill="#333" />
    <line x1="20" y1="210" x2="80" y2="210" stroke="white" stroke-width="4" stroke-dasharray="10,10" />
    <line x1="120" y1="210" x2="180" y2="210" stroke="white" stroke-width="4" stroke-dasharray="10,10" />
    <line x1="220" y1="210" x2="240" y2="210" stroke="white" stroke-width="4" stroke-dasharray="10,10" />
  `;
  
  // Финальное изображение автомобиля
  return `
    <g>
      ${background}
      ${carShape}
      ${reflections}
    </g>
  `;
}

/**
 * Генерирует изображение элитных часов
 * Включает бренды: Ролекс, Патек Филипп, Одемар Пиге, и т.д.
 */
function generateLuxuryWatch(
  randomGenerator: () => number,
  primaryColor: string,
  secondaryColor: string,
  accentColor: string
): string {
  // Выбираем тип часов
  const watchTypes = ['round', 'square', 'oval', 'tonneau'];
  const watchType = watchTypes[Math.floor(randomGenerator() * watchTypes.length)];
  
  // Создаем циферблат и корпус в зависимости от типа
  let watchShape = '';
  
  switch (watchType) {
    case 'round': // Классические круглые часы (Ролекс)
      watchShape = `
        <!-- Ролекс - классические круглые часы -->
        <g transform="translate(80, 80)">
          <!-- Ремешок -->
          <path d="M-40,0 C-40,20 -30,50 -10,70 L10,70 C30,50 40,20 40,0 C40,-20 30,-50 10,-70 L-10,-70 C-30,-50 -40,-20 -40,0 Z" 
                fill="${primaryColor}" stroke="#000" stroke-width="1" />
          
          <!-- Корпус часов -->
          <circle cx="0" cy="0" r="40" fill="${accentColor}" stroke="#000" stroke-width="1" filter="url(#metal)" />
          
          <!-- Циферблат -->
          <circle cx="0" cy="0" r="35" fill="${secondaryColor}" stroke="#333" stroke-width="1" />
          
          <!-- Метки часов -->
          <line x1="0" y1="-30" x2="0" y2="-25" stroke="#000" stroke-width="2" />
          <line x1="15" y1="-26" x2="13" y2="-22" stroke="#000" stroke-width="2" />
          <line x1="26" y1="-15" x2="22" y2="-13" stroke="#000" stroke-width="2" />
          <line x1="30" y1="0" x2="25" y2="0" stroke="#000" stroke-width="2" />
          <line x1="26" y1="15" x2="22" y2="13" stroke="#000" stroke-width="2" />
          <line x1="15" y1="26" x2="13" y2="22" stroke="#000" stroke-width="2" />
          <line x1="0" y1="30" x2="0" y2="25" stroke="#000" stroke-width="2" />
          <line x1="-15" y1="26" x2="-13" y2="22" stroke="#000" stroke-width="2" />
          <line x1="-26" y1="15" x2="-22" y2="13" stroke="#000" stroke-width="2" />
          <line x1="-30" y1="0" x2="-25" y2="0" stroke="#000" stroke-width="2" />
          <line x1="-26" y1="-15" x2="-22" y2="-13" stroke="#000" stroke-width="2" />
          <line x1="-15" y1="-26" x2="-13" y2="-22" stroke="#000" stroke-width="2" />
          
          <!-- Стрелки -->
          <line x1="0" y1="0" x2="0" y2="-20" stroke="#000" stroke-width="2" />
          <line x1="0" y1="0" x2="15" y2="0" stroke="#000" stroke-width="2" />
          <line x1="0" y1="0" x2="-8" y2="10" stroke="#000" stroke-width="1" />
          <circle cx="0" cy="0" r="3" fill="#000" />
          
          <!-- Логотип -->
          <text x="0" y="-10" font-family="Arial" font-size="5" text-anchor="middle" fill="#000">LUXURY</text>
          <path d="M-15,-15 L15,-15 L0,-5 Z" fill="${accentColor}" opacity="0.7" filter="url(#shimmer)" />
        </g>
      `;
      break;
    
    case 'square': // Квадратные элегантные часы
      watchShape = `
        <!-- Квадратные элегантные часы (стиль Cartier) -->
        <g transform="translate(80, 80)">
          <!-- Ремешок -->
          <path d="M-30,0 C-30,20 -25,50 -10,70 L10,70 C25,50 30,20 30,0 C30,-20 25,-50 10,-70 L-10,-70 C-25,-50 -30,-20 -30,0 Z" 
                fill="${primaryColor}" stroke="#000" stroke-width="1" />
          
          <!-- Корпус часов -->
          <rect x="-30" y="-30" width="60" height="60" fill="${accentColor}" stroke="#000" stroke-width="1" filter="url(#metal)" />
          
          <!-- Циферблат -->
          <rect x="-25" y="-25" width="50" height="50" fill="${secondaryColor}" stroke="#333" stroke-width="1" />
          
          <!-- Римские цифры -->
          <text x="0" y="-15" font-family="Times New Roman" font-size="8" text-anchor="middle" fill="#000">XII</text>
          <text x="15" y="0" font-family="Times New Roman" font-size="8" text-anchor="middle" fill="#000">III</text>
          <text x="0" y="18" font-family="Times New Roman" font-size="8" text-anchor="middle" fill="#000">VI</text>
          <text x="-15" y="0" font-family="Times New Roman" font-size="8" text-anchor="middle" fill="#000">IX</text>
          
          <!-- Стрелки -->
          <line x1="0" y1="0" x2="0" y2="-15" stroke="#000" stroke-width="2" />
          <line x1="0" y1="0" x2="12" y2="0" stroke="#000" stroke-width="2" />
          <circle cx="0" cy="0" r="2" fill="#000" />
          
          <!-- Заводная головка -->
          <circle cx="30" cy="0" r="5" fill="${accentColor}" filter="url(#metal)" />
          <path d="M30,-3 L30,3 M27,0 L33,0" stroke="#333" stroke-width="1" />
        </g>
      `;
      break;
    
    case 'oval': // Овальные часы
      watchShape = `
        <!-- Овальные элегантные часы -->
        <g transform="translate(80, 80)">
          <!-- Ремешок -->
          <path d="M-35,0 C-35,20 -30,50 -15,70 L15,70 C30,50 35,20 35,0 C35,-20 30,-50 15,-70 L-15,-70 C-30,-50 -35,-20 -35,0 Z" 
                fill="${primaryColor}" stroke="#000" stroke-width="1" />
          
          <!-- Корпус часов -->
          <ellipse cx="0" cy="0" rx="35" ry="25" fill="${accentColor}" stroke="#000" stroke-width="1" filter="url(#metal)" />
          
          <!-- Циферблат -->
          <ellipse cx="0" cy="0" rx="30" ry="20" fill="${secondaryColor}" stroke="#333" stroke-width="1" />
          
          <!-- Метки часов -->
          <line x1="0" y1="-15" x2="0" y2="-12" stroke="#000" stroke-width="1" />
          <line x1="15" y1="-10" x2="12" y2="-8" stroke="#000" stroke-width="1" />
          <line x1="25" y1="0" x2="20" y2="0" stroke="#000" stroke-width="1" />
          <line x1="15" y1="10" x2="12" y2="8" stroke="#000" stroke-width="1" />
          <line x1="0" y1="15" x2="0" y2="12" stroke="#000" stroke-width="1" />
          <line x1="-15" y1="10" x2="-12" y2="8" stroke="#000" stroke-width="1" />
          <line x1="-25" y1="0" x2="-20" y2="0" stroke="#000" stroke-width="1" />
          <line x1="-15" y1="-10" x2="-12" y2="-8" stroke="#000" stroke-width="1" />
          
          <!-- Стрелки -->
          <line x1="0" y1="0" x2="0" y2="-12" stroke="#000" stroke-width="1.5" />
          <line x1="0" y1="0" x2="18" y2="0" stroke="#000" stroke-width="1.5" />
          <circle cx="0" cy="0" r="2" fill="#000" />
          
          <!-- Логотип -->
          <text x="0" y="7" font-family="Arial" font-size="4" text-anchor="middle" fill="#000">ELITE</text>
        </g>
      `;
      break;
    
    case 'tonneau': // Бочкообразные часы (Франк Мюллер, Ришар Милль)
      watchShape = `
        <!-- Бочкообразные часы (стиль Франк Мюллер, Ришар Милль) -->
        <g transform="translate(80, 80)">
          <!-- Ремешок -->
          <path d="M-30,0 C-30,20 -25,50 -10,70 L10,70 C25,50 30,20 30,0 C30,-20 25,-50 10,-70 L-10,-70 C-25,-50 -30,-20 -30,0 Z" 
                fill="${primaryColor}" stroke="#000" stroke-width="1" />
          
          <!-- Корпус часов в форме бочки -->
          <path d="M-30,-20 C-30,-25 -25,-35 -15,-40 L15,-40 C25,-35 30,-25 30,-20 
                   L30,20 C30,25 25,35 15,40 L-15,40 C-25,35 -30,25 -30,20 Z" 
                fill="${accentColor}" stroke="#000" stroke-width="1" filter="url(#metal)" />
          
          <!-- Циферблат -->
          <path d="M-25,-18 C-25,-22 -22,-30 -12,-35 L12,-35 C22,-30 25,-22 25,-18 
                   L25,18 C25,22 22,30 12,35 L-12,35 C-22,30 -25,22 -25,18 Z" 
                fill="${secondaryColor}" stroke="#333" stroke-width="1" />
          
          <!-- Арабские цифры в винтажном стиле -->
          <text x="0" y="-20" font-family="Arial" font-size="8" text-anchor="middle" fill="#000">12</text>
          <text x="15" y="0" font-family="Arial" font-size="8" text-anchor="middle" fill="#000">3</text>
          <text x="0" y="22" font-family="Arial" font-size="8" text-anchor="middle" fill="#000">6</text>
          <text x="-15" y="0" font-family="Arial" font-size="8" text-anchor="middle" fill="#000">9</text>
          
          <!-- Стрелки -->
          <line x1="0" y1="0" x2="0" y2="-15" stroke="#000" stroke-width="2" />
          <line x1="0" y1="0" x2="12" y2="0" stroke="#000" stroke-width="2" />
          <line x1="0" y1="0" x2="-5" y2="10" stroke="#000" stroke-width="1" />
          <circle cx="0" cy="0" r="2" fill="#000" />
          
          <!-- Винты в корпусе -->
          <circle cx="-25" cy="-18" r="2" fill="#444" />
          <circle cx="25" cy="-18" r="2" fill="#444" />
          <circle cx="-25" cy="18" r="2" fill="#444" />
          <circle cx="25" cy="18" r="2" fill="#444" />
          
          <!-- Логотип -->
          <text x="0" y="-7" font-family="Arial" font-size="4" text-anchor="middle" fill="#000">PREMIUM</text>
          <text x="0" y="10" font-family="Arial" font-size="3" text-anchor="middle" fill="#000">AUTOMATIC</text>
        </g>
      `;
      break;
  }
  
  // Добавляем эффекты блеска для создания реалистичного вида
  const reflections = `
    <!-- Блики и отражения для реалистичности -->
    <ellipse cx="${80 + randomGenerator() * 20}" cy="${60 + randomGenerator() * 20}" rx="${10 + randomGenerator() * 15}" ry="5" 
             fill="white" opacity="${0.1 + randomGenerator() * 0.2}" filter="url(#shimmer)" />
    <circle cx="${70 + randomGenerator() * 20}" cy="${90 + randomGenerator() * 10}" r="${3 + randomGenerator() * 5}" 
            fill="white" opacity="${0.1 + randomGenerator() * 0.15}" />
  `;
  
  // Создаем фон (например, витрина магазина или роскошную текстуру)
  const background = `
    <!-- Роскошная текстура фона -->
    <rect x="0" y="160" width="256" height="96" fill="#333" opacity="0.7" />
    <path d="M0,160 L256,160" stroke="${primaryColor}" stroke-width="2" opacity="0.3" />
    <rect x="40" y="180" width="176" height="40" fill="#111" opacity="0.5" rx="5" ry="5" />
  `;
  
  // Финальное изображение часов
  return `
    <g>
      ${background}
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
  // Выбираем тип огранки
  const cutTypes = ['round', 'princess', 'cushion', 'emerald'];
  const cutType = cutTypes[Math.floor(randomGenerator() * cutTypes.length)];
  
  // Создаем форму бриллианта в зависимости от огранки
  let diamondShape = '';
  
  switch (cutType) {
    case 'round': // Круглая огранка (классическая)
      diamondShape = `
        <!-- Круглый бриллиант -->
        <g transform="translate(128, 128)">
          <!-- Верхняя часть бриллианта (корона) -->
          <polygon points="0,-50 35,-35 50,0 35,35 0,50 -35,35 -50,0 -35,-35" 
                  fill="${accentColor}" opacity="0.9" filter="url(#diamond)" />
          
          <!-- Блики на гранях -->
          <polygon points="0,-50 35,-35 0,-20" fill="white" opacity="0.5" filter="url(#shimmer)" />
          <polygon points="0,-50 -35,-35 0,-20" fill="white" opacity="0.5" filter="url(#shimmer)" />
          <polygon points="50,0 35,-35 20,0" fill="white" opacity="0.7" filter="url(#shimmer)" />
          <polygon points="50,0 35,35 20,0" fill="white" opacity="0.6" filter="url(#shimmer)" />
          <polygon points="-50,0 -35,-35 -20,0" fill="white" opacity="0.7" filter="url(#shimmer)" />
          <polygon points="-50,0 -35,35 -20,0" fill="white" opacity="0.6" filter="url(#shimmer)" />
          <polygon points="0,50 35,35 0,20" fill="white" opacity="0.3" filter="url(#shimmer)" />
          <polygon points="0,50 -35,35 0,20" fill="white" opacity="0.3" filter="url(#shimmer)" />
          
          <!-- Центральная площадка (таблица) -->
          <circle cx="0" cy="0" r="15" fill="white" opacity="0.4" filter="url(#glow)" />
          
          <!-- Искры и отражения -->
          <circle cx="${randomGenerator() * 40 - 20}" cy="${randomGenerator() * 40 - 20}" r="2" fill="white" opacity="0.9" filter="url(#glow)" />
          <circle cx="${randomGenerator() * 40 - 20}" cy="${randomGenerator() * 40 - 20}" r="1" fill="white" opacity="0.9" filter="url(#glow)" />
          <circle cx="${randomGenerator() * 40 - 20}" cy="${randomGenerator() * 40 - 20}" r="2" fill="white" opacity="0.9" filter="url(#glow)" />
          <circle cx="${randomGenerator() * 40 - 20}" cy="${randomGenerator() * 40 - 20}" r="1" fill="white" opacity="0.9" filter="url(#glow)" />
        </g>
      `;
      break;
    
    case 'princess': // Квадратная огранка "принцесса"
      diamondShape = `
        <!-- Квадратный бриллиант "принцесса" -->
        <g transform="translate(128, 128)">
          <!-- Основная форма -->
          <rect x="-45" y="-45" width="90" height="90" fill="${accentColor}" opacity="0.9" filter="url(#diamond)" />
          
          <!-- Внутренние грани -->
          <polygon points="0,0 -45,-45 0,-45" fill="white" opacity="0.6" filter="url(#shimmer)" />
          <polygon points="0,0 45,-45 0,-45" fill="white" opacity="0.6" filter="url(#shimmer)" />
          <polygon points="0,0 -45,45 0,45" fill="white" opacity="0.4" filter="url(#shimmer)" />
          <polygon points="0,0 45,45 0,45" fill="white" opacity="0.4" filter="url(#shimmer)" />
          <polygon points="0,0 -45,-45 -45,0" fill="white" opacity="0.5" filter="url(#shimmer)" />
          <polygon points="0,0 -45,0 -45,45" fill="white" opacity="0.3" filter="url(#shimmer)" />
          <polygon points="0,0 45,-45 45,0" fill="white" opacity="0.5" filter="url(#shimmer)" />
          <polygon points="0,0 45,0 45,45" fill="white" opacity="0.3" filter="url(#shimmer)" />
          
          <!-- Центральное пересечение -->
          <rect x="-15" y="-15" width="30" height="30" fill="white" opacity="0.2" filter="url(#glow)" />
          
          <!-- Искры и отражения -->
          <circle cx="${randomGenerator() * 60 - 30}" cy="${randomGenerator() * 60 - 30}" r="2" fill="white" opacity="0.9" filter="url(#glow)" />
          <circle cx="${randomGenerator() * 60 - 30}" cy="${randomGenerator() * 60 - 30}" r="1" fill="white" opacity="0.9" filter="url(#glow)" />
          <circle cx="${randomGenerator() * 60 - 30}" cy="${randomGenerator() * 60 - 30}" r="2" fill="white" opacity="0.9" filter="url(#glow)" />
        </g>
      `;
      break;
    
    case 'cushion': // Огранка "кушон" (скругленный квадрат)
      diamondShape = `
        <!-- Бриллиант "кушон" (скругленный квадрат) -->
        <g transform="translate(128, 128)">
          <!-- Основная форма -->
          <rect x="-40" y="-40" width="80" height="80" rx="20" ry="20" 
                fill="${accentColor}" opacity="0.9" filter="url(#diamond)" />
          
          <!-- Внутренние грани -->
          <path d="M-20,-40 L20,-40 L0,-10 Z" fill="white" opacity="0.6" filter="url(#shimmer)" />
          <path d="M40,-20 L40,20 L10,0 Z" fill="white" opacity="0.6" filter="url(#shimmer)" />
          <path d="M-40,-20 L-40,20 L-10,0 Z" fill="white" opacity="0.6" filter="url(#shimmer)" />
          <path d="M-20,40 L20,40 L0,10 Z" fill="white" opacity="0.4" filter="url(#shimmer)" />
          
          <!-- Центральная площадка -->
          <rect x="-15" y="-15" width="30" height="30" rx="10" ry="10" 
                fill="white" opacity="0.2" filter="url(#glow)" />
          
          <!-- Искры и отражения -->
          <circle cx="${randomGenerator() * 50 - 25}" cy="${randomGenerator() * 50 - 25}" r="2" fill="white" opacity="0.9" filter="url(#glow)" />
          <circle cx="${randomGenerator() * 50 - 25}" cy="${randomGenerator() * 50 - 25}" r="1.5" fill="white" opacity="0.9" filter="url(#glow)" />
          <circle cx="${randomGenerator() * 50 - 25}" cy="${randomGenerator() * 50 - 25}" r="1" fill="white" opacity="0.9" filter="url(#glow)" />
          <circle cx="${randomGenerator() * 50 - 25}" cy="${randomGenerator() * 50 - 25}" r="2" fill="white" opacity="0.9" filter="url(#glow)" />
        </g>
      `;
      break;
    
    case 'emerald': // Изумрудная огранка (прямоугольная со срезанными углами)
      diamondShape = `
        <!-- Бриллиант изумрудной огранки -->
        <g transform="translate(128, 128)">
          <!-- Основная форма -->
          <path d="M-50,-30 L-40,-40 L40,-40 L50,-30 L50,30 L40,40 L-40,40 L-50,30 Z" 
                fill="${accentColor}" opacity="0.9" filter="url(#diamond)" />
          
          <!-- Внутренние грани -->
          <rect x="-30" y="-25" width="60" height="50" fill="white" opacity="0.2" filter="url(#shimmer)" />
          <line x1="-30" y1="-25" x2="30" y2="-25" stroke="white" stroke-width="2" opacity="0.7" />
          <line x1="-30" y1="-10" x2="30" y2="-10" stroke="white" stroke-width="1" opacity="0.5" />
          <line x1="-30" y1="5" x2="30" y2="5" stroke="white" stroke-width="1" opacity="0.5" />
          <line x1="-30" y1="20" x2="30" y2="20" stroke="white" stroke-width="1" opacity="0.5" />
          
          <!-- Отражения на гранях -->
          <rect x="-20" y="-35" width="40" height="10" fill="white" opacity="0.3" filter="url(#shimmer)" />
          <rect x="-45" y="-20" width="10" height="40" fill="white" opacity="0.3" filter="url(#shimmer)" />
          <rect x="35" y="-20" width="10" height="40" fill="white" opacity="0.3" filter="url(#shimmer)" />
          <rect x="-20" y="25" width="40" height="10" fill="white" opacity="0.2" filter="url(#shimmer)" />
          
          <!-- Искры и отражения -->
          <circle cx="${randomGenerator() * 60 - 30}" cy="${randomGenerator() * 60 - 30}" r="1.5" fill="white" opacity="0.9" filter="url(#glow)" />
          <circle cx="${randomGenerator() * 60 - 30}" cy="${randomGenerator() * 60 - 30}" r="1" fill="white" opacity="0.9" filter="url(#glow)" />
          <circle cx="${randomGenerator() * 60 - 30}" cy="${randomGenerator() * 60 - 30}" r="2" fill="white" opacity="0.9" filter="url(#glow)" />
        </g>
      `;
      break;
  }
  
  // Создаем эффекты света и отражений
  const lightEffects = `
    <!-- Световые эффекты и блики -->
    <circle cx="128" cy="128" r="70" fill="url(#radialLight)" opacity="0.4" />
    <defs>
      <radialGradient id="radialLight" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
        <stop offset="0%" stop-color="white" stop-opacity="0.7" />
        <stop offset="100%" stop-color="white" stop-opacity="0" />
      </radialGradient>
    </defs>
    
    <!-- Лучи света -->
    <line x1="128" y1="60" x2="128" y2="20" stroke="white" stroke-width="1" opacity="0.4" />
    <line x1="180" y1="100" x2="210" y2="80" stroke="white" stroke-width="1" opacity="0.4" />
    <line x1="160" y1="170" x2="190" y2="190" stroke="white" stroke-width="1" opacity="0.4" />
    <line x1="80" y1="150" x2="50" y2="170" stroke="white" stroke-width="1" opacity="0.4" />
    <line x1="90" y1="90" x2="60" y2="70" stroke="white" stroke-width="1" opacity="0.4" />
  `;
  
  // Создаем фон (например, бархатную подушку или роскошную поверхность)
  const background = `
    <!-- Бархатная подушка или поверхность -->
    <ellipse cx="128" cy="200" rx="80" ry="30" fill="#331022" opacity="0.7" />
    <rect x="48" y="170" width="160" height="30" fill="#331022" opacity="0.8" rx="10" ry="10" />
  `;
  
  // Финальное изображение бриллианта
  return `
    <g>
      ${background}
      ${lightEffects}
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
  // Выбираем тип денег (купюры, пачки, золотые монеты)
  const moneyTypes = ['bills', 'stacks', 'gold'];
  const moneyType = moneyTypes[Math.floor(randomGenerator() * moneyTypes.length)];
  
  // Создаем изображение в зависимости от типа денег
  let moneyShape = '';
  
  switch (moneyType) {
    case 'bills': // Разбросанные купюры
      moneyShape = `
        <!-- Разбросанные купюры в реалистичном стиле -->
        <g transform="translate(0, 0)">
          <!-- Купюра 1 -->
          <rect x="70" y="100" width="120" height="60" rx="2" ry="2" transform="rotate(-5, 70, 100)" 
                fill="#006B3F" stroke="#003D21" stroke-width="1" />
          <ellipse cx="115" cy="130" rx="25" ry="25" fill="#F9F9F9" opacity="0.7" transform="rotate(-5, 115, 130)" />
          <rect x="80" y="110" width="80" height="10" fill="#FFFFFF" opacity="0.2" transform="rotate(-5, 80, 110)" />
          <rect x="90" y="140" width="60" height="10" fill="#FFFFFF" opacity="0.2" transform="rotate(-5, 90, 140)" />
          
          <!-- Купюра 2 -->
          <rect x="60" y="120" width="120" height="60" rx="2" ry="2" transform="rotate(10, 60, 120)" 
                fill="#006B3F" stroke="#003D21" stroke-width="1" />
          <ellipse cx="105" cy="150" rx="25" ry="25" fill="#F9F9F9" opacity="0.7" transform="rotate(10, 105, 150)" />
          <rect x="70" y="130" width="80" height="10" fill="#FFFFFF" opacity="0.2" transform="rotate(10, 70, 130)" />
          <rect x="80" y="160" width="60" height="10" fill="#FFFFFF" opacity="0.2" transform="rotate(10, 80, 160)" />
          
          <!-- Купюра 3 -->
          <rect x="90" y="95" width="120" height="60" rx="2" ry="2" transform="rotate(-15, 90, 95)" 
                fill="#006B3F" stroke="#003D21" stroke-width="1" />
          <ellipse cx="135" cy="125" rx="25" ry="25" fill="#F9F9F9" opacity="0.7" transform="rotate(-15, 135, 125)" />
          <rect x="100" y="105" width="80" height="10" fill="#FFFFFF" opacity="0.2" transform="rotate(-15, 100, 105)" />
          <rect x="110" y="135" width="60" height="10" fill="#FFFFFF" opacity="0.2" transform="rotate(-15, 110, 135)" />
          
          <!-- Купюра 4 -->
          <rect x="50" y="140" width="120" height="60" rx="2" ry="2" transform="rotate(20, 50, 140)" 
                fill="#006B3F" stroke="#003D21" stroke-width="1" />
          <ellipse cx="95" cy="170" rx="25" ry="25" fill="#F9F9F9" opacity="0.7" transform="rotate(20, 95, 170)" />
          <rect x="60" y="150" width="80" height="10" fill="#FFFFFF" opacity="0.2" transform="rotate(20, 60, 150)" />
          <rect x="70" y="180" width="60" height="10" fill="#FFFFFF" opacity="0.2" transform="rotate(20, 70, 180)" />
        </g>
      `;
      break;
    
    case 'stacks': // Аккуратные пачки денег
      moneyShape = `
        <!-- Аккуратные пачки денег в реалистичном стиле -->
        <g transform="translate(0, 0)">
          <!-- Пачка 1 (нижняя) -->
          <rect x="78" y="150" width="100" height="40" rx="2" ry="2" fill="#006B3F" stroke="#003D21" stroke-width="1" />
          <rect x="78" y="150" width="100" height="5" fill="#FFFFFF" opacity="0.3" />
          <rect x="78" y="155" width="100" height="2" fill="#000000" opacity="0.1" />
          <rect x="78" y="165" width="100" height="2" fill="#000000" opacity="0.1" />
          <rect x="78" y="175" width="100" height="2" fill="#000000" opacity="0.1" />
          <rect x="78" y="185" width="100" height="2" fill="#000000" opacity="0.1" />
          <ellipse cx="128" cy="170" rx="20" ry="20" fill="#FFFFFF" opacity="0.3" />
          
          <!-- Пачка 2 (средняя) -->
          <rect x="85" y="120" width="100" height="30" rx="2" ry="2" fill="#006B3F" stroke="#003D21" stroke-width="1" />
          <rect x="85" y="120" width="100" height="4" fill="#FFFFFF" opacity="0.3" />
          <rect x="85" y="124" width="100" height="1" fill="#000000" opacity="0.1" />
          <rect x="85" y="130" width="100" height="1" fill="#000000" opacity="0.1" />
          <rect x="85" y="136" width="100" height="1" fill="#000000" opacity="0.1" />
          <rect x="85" y="142" width="100" height="1" fill="#000000" opacity="0.1" />
          <ellipse cx="135" cy="135" rx="15" ry="15" fill="#FFFFFF" opacity="0.3" />
          
          <!-- Пачка 3 (верхняя) -->
          <rect x="70" y="90" width="100" height="30" rx="2" ry="2" fill="#006B3F" stroke="#003D21" stroke-width="1" />
          <rect x="70" y="90" width="100" height="4" fill="#FFFFFF" opacity="0.3" />
          <rect x="70" y="94" width="100" height="1" fill="#000000" opacity="0.1" />
          <rect x="70" y="100" width="100" height="1" fill="#000000" opacity="0.1" />
          <rect x="70" y="106" width="100" height="1" fill="#000000" opacity="0.1" />
          <rect x="70" y="112" width="100" height="1" fill="#000000" opacity="0.1" />
          <ellipse cx="120" cy="105" rx="15" ry="15" fill="#FFFFFF" opacity="0.3" />
          
          <!-- Обертка на нижней пачке -->
          <rect x="110" y="148" width="40" height="44" fill="none" stroke="#004D2F" stroke-width="2" />
          
          <!-- Отдельные купюры -->
          <rect x="130" y="75" width="80" height="25" rx="2" ry="2" transform="rotate(15, 130, 75)" 
                fill="#006B3F" stroke="#003D21" stroke-width="0.5" opacity="0.9" />
          <ellipse cx="160" cy="87" rx="12" ry="12" fill="#FFFFFF" opacity="0.3" transform="rotate(15, 160, 87)" />
          
          <rect x="60" y="65" width="80" height="25" rx="2" ry="2" transform="rotate(-10, 60, 65)" 
                fill="#006B3F" stroke="#003D21" stroke-width="0.5" opacity="0.9" />
          <ellipse cx="90" cy="77" rx="12" ry="12" fill="#FFFFFF" opacity="0.3" transform="rotate(-10, 90, 77)" />
        </g>
      `;
      break;
    
    case 'gold': // Золотые монеты и слитки
      moneyShape = `
        <!-- Золотые монеты и слитки -->
        <g transform="translate(0, 0)">
          <!-- Золотой слиток 1 -->
          <rect x="80" y="140" width="100" height="40" rx="5" ry="10" fill="#FFD700" stroke="#AA8C00" stroke-width="1" filter="url(#metal)" />
          <rect x="95" y="150" width="70" height="20" rx="2" ry="2" fill="#AA8C00" opacity="0.5" />
          <text x="130" y="165" font-family="Arial" font-size="10" text-anchor="middle" fill="#553500">999.9</text>
          
          <!-- Золотой слиток 2 -->
          <rect x="110" y="110" width="80" height="30" rx="4" ry="8" fill="#FFD700" stroke="#AA8C00" stroke-width="1" filter="url(#metal)" />
          <rect x="120" y="117" width="60" height="15" rx="2" ry="2" fill="#AA8C00" opacity="0.5" />
          <text x="150" y="128" font-family="Arial" font-size="8" text-anchor="middle" fill="#553500">GOLD</text>
          
          <!-- Монета 1 -->
          <circle cx="70" cy="110" r="25" fill="#FFD700" stroke="#AA8C00" stroke-width="1" filter="url(#metal)" />
          <circle cx="70" cy="110" r="20" fill="none" stroke="#AA8C00" stroke-width="0.5" />
          <text x="70" y="115" font-family="Arial" font-size="10" text-anchor="middle" fill="#553500">$</text>
          
          <!-- Монета 2 -->
          <circle cx="60" cy="150" r="20" fill="#FFD700" stroke="#AA8C00" stroke-width="1" filter="url(#metal)" />
          <circle cx="60" cy="150" r="15" fill="none" stroke="#AA8C00" stroke-width="0.5" />
          <text x="60" y="155" font-family="Arial" font-size="8" text-anchor="middle" fill="#553500">$</text>
          
          <!-- Монета 3 -->
          <circle cx="200" cy="125" r="22" fill="#FFD700" stroke="#AA8C00" stroke-width="1" filter="url(#metal)" />
          <circle cx="200" cy="125" r="17" fill="none" stroke="#AA8C00" stroke-width="0.5" />
          <text x="200" y="130" font-family="Arial" font-size="9" text-anchor="middle" fill="#553500">$</text>
          
          <!-- Монета 4 -->
          <circle cx="180" cy="160" r="18" fill="#FFD700" stroke="#AA8C00" stroke-width="1" filter="url(#metal)" />
          <circle cx="180" cy="160" r="13" fill="none" stroke="#AA8C00" stroke-width="0.5" />
          <text x="180" y="165" font-family="Arial" font-size="7" text-anchor="middle" fill="#553500">$</text>
          
          <!-- Монета 5 -->
          <circle cx="100" cy="85" r="15" fill="#FFD700" stroke="#AA8C00" stroke-width="1" filter="url(#metal)" />
          <circle cx="100" cy="85" r="10" fill="none" stroke="#AA8C00" stroke-width="0.5" />
          <text x="100" y="90" font-family="Arial" font-size="6" text-anchor="middle" fill="#553500">$</text>
          
          <!-- Разбросанные монеты -->
          <circle cx="${70 + randomGenerator() * 120}" cy="${90 + randomGenerator() * 80}" r="12" fill="#FFD700" stroke="#AA8C00" stroke-width="0.5" filter="url(#metal)" />
          <circle cx="${70 + randomGenerator() * 120}" cy="${90 + randomGenerator() * 80}" r="10" fill="#FFD700" stroke="#AA8C00" stroke-width="0.5" filter="url(#metal)" />
          <circle cx="${70 + randomGenerator() * 120}" cy="${90 + randomGenerator() * 80}" r="8" fill="#FFD700" stroke="#AA8C00" stroke-width="0.5" filter="url(#metal)" />
        </g>
      `;
      break;
  }
  
  // Добавляем эффекты и блики
  const shineEffects = `
    <!-- Эффекты блеска и отражения -->
    <ellipse cx="${100 + randomGenerator() * 60}" cy="${80 + randomGenerator() * 50}" rx="${10 + randomGenerator() * 20}" ry="5" 
             fill="white" opacity="${0.1 + randomGenerator() * 0.2}" filter="url(#shimmer)" />
    <ellipse cx="${110 + randomGenerator() * 50}" cy="${110 + randomGenerator() * 40}" rx="${5 + randomGenerator() * 15}" ry="3" 
             fill="white" opacity="${0.1 + randomGenerator() * 0.15}" />
  `;
  
  // Создаем фон (например, роскошный стол или сейф)
  const background = `
    <!-- Роскошный стол или поверхность -->
    <rect x="0" y="190" width="256" height="66" fill="${accentColor}" opacity="0.3" />
    <rect x="20" y="190" width="216" height="2" fill="${primaryColor}" opacity="0.5" />
    <rect x="40" y="130" width="176" height="60" rx="5" ry="5" fill="#111" opacity="0.2" />
  `;
  
  // Финальное изображение денег
  return `
    <g>
      ${background}
      ${moneyShape}
      ${shineEffects}
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
  // Выбираем тип особняка
  const mansionTypes = ['modern', 'classical', 'villa', 'penthouse'];
  const mansionType = mansionTypes[Math.floor(randomGenerator() * mansionTypes.length)];
  
  // Создаем изображение в зависимости от типа особняка
  let mansionShape = '';
  
  switch (mansionType) {
    case 'modern': // Современный особняк с большими окнами
      mansionShape = `
        <!-- Современный особняк -->
        <g transform="translate(28, 60)">
          <!-- Основное здание -->
          <rect x="20" y="60" width="180" height="110" fill="#FFFFFF" stroke="#CCCCCC" stroke-width="1" />
          
          <!-- Крыша -->
          <rect x="10" y="50" width="200" height="10" fill="#EEEEEE" stroke="#CCCCCC" stroke-width="1" />
          
          <!-- Большие панорамные окна -->
          <rect x="30" y="70" width="50" height="80" fill="${secondaryColor}" opacity="0.7" />
          <line x1="55" y1="70" x2="55" y2="150" stroke="#FFFFFF" stroke-width="1" />
          <line x1="30" y1="110" x2="80" y2="110" stroke="#FFFFFF" stroke-width="1" />
          
          <rect x="140" y="70" width="50" height="80" fill="${secondaryColor}" opacity="0.7" />
          <line x1="165" y1="70" x2="165" y2="150" stroke="#FFFFFF" stroke-width="1" />
          <line x1="140" y1="110" x2="190" y2="110" stroke="#FFFFFF" stroke-width="1" />
          
          <!-- Центральная часть -->
          <rect x="90" y="90" width="40" height="80" fill="#F5F5F5" stroke="#CCCCCC" stroke-width="1" />
          <rect x="95" y="150" width="30" height="20" fill="#333333" /> <!-- Дверь -->
          
          <!-- Дополнительные элементы -->
          <rect x="60" y="160" width="20" height="10" fill="#666666" /> <!-- Ступеньки -->
          <rect x="140" y="160" width="20" height="10" fill="#666666" />
          
          <!-- Бассейн -->
          <rect x="30" y="190" width="70" height="30" fill="${accentColor}" opacity="0.7" />
          <line x1="30" y1="195" x2="100" y2="195" stroke="white" stroke-width="0.5" opacity="0.5" />
          
          <!-- Ландшафт -->
          <rect x="0" y="170" width="220" height="2" fill="#999999" /> <!-- Терраса -->
          <circle cx="15" cy="180" r="5" fill="#2E7D32" /> <!-- Кусты -->
          <circle cx="205" cy="180" r="5" fill="#2E7D32" />
          <circle cx="15" cy="190" r="5" fill="#2E7D32" />
          <circle cx="205" cy="190" r="5" fill="#2E7D32" />
        </g>
      `;
      break;
    
    case 'classical': // Классический особняк с колоннами
      mansionShape = `
        <!-- Классический особняк -->
        <g transform="translate(28, 60)">
          <!-- Основное здание -->
          <rect x="20" y="60" width="180" height="110" fill="#F5DEB3" stroke="#DAA520" stroke-width="1" />
          
          <!-- Крыша -->
          <polygon points="20,60 110,20 200,60" fill="#8B4513" stroke="#603311" stroke-width="1" />
          
          <!-- Колонны -->
          <rect x="40" y="70" width="10" height="100" fill="#FFFFFF" stroke="#CCCCCC" stroke-width="1" />
          <rect x="80" y="70" width="10" height="100" fill="#FFFFFF" stroke="#CCCCCC" stroke-width="1" />
          <rect x="130" y="70" width="10" height="100" fill="#FFFFFF" stroke="#CCCCCC" stroke-width="1" />
          <rect x="170" y="70" width="10" height="100" fill="#FFFFFF" stroke="#CCCCCC" stroke-width="1" />
          
          <!-- Элементы колонн -->
          <rect x="35" y="65" width="20" height="5" fill="#FFFFFF" stroke="#CCCCCC" stroke-width="0.5" />
          <rect x="75" y="65" width="20" height="5" fill="#FFFFFF" stroke="#CCCCCC" stroke-width="0.5" />
          <rect x="125" y="65" width="20" height="5" fill="#FFFFFF" stroke="#CCCCCC" stroke-width="0.5" />
          <rect x="165" y="65" width="20" height="5" fill="#FFFFFF" stroke="#CCCCCC" stroke-width="0.5" />
          
          <rect x="35" y="165" width="20" height="5" fill="#FFFFFF" stroke="#CCCCCC" stroke-width="0.5" />
          <rect x="75" y="165" width="20" height="5" fill="#FFFFFF" stroke="#CCCCCC" stroke-width="0.5" />
          <rect x="125" y="165" width="20" height="5" fill="#FFFFFF" stroke="#CCCCCC" stroke-width="0.5" />
          <rect x="165" y="165" width="20" height="5" fill="#FFFFFF" stroke="#CCCCCC" stroke-width="0.5" />
          
          <!-- Окна -->
          <rect x="55" y="80" width="20" height="30" fill="${secondaryColor}" opacity="0.7" />
          <line x1="65" y1="80" x2="65" y2="110" stroke="#FFFFFF" stroke-width="0.5" />
          <line x1="55" y1="95" x2="75" y2="95" stroke="#FFFFFF" stroke-width="0.5" />
          
          <rect x="55" y="120" width="20" height="30" fill="${secondaryColor}" opacity="0.7" />
          <line x1="65" y1="120" x2="65" y2="150" stroke="#FFFFFF" stroke-width="0.5" />
          <line x1="55" y1="135" x2="75" y2="135" stroke="#FFFFFF" stroke-width="0.5" />
          
          <rect x="145" y="80" width="20" height="30" fill="${secondaryColor}" opacity="0.7" />
          <line x1="155" y1="80" x2="155" y2="110" stroke="#FFFFFF" stroke-width="0.5" />
          <line x1="145" y1="95" x2="165" y2="95" stroke="#FFFFFF" stroke-width="0.5" />
          
          <rect x="145" y="120" width="20" height="30" fill="${secondaryColor}" opacity="0.7" />
          <line x1="155" y1="120" x2="155" y2="150" stroke="#FFFFFF" stroke-width="0.5" />
          <line x1="145" y1="135" x2="165" y2="135" stroke="#FFFFFF" stroke-width="0.5" />
          
          <!-- Центральная дверь -->
          <rect x="95" y="120" width="30" height="50" fill="#8B4513" stroke="#603311" stroke-width="1" />
          <rect x="105" y="120" width="10" height="50" fill="#8B4513" stroke="#603311" stroke-width="0.5" />
          <circle cx="100" cy="145" r="2" fill="#DAA520" /> <!-- Дверная ручка -->
          
          <!-- Ступеньки -->
          <rect x="85" y="170" width="50" height="5" fill="#CCCCCC" />
          <rect x="90" y="175" width="40" height="5" fill="#DDDDDD" />
          <rect x="95" y="180" width="30" height="5" fill="#EEEEEE" />
          
          <!-- Ландшафт -->
          <rect x="0" y="185" width="220" height="35" fill="#228B22" opacity="0.7" /> <!-- Газон -->
          <path d="M20,185 C40,175 60,180 80,185" stroke="#8B4513" stroke-width="2" fill="none" /> <!-- Дорожка -->
          <path d="M140,185 C160,175 180,180 200,185" stroke="#8B4513" stroke-width="2" fill="none" />
        </g>
      `;
      break;
    
    case 'villa': // Средиземноморская вилла
      mansionShape = `
        <!-- Средиземноморская вилла -->
        <g transform="translate(28, 50)">
          <!-- Основное здание -->
          <rect x="40" y="70" width="140" height="90" fill="#F8F0E3" stroke="#E8D0C0" stroke-width="1" />
          
          <!-- Крыша в средиземноморском стиле -->
          <path d="M30,70 L190,70 L190,80 L30,80 Z" fill="#E57373" stroke="#C62828" stroke-width="1" />
          <rect x="35" y="60" width="150" height="10" fill="#E57373" stroke="#C62828" stroke-width="1" />
          
          <!-- Арочные окна -->
          <path d="M60,90 L60,130 L90,130 L90,90 Z" fill="${secondaryColor}" opacity="0.7" />
          <path d="M60,90 C60,90 75,80 90,90" fill="${secondaryColor}" opacity="0.7" stroke="#FFFFFF" stroke-width="0.5" />
          <line x1="75" y1="90" x2="75" y2="130" stroke="#FFFFFF" stroke-width="0.5" />
          
          <path d="M130,90 L130,130 L160,130 L160,90 Z" fill="${secondaryColor}" opacity="0.7" />
          <path d="M130,90 C130,90 145,80 160,90" fill="${secondaryColor}" opacity="0.7" stroke="#FFFFFF" stroke-width="0.5" />
          <line x1="145" y1="90" x2="145" y2="130" stroke="#FFFFFF" stroke-width="0.5" />
          
          <!-- Дверь -->
          <path d="M95,110 L95,160 L125,160 L125,110 Z" fill="#A1887F" stroke="#8D6E63" stroke-width="1" />
          <path d="M95,110 C95,110 110,100 125,110" fill="#A1887F" stroke="#8D6E63" stroke-width="1" />
          <line x1="110" y1="110" x2="110" y2="160" stroke="#8D6E63" stroke-width="0.5" />
          <circle cx="105" cy="135" r="2" fill="#FFEB3B" /> <!-- Дверная ручка -->
          
          <!-- Терраса -->
          <rect x="20" y="160" width="180" height="5" fill="#F8F0E3" stroke="#E8D0C0" stroke-width="1" />
          <rect x="30" y="165" width="160" height="5" fill="#F8F0E3" stroke="#E8D0C0" stroke-width="1" />
          
          <!-- Бассейн -->
          <rect x="50" y="180" width="70" height="30" rx="5" ry="5" fill="${accentColor}" opacity="0.7" />
          <rect x="55" y="185" width="60" height="20" rx="3" ry="3" fill="${accentColor}" opacity="0.9" />
          
          <!-- Пальмы -->
          <rect x="20" y="170" width="5" height="20" fill="#8D6E63" />
          <ellipse cx="22" cy="170" rx="10" ry="15" fill="#4CAF50" />
          
          <rect x="195" y="170" width="5" height="20" fill="#8D6E63" />
          <ellipse cx="197" cy="170" rx="10" ry="15" fill="#4CAF50" />
          
          <!-- Ландшафт -->
          <rect x="0" y="190" width="220" height="30" fill="#81C784" opacity="0.7" /> <!-- Газон -->
          <path d="M125,180 C145,175 165,178 185,180" stroke="#FFE0B2" stroke-width="2" fill="none" opacity="0.7" /> <!-- Песчаная дорожка -->
        </g>
      `;
      break;
    
    case 'penthouse': // Роскошный пентхаус
      mansionShape = `
        <!-- Роскошный пентхаус -->
        <g transform="translate(28, 70)">
          <!-- Здание небоскреба (фон) -->
          <rect x="10" y="30" width="200" height="150" fill="#B0BEC5" stroke="#90A4AE" stroke-width="1" />
          <rect x="20" y="40" width="180" height="130" fill="#ECEFF1" stroke="#CFD8DC" stroke-width="1" />
          
          <!-- Горизонтальные линии (этажи) -->
          <line x1="10" y1="60" x2="210" y2="60" stroke="#90A4AE" stroke-width="0.5" />
          <line x1="10" y1="90" x2="210" y2="90" stroke="#90A4AE" stroke-width="0.5" />
          <line x1="10" y1="120" x2="210" y2="120" stroke="#90A4AE" stroke-width="0.5" />
          <line x1="10" y1="150" x2="210" y2="150" stroke="#90A4AE" stroke-width="0.5" />
          
          <!-- Пентхаус на крыше -->
          <rect x="30" y="10" width="160" height="60" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1" />
          <rect x="20" y="5" width="180" height="5" fill="#BDBDBD" />
          
          <!-- Большие панорамные окна пентхауса -->
          <rect x="40" y="20" width="40" height="40" fill="${secondaryColor}" opacity="0.7" />
          <line x1="60" y1="20" x2="60" y2="60" stroke="#FFFFFF" stroke-width="0.5" />
          <line x1="40" y1="40" x2="80" y2="40" stroke="#FFFFFF" stroke-width="0.5" />
          
          <rect x="90" y="20" width="40" height="40" fill="${secondaryColor}" opacity="0.7" />
          <line x1="110" y1="20" x2="110" y2="60" stroke="#FFFFFF" stroke-width="0.5" />
          <line x1="90" y1="40" x2="130" y2="40" stroke="#FFFFFF" stroke-width="0.5" />
          
          <rect x="140" y="20" width="40" height="40" fill="${secondaryColor}" opacity="0.7" />
          <line x1="160" y1="20" x2="160" y2="60" stroke="#FFFFFF" stroke-width="0.5" />
          <line x1="140" y1="40" x2="180" y2="40" stroke="#FFFFFF" stroke-width="0.5" />
          
          <!-- Терраса пентхауса -->
          <rect x="50" y="70" width="120" height="20" fill="#E0E0E0" stroke="#BDBDBD" stroke-width="1" />
          
          <!-- Мебель на террасе -->
          <rect x="60" y="75" width="20" height="10" fill="${primaryColor}" opacity="0.8" /> <!-- Шезлонг -->
          <rect x="140" y="75" width="20" height="10" fill="${primaryColor}" opacity="0.8" /> <!-- Шезлонг -->
          <circle cx="110" cy="80" r="5" fill="${primaryColor}" opacity="0.8" /> <!-- Стол -->
          
          <!-- Бассейн на террасе -->
          <rect x="90" y="75" width="40" height="10" rx="2" ry="2" fill="${accentColor}" opacity="0.7" />
          
          <!-- Реалистичные окна здания -->
          <rect x="30" y="100" width="15" height="20" fill="${secondaryColor}" opacity="0.5" />
          <rect x="55" y="100" width="15" height="20" fill="${secondaryColor}" opacity="0.5" />
          <rect x="80" y="100" width="15" height="20" fill="${secondaryColor}" opacity="0.5" />
          <rect x="105" y="100" width="15" height="20" fill="${secondaryColor}" opacity="0.5" />
          <rect x="130" y="100" width="15" height="20" fill="${secondaryColor}" opacity="0.5" />
          <rect x="155" y="100" width="15" height="20" fill="${secondaryColor}" opacity="0.5" />
          <rect x="180" y="100" width="15" height="20" fill="${secondaryColor}" opacity="0.5" />
          
          <rect x="30" y="130" width="15" height="20" fill="${secondaryColor}" opacity="0.5" />
          <rect x="55" y="130" width="15" height="20" fill="${secondaryColor}" opacity="0.5" />
          <rect x="80" y="130" width="15" height="20" fill="${secondaryColor}" opacity="0.5" />
          <rect x="105" y="130" width="15" height="20" fill="${secondaryColor}" opacity="0.5" />
          <rect x="130" y="130" width="15" height="20" fill="${secondaryColor}" opacity="0.5" />
          <rect x="155" y="130" width="15" height="20" fill="${secondaryColor}" opacity="0.5" />
          <rect x="180" y="130" width="15" height="20" fill="${secondaryColor}" opacity="0.5" />
          
          <!-- Улица внизу -->
          <rect x="0" y="180" width="220" height="3" fill="#424242" />
          <rect x="0" y="183" width="220" height="30" fill="#616161" opacity="0.7" />
          <rect x="100" y="183" width="20" height="30" fill="#424242" opacity="0.5" /> <!-- Дорога -->
        </g>
      `;
      break;
  }
  
  // Создаем эффекты освещения и атмосферы
  const luxuryEffects = `
    <!-- Эффекты освещения и атмосферы -->
    <defs>
      <radialGradient id="sunlight" cx="0.5" cy="0.3" r="0.8">
        <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.3" />
        <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0" />
      </radialGradient>
    </defs>
    
    <!-- Солнечное освещение -->
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
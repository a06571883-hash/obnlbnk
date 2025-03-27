/**
 * Утилита для генерации NFT изображений
 */
import * as fs from 'fs';
import * as path from 'path';

// Путь до директории с публичными файлами
const PUBLIC_DIR = path.join(process.cwd(), 'client', 'public');

// Типы редкости NFT
type NFTRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

/**
 * Создает SVG-изображение NFT в зависимости от редкости
 * @param rarity Редкость NFT
 * @returns Путь к созданному файлу
 */
export async function generateNFTImage(rarity: NFTRarity): Promise<string> {
  // Создаем директорию для NFT, если она еще не существует
  const nftDir = path.join(PUBLIC_DIR, 'assets', 'nft');
  if (!fs.existsSync(nftDir)) {
    fs.mkdirSync(nftDir, { recursive: true });
  }

  // Определяем цвета и стили в зависимости от редкости
  const styles = getRarityStyles(rarity);
  
  // Генерируем уникальное имя файла
  const fileName = `${rarity}_${Date.now()}.svg`;
  const filePath = path.join(nftDir, fileName);
  
  // Генерируем SVG-контент
  const svgContent = generateSVGContent(styles);
  
  // Записываем файл
  fs.writeFileSync(filePath, svgContent);
  
  // Возвращаем публичный путь к файлу
  return `/assets/nft/${fileName}`;
}

/**
 * Получает стили для NFT в зависимости от редкости
 * В мультяшном стиле с элементами роскошной жизни
 */
function getRarityStyles(rarity: NFTRarity): {
  backgroundColor: string;
  primaryColor: string;
  secondaryColor: string;
  borderColor: string;
  glowColor: string;
  glowSize: number;
  complexity: number;
  theme: 'car' | 'yacht' | 'mansion' | 'jet' | 'character';
} {
  // Преимущественно выбираем машины и персонажей-блондинов
  const luxuryThemes: ('car' | 'yacht' | 'mansion' | 'jet' | 'character')[] = 
    ['car', 'car', 'character', 'character', 'car', 'jet', 'character', 'yacht', 'car', 'character'];
  const randomTheme = luxuryThemes[Math.floor(Math.random() * luxuryThemes.length)];
  
  switch (rarity) {
    case 'common':
      return {
        backgroundColor: '#F0F7FF', // Светло-голубой фон, как в мультфильмах
        primaryColor: '#FF9843', // Яркий оранжевый
        secondaryColor: '#5DADE2', // Яркий голубой
        borderColor: '#3498DB', // Синий контур
        glowColor: '#5DADE2',
        glowSize: 2,
        complexity: 5,
        theme: randomTheme
      };
    case 'uncommon':
      return {
        backgroundColor: '#E8F8F5', // Светло-мятный фон
        primaryColor: '#FF5757', // Яркий красный
        secondaryColor: '#58D68D', // Яркий зеленый
        borderColor: '#2ECC71', // Зеленый контур
        glowColor: '#58D68D',
        glowSize: 3,
        complexity: 6,
        theme: randomTheme
      };
    case 'rare':
      return {
        backgroundColor: '#FEF9E7', // Светло-желтый фон
        primaryColor: '#AC5FE9', // Яркий фиолетовый
        secondaryColor: '#F4D03F', // Яркий желтый
        borderColor: '#F1C40F', // Золотистый контур
        glowColor: '#F4D03F',
        glowSize: 4,
        complexity: 7,
        theme: randomTheme
      };
    case 'epic':
      return {
        backgroundColor: '#FDEDEC', // Светло-розовый фон
        primaryColor: '#3498DB', // Яркий синий
        secondaryColor: '#E74C3C', // Яркий красный
        borderColor: '#C0392B', // Насыщенный красный контур
        glowColor: '#E74C3C',
        glowSize: 5,
        complexity: 8,
        theme: randomTheme
      };
    case 'legendary':
      return {
        backgroundColor: '#F4ECF7', // Светло-фиолетовый фон
        primaryColor: '#F1C40F', // Золотистый
        secondaryColor: '#9B59B6', // Насыщенный фиолетовый
        borderColor: '#8E44AD', // Темно-фиолетовый контур
        glowColor: '#F1C40F', // Золотистое свечение
        glowSize: 7,
        complexity: 10,
        theme: randomTheme
      };
  }
}

/**
 * Генерирует содержимое SVG файла в мультяшном стиле
 * с элементами роскошной жизни (машины, яхты, особняки и т.д.)
 */
function generateSVGContent(styles: {
  backgroundColor: string;
  primaryColor: string;
  secondaryColor: string;
  borderColor: string;
  glowColor: string;
  glowSize: number;
  complexity: number;
  theme: 'car' | 'yacht' | 'mansion' | 'jet' | 'character';
}): string {
  const { backgroundColor, primaryColor, secondaryColor, borderColor, glowColor, glowSize, complexity, theme } = styles;
  
  // Создаем фильтр для свечения
  const glowFilter = glowSize > 0 ? `
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="${glowSize}" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  ` : '';
  
  // Создаем фильтр для мультяшного стиля
  const cartoonFilter = `
    <filter id="cartoon">
      <feColorMatrix type="matrix" values="1 0 0 0 0
                                          0 1 0 0 0
                                          0 0 1 0 0
                                          0 0 0 20 -10" />
      <feGaussianBlur stdDeviation="0.5" />
    </filter>
  `;
  
  // Шаблоны роскошных объектов в SVG
  const luxuryElements = {
    car: `
      <g transform="translate(100, 180) scale(1.5)">
        <!-- Супер-роскошная спортивная машина в стиле мультфильма -->
        <!-- Кузов машины - обтекаемый спорткар -->
        <path d="M0,60 C10,50 30,45 50,45 L100,45 C120,45 135,50 140,60 L140,70 C140,75 135,80 130,80 L10,80 C5,80 0,75 0,70 Z" 
              fill="${primaryColor}" stroke="${borderColor}" stroke-width="2" />
        
        <!-- Верхняя часть (крыша) -->
        <path d="M35,45 C40,25 80,25 105,45" 
              fill="none" stroke="${borderColor}" stroke-width="2" />
        
        <!-- Передняя часть (капот) -->
        <path d="M0,60 C5,55 15,52 25,50" 
              fill="none" stroke="${borderColor}" stroke-width="2" />
        
        <!-- Колеса с блестящими дисками -->
        <circle cx="30" cy="80" r="15" fill="#333" stroke="black" stroke-width="2" />
        <circle cx="30" cy="80" r="10" fill="#777" />
        <circle cx="30" cy="80" r="5" fill="#DDD" />
        <circle cx="30" cy="80" r="3" fill="#FFF" />
        
        <circle cx="110" cy="80" r="15" fill="#333" stroke="black" stroke-width="2" />
        <circle cx="110" cy="80" r="10" fill="#777" />
        <circle cx="110" cy="80" r="5" fill="#DDD" />
        <circle cx="110" cy="80" r="3" fill="#FFF" />
        
        <!-- Окна тонированные -->
        <path d="M40,45 C45,30 75,30 100,45" 
              fill="#88CCFF" stroke="${borderColor}" stroke-width="1" />
        
        <!-- Фары супер-яркие -->
        <circle cx="15" cy="55" r="7" fill="#FFFF88" />
        <circle cx="15" cy="55" r="5" fill="#FFFFFF" />
        <circle cx="125" cy="55" r="7" fill="#FFFF88" />
        <circle cx="125" cy="55" r="5" fill="#FFFFFF" />
        
        <!-- Металлические детали и блики -->
        <rect x="55" y="35" width="30" height="3" rx="1" fill="#DDD" />
        <path d="M15,65 L125,65" stroke="#FFF" stroke-width="1" opacity="0.5" />
        
        <!-- Эффект переливающейся краски -->
        <path d="M20,50 C40,40 100,40 120,50" 
              fill="none" stroke="#FFF" stroke-width="2" opacity="0.3" />
              
        <!-- Значок роскошного бренда -->
        <circle cx="70" cy="60" r="5" fill="gold" />
        <text x="70" y="63" font-family="Arial" font-size="6" font-weight="bold" text-anchor="middle" fill="#222">$</text>
      </g>
    `,
    
    yacht: `
      <g transform="translate(50, 150) scale(1.2)">
        <!-- Корпус яхты -->
        <path d="M50,100 L20,150 L280,150 L250,100 Z" fill="${primaryColor}" />
        
        <!-- Палуба -->
        <rect x="70" y="80" width="160" height="30" rx="5" fill="${secondaryColor}" />
        
        <!-- Мачта и парус -->
        <rect x="150" y="30" width="5" height="80" fill="#8B4513" />
        <path d="M155,35 Q200,50 180,90 L155,90 Z" fill="white" />
        
        <!-- Окна -->
        <circle cx="100" cy="95" r="5" fill="#88CCFF" />
        <circle cx="120" cy="95" r="5" fill="#88CCFF" />
        <circle cx="180" cy="95" r="5" fill="#88CCFF" />
        <circle cx="200" cy="95" r="5" fill="#88CCFF" />
        
        <!-- Вода -->
        <path d="M0,150 Q100,170 150,150 Q200,130 300,150 L300,200 L0,200 Z" fill="#3498DB" opacity="0.5" />
      </g>
    `,
    
    mansion: `
      <g transform="translate(100, 100) scale(1.3)">
        <!-- Основное здание -->
        <rect x="50" y="80" width="150" height="120" fill="${primaryColor}" />
        
        <!-- Крыша -->
        <polygon points="50,80 125,30 200,80" fill="${secondaryColor}" />
        
        <!-- Окна -->
        <rect x="70" y="100" width="25" height="35" fill="#88CCFF" />
        <rect x="110" y="100" width="25" height="35" fill="#88CCFF" />
        <rect x="150" y="100" width="25" height="35" fill="#88CCFF" />
        <rect x="70" y="150" width="25" height="35" fill="#88CCFF" />
        <rect x="150" y="150" width="25" height="35" fill="#88CCFF" />
        
        <!-- Дверь -->
        <rect x="110" y="150" width="30" height="50" fill="#8B4513" />
        <circle cx="130" cy="175" r="3" fill="gold" />
        
        <!-- Деревья -->
        <circle cx="25" cy="170" r="20" fill="#2ECC71" />
        <rect x="20" y="170" width="10" height="30" fill="#8B4513" />
        <circle cx="225" cy="170" r="20" fill="#2ECC71" />
        <rect x="220" y="170" width="10" height="30" fill="#8B4513" />
      </g>
    `,
    
    jet: `
      <g transform="translate(50, 150) scale(1.5)">
        <!-- Корпус самолета -->
        <path d="M50,60 L200,60 L220,80 L200,100 L50,100 L30,80 Z" fill="${primaryColor}" />
        
        <!-- Хвост -->
        <polygon points="200,60 240,20 240,50 220,80" fill="${secondaryColor}" />
        
        <!-- Крылья -->
        <path d="M100,60 L40,20 L60,60 Z" fill="${secondaryColor}" />
        <path d="M100,100 L40,140 L60,100 Z" fill="${secondaryColor}" />
        
        <!-- Окна -->
        <rect x="60" y="70" width="10" height="10" rx="2" fill="#88CCFF" />
        <rect x="80" y="70" width="10" height="10" rx="2" fill="#88CCFF" />
        <rect x="100" y="70" width="10" height="10" rx="2" fill="#88CCFF" />
        <rect x="120" y="70" width="10" height="10" rx="2" fill="#88CCFF" />
        <rect x="140" y="70" width="10" height="10" rx="2" fill="#88CCFF" />
        
        <!-- Облака -->
        <ellipse cx="140" cy="20" rx="25" ry="15" fill="white" opacity="0.7" />
        <ellipse cx="180" cy="40" rx="20" ry="10" fill="white" opacity="0.7" />
        <ellipse cx="90" cy="30" rx="30" ry="15" fill="white" opacity="0.7" />
      </g>
    `,
    
    character: `
      <g transform="translate(100, 100) scale(1.3)">
        <!-- Роскошный мультяшный персонаж-блондин в стиле DuckTales -->
        
        <!-- Голова с шикарной блондинистой прической -->
        <circle cx="100" cy="70" r="40" fill="#FFF9C4" /> <!-- Лицо -->
        
        <!-- Роскошная блондинистая прическа -->
        <path d="M60,50 C75,20 125,20 140,50" fill="#FFD700" stroke="#E6C200" stroke-width="1" /> <!-- Верхняя часть волос -->
        <path d="M60,50 C75,90 125,90 140,50" fill="#FFD700" /> <!-- Боковые волосы -->
        <path d="M60,50 Q100,95 140,50" fill="#FFD700" /> <!-- Нижняя часть волос -->
        
        <!-- Блики на волосах -->
        <path d="M80,40 Q100,30 120,40" fill="none" stroke="#FFFFFF" stroke-width="2" opacity="0.7" />
        <path d="M70,60 Q90,50 110,60" fill="none" stroke="#FFFFFF" stroke-width="2" opacity="0.5" />
        
        <!-- Выразительные голубые глаза -->
        <ellipse cx="85" cy="65" rx="6" ry="8" fill="white" stroke="#333" stroke-width="1" />
        <circle cx="85" cy="65" r="4" fill="#3498DB" />
        <circle cx="83" cy="63" r="2" fill="white" opacity="0.7" /> <!-- Блик в глазу -->
        
        <ellipse cx="115" cy="65" rx="6" ry="8" fill="white" stroke="#333" stroke-width="1" />
        <circle cx="115" cy="65" r="4" fill="#3498DB" />
        <circle cx="113" cy="63" r="2" fill="white" opacity="0.7" /> <!-- Блик в глазу -->
        
        <!-- Брови -->
        <path d="M75,55 Q85,50 95,55" fill="none" stroke="#333" stroke-width="2" />
        <path d="M105,55 Q115,50 125,55" fill="none" stroke="#333" stroke-width="2" />
        
        <!-- Улыбка -->
        <path d="M85,80 Q100,95 115,80" fill="none" stroke="#E74C3C" stroke-width="3" />
        
        <!-- Модный костюм -->
        <rect x="80" y="110" width="40" height="60" rx="5" fill="${primaryColor}" stroke="#333" stroke-width="1" />
        <rect x="90" y="110" width="20" height="60" fill="${secondaryColor}" opacity="0.7" />
        <circle cx="100" cy="120" r="5" fill="gold" /> <!-- Золотая пуговица на костюме -->
        <circle cx="100" cy="135" r="5" fill="gold" /> <!-- Вторая золотая пуговица -->
        
        <!-- Галстук/бабочка -->
        <path d="M95,110 L105,110 L105,120 L100,125 L95,120 Z" fill="#E74C3C" />
        
        <!-- Руки с золотыми часами и браслетами -->
        <path d="M80,115 C50,100 40,130 50,150" fill="#FFF9C4" stroke="#333" stroke-width="1" /> <!-- Левая рука -->
        <path d="M120,115 C150,100 160,130 150,150" fill="#FFF9C4" stroke="#333" stroke-width="1" /> <!-- Правая рука -->
        
        <!-- Золотые аксессуары на руках -->
        <circle cx="45" cy="135" r="8" fill="gold" stroke="#333" stroke-width="1" /> <!-- Шикарные золотые часы -->
        <rect x="43" y="135" width="4" height="2" fill="#333" /> <!-- Циферблат часов -->
        <rect x="150" y="125" width="10" height="5" rx="2" fill="gold" stroke="#333" stroke-width="1" /> <!-- Золотой браслет -->
        <circle cx="155" cy="127" r="1" fill="#F50" /> <!-- Рубин на браслете -->
        
        <!-- Роскошные брюки -->
        <path d="M80,170 L90,170 L90,200 L80,200 Z" fill="#333" /> <!-- Левая штанина -->
        <path d="M110,170 L120,170 L120,200 L110,200 Z" fill="#333" /> <!-- Правая штанина -->
        
        <!-- Шикарные туфли -->
        <path d="M75,200 L90,200 L92,205 L75,205 Z" fill="#8B4513" stroke="#333" stroke-width="1" /> <!-- Левый ботинок -->
        <path d="M110,200 L125,200 L127,205 L110,205 Z" fill="#8B4513" stroke="#333" stroke-width="1" /> <!-- Правый ботинок -->
        
        <!-- Стильные солнечные очки на макушке -->
        <path d="M70,35 Q100,25 130,35" fill="none" stroke="#333" stroke-width="2" />
        <ellipse cx="80" cy="35" rx="10" ry="5" fill="#8E44AD" opacity="0.7" stroke="#333" stroke-width="1" />
        <ellipse cx="120" cy="35" rx="10" ry="5" fill="#8E44AD" opacity="0.7" stroke="#333" stroke-width="1" />
        
        <!-- Золотая цепь с долларом - символ богатства -->
        <path d="M85,125 Q100,135 115,125" fill="none" stroke="gold" stroke-width="3" />
        <circle cx="100" cy="135" r="10" fill="gold" stroke="#333" stroke-width="1" />
        <text x="100" y="140" font-family="Arial" font-size="16" font-weight="bold" text-anchor="middle" fill="#333">$</text>
      </g>
    `
  };
  
  // Генерируем декоративные элементы в стиле мультфильма
  let cartoonDecorations = '';
  for (let i = 0; i < complexity - 3; i++) {
    const decorSize = 15 + Math.random() * 30;
    const x = 20 + Math.random() * 360;
    const y = 20 + Math.random() * 360;
    
    // Звезды, облака, монеты и другие элементы мультяшного стиля
    const decorType = Math.floor(Math.random() * 4);
    
    if (decorType === 0) {
      // Звезда (символ роскоши)
      const points = [];
      const spikes = 5;
      const outerRadius = decorSize;
      const innerRadius = decorSize / 2;
      
      for (let j = 0; j < spikes * 2; j++) {
        const radius = j % 2 === 0 ? outerRadius : innerRadius;
        const angle = (j * Math.PI) / spikes;
        points.push(`${x + radius * Math.cos(angle)},${y + radius * Math.sin(angle)}`);
      }
      
      cartoonDecorations += `<polygon points="${points.join(' ')}" fill="#FFD700" ${glowSize > 0 ? 'filter="url(#glow)"' : ''} />`;
    } else if (decorType === 1) {
      // Облако
      cartoonDecorations += `
        <g transform="translate(${x}, ${y}) scale(${decorSize / 30})">
          <ellipse cx="0" cy="0" rx="15" ry="10" fill="white" opacity="0.7" />
          <ellipse cx="10" cy="-5" rx="10" ry="8" fill="white" opacity="0.7" />
          <ellipse cx="-10" cy="-3" rx="12" ry="7" fill="white" opacity="0.7" />
        </g>
      `;
    } else if (decorType === 2) {
      // Монета (символ богатства)
      cartoonDecorations += `
        <circle cx="${x}" cy="${y}" r="${decorSize}" fill="#FFD700" ${glowSize > 0 ? 'filter="url(#glow)"' : ''} />
        <text x="${x}" y="${y + 5}" font-family="Arial" font-size="${decorSize / 2}" font-weight="bold" text-anchor="middle" fill="#F1C40F">$</text>
      `;
    } else {
      // Бриллиант
      cartoonDecorations += `
        <polygon points="${x},${y - decorSize} ${x + decorSize / 2},${y} ${x},${y + decorSize} ${x - decorSize / 2},${y}" 
                fill="#5DADE2" opacity="0.8" ${glowSize > 0 ? 'filter="url(#glow)"' : ''} />
        <line x1="${x - decorSize / 4}" y1="${y - decorSize / 4}" x2="${x + decorSize / 4}" y2="${y + decorSize / 4}" 
              stroke="white" opacity="0.8" stroke-width="2" />
      `;
    }
  }
  
  // Создаем SVG
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
      <defs>
        ${glowFilter}
        ${cartoonFilter}
        
        <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${backgroundColor}" />
          <stop offset="100%" stop-color="${secondaryColor}" />
        </linearGradient>
        
        <pattern id="pattern1" width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="10" cy="10" r="2" fill="${primaryColor}" opacity="0.3" />
        </pattern>
      </defs>
      
      <!-- Фон -->
      <rect width="400" height="400" fill="url(#grad1)" />
      <rect width="400" height="400" fill="url(#pattern1)" />
      
      <!-- Декоративные элементы -->
      ${cartoonDecorations}
      
      <!-- Основной роскошный элемент в зависимости от темы -->
      ${luxuryElements[theme]}
      
      <!-- Рамка -->
      <rect width="390" height="390" x="5" y="5" stroke="${borderColor}" stroke-width="3" fill="none" rx="15" ry="15" />
      
      <!-- Надпись Bnalbank -->
      <text x="200" y="380" font-family="Arial, sans-serif" font-size="18" font-weight="bold" text-anchor="middle" fill="white">Bnalbank Luxury NFT</text>
    </svg>
  `;
}
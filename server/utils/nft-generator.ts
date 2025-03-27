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
 */
function getRarityStyles(rarity: NFTRarity): {
  backgroundColor: string;
  primaryColor: string;
  secondaryColor: string;
  borderColor: string;
  glowColor: string;
  glowSize: number;
  complexity: number;
} {
  switch (rarity) {
    case 'common':
      return {
        backgroundColor: '#2d3748',
        primaryColor: '#718096',
        secondaryColor: '#4a5568',
        borderColor: '#4a5568',
        glowColor: '#4a5568',
        glowSize: 0,
        complexity: 3
      };
    case 'uncommon':
      return {
        backgroundColor: '#276749',
        primaryColor: '#48bb78',
        secondaryColor: '#38a169',
        borderColor: '#2f855a',
        glowColor: '#48bb78',
        glowSize: 2,
        complexity: 4
      };
    case 'rare':
      return {
        backgroundColor: '#2b6cb0',
        primaryColor: '#4299e1',
        secondaryColor: '#3182ce',
        borderColor: '#2c5282',
        glowColor: '#4299e1',
        glowSize: 3,
        complexity: 5
      };
    case 'epic':
      return {
        backgroundColor: '#6b46c1',
        primaryColor: '#9f7aea',
        secondaryColor: '#805ad5',
        borderColor: '#553c9a',
        glowColor: '#9f7aea',
        glowSize: 4,
        complexity: 6
      };
    case 'legendary':
      return {
        backgroundColor: '#d69e2e',
        primaryColor: '#f6e05e',
        secondaryColor: '#ecc94b',
        borderColor: '#b7791f',
        glowColor: '#f6e05e',
        glowSize: 5,
        complexity: 7
      };
  }
}

/**
 * Генерирует содержимое SVG файла
 */
function generateSVGContent(styles: {
  backgroundColor: string;
  primaryColor: string;
  secondaryColor: string;
  borderColor: string;
  glowColor: string;
  glowSize: number;
  complexity: number;
}): string {
  const { backgroundColor, primaryColor, secondaryColor, borderColor, glowColor, glowSize, complexity } = styles;
  
  // Создаем фильтр для свечения
  const glowFilter = glowSize > 0 ? `
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="${glowSize}" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  ` : '';
  
  // Генерируем случайные формы в зависимости от сложности
  let shapes = '';
  for (let i = 0; i < complexity; i++) {
    const shapeSize = 30 + Math.random() * 100;
    const x = Math.random() * 300;
    const y = Math.random() * 300;
    
    // Выбираем случайную форму (круг, прямоугольник, многоугольник)
    const shapeType = Math.floor(Math.random() * 3);
    
    if (shapeType === 0) {
      // Круг
      shapes += `<circle cx="${x}" cy="${y}" r="${shapeSize / 2}" fill="${i % 2 === 0 ? primaryColor : secondaryColor}" ${glowSize > 0 ? 'filter="url(#glow)"' : ''} />`;
    } else if (shapeType === 1) {
      // Прямоугольник с закругленными углами
      shapes += `<rect x="${x}" y="${y}" width="${shapeSize}" height="${shapeSize}" rx="10" ry="10" fill="${i % 2 === 0 ? primaryColor : secondaryColor}" ${glowSize > 0 ? 'filter="url(#glow)"' : ''} />`;
    } else {
      // Многоугольник (шестиугольник)
      const points = [];
      const sides = 6;
      for (let j = 0; j < sides; j++) {
        const angle = (j * 2 * Math.PI) / sides;
        points.push(`${x + shapeSize * Math.cos(angle)},${y + shapeSize * Math.sin(angle)}`);
      }
      shapes += `<polygon points="${points.join(' ')}" fill="${i % 2 === 0 ? primaryColor : secondaryColor}" ${glowSize > 0 ? 'filter="url(#glow)"' : ''} />`;
    }
  }
  
  // Создаем SVG
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
      <defs>
        ${glowFilter}
        
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
      
      <!-- Случайные формы -->
      ${shapes}
      
      <!-- Рамка -->
      <rect width="390" height="390" x="5" y="5" stroke="${borderColor}" stroke-width="3" fill="none" rx="15" ry="15" />
      
      <!-- Надпись Bnalbank -->
      <text x="200" y="375" font-family="Arial, sans-serif" font-size="14" text-anchor="middle" fill="white">Bnalbank NFT</text>
    </svg>
  `;
}
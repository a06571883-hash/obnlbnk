/**
 * Скрипт для проверки и замены иконок/логотипов на правильные изображения обезьян
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Загрузка переменных окружения
dotenv.config();

// Создание пула подключений к PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Находит все NFT с изображениями, которые могут быть иконками или логотипами
 */
async function findIconsAndLogos() {
  // Ищем вероятные иконки и логотипы по размеру изображения, если файл существует
  console.log('Поиск возможных иконок/логотипов среди NFT...');
  
  const result = await pool.query(`
    SELECT id, token_id, name, image_path, collection_id FROM nfts
  `);
  
  const suspiciousNFTs = [];
  
  for (const nft of result.rows) {
    // Убираем начальный слеш, если он есть
    const imagePath = nft.image_path.startsWith('/') ? nft.image_path.substring(1) : nft.image_path;
    
    // Проверяем, существует ли файл
    if (fs.existsSync(imagePath)) {
      try {
        // Получаем размер файла
        const stats = fs.statSync(imagePath);
        const fileSizeInKB = stats.size / 1024;
        
        // Подозрительные NFT: маленькие файлы (вероятно, иконки) или очень большие файлы (баннеры)
        if (fileSizeInKB < 30 || fileSizeInKB > 500) {
          suspiciousNFTs.push({
            id: nft.id,
            token_id: nft.token_id,
            name: nft.name,
            image_path: nft.image_path,
            collection_id: nft.collection_id,
            file_size_kb: fileSizeInKB
          });
        }
      } catch (error) {
        console.error(`Ошибка при проверке файла ${imagePath}:`, error.message);
      }
    } else {
      // Если файл не существует, тоже добавляем в подозрительные
      suspiciousNFTs.push({
        id: nft.id,
        token_id: nft.token_id,
        name: nft.name,
        image_path: nft.image_path,
        collection_id: nft.collection_id,
        file_size_kb: 0,
        file_missing: true
      });
    }
  }
  
  console.log(`Найдено ${suspiciousNFTs.length} подозрительных NFT`);
  return suspiciousNFTs;
}

/**
 * Заменяет изображения подозрительных NFT на нормальные обезьяньи изображения
 */
async function replaceIconsWithApes(suspiciousNFTs) {
  console.log('Замена подозрительных изображений на обезьяньи...');
  
  for (const nft of suspiciousNFTs) {
    // Определяем новое изображение на основе коллекции и token_id
    let newImagePath;
    
    if (nft.collection_id === 1) {
      // Bored Ape Yacht Club - используем модуль от количества доступных изображений
      const imageNumber = (parseInt(nft.token_id) % 773) + 1;
      newImagePath = `/bored_ape_nft/bored_ape_${imageNumber}.png`;
    } else if (nft.collection_id === 2) {
      // Mutant Ape Yacht Club - используем SVG
      const imageNumber = (parseInt(nft.token_id) % 1000) + 10001;
      newImagePath = `/mutant_ape_nft/mutant_ape_${imageNumber}.svg`;
    } else {
      console.log(`Пропуск NFT ${nft.id} с неизвестной коллекцией ${nft.collection_id}`);
      continue;
    }
    
    // Обновляем путь к изображению в базе данных
    try {
      await pool.query(`
        UPDATE nfts
        SET image_path = $1, original_image_path = $1
        WHERE id = $2
      `, [newImagePath, nft.id]);
      
      console.log(`Заменено изображение для NFT ${nft.id} (${nft.name}): ${nft.image_path} -> ${newImagePath}`);
    } catch (error) {
      console.error(`Ошибка при обновлении пути для NFT ${nft.id}:`, error.message);
    }
  }
  
  console.log(`Заменено изображений: ${suspiciousNFTs.length}`);
}

/**
 * Поиск NFT с "подозрительными" именами (содержащими ключевые слова)
 */
async function findSuspiciousNames() {
  console.log('Поиск NFT с подозрительными именами...');
  
  const result = await pool.query(`
    SELECT id, token_id, name, image_path, collection_id FROM nfts
    WHERE 
      name ILIKE '%logo%' OR 
      name ILIKE '%icon%' OR 
      name ILIKE '%avatar%' OR 
      name ILIKE '%banner%' OR
      name ILIKE '%background%' OR
      name ILIKE '%opensea%' OR
      name ILIKE '%core%' OR
      name ILIKE '%ship%' OR
      name NOT ILIKE '%ape%'
  `);
  
  console.log(`Найдено ${result.rows.length} NFT с подозрительными именами`);
  return result.rows;
}

/**
 * Фиксирует имена NFT, чтобы они соответствовали коллекциям
 */
async function fixNFTNames(suspiciousNFTs) {
  console.log('Исправление названий NFT...');
  
  for (const nft of suspiciousNFTs) {
    let newName;
    
    if (nft.collection_id === 1) {
      newName = `Bored Ape #${nft.token_id}`;
    } else if (nft.collection_id === 2) {
      newName = `Mutant Ape #${nft.token_id - 10000}`;
    } else {
      continue;
    }
    
    try {
      await pool.query(`
        UPDATE nfts
        SET name = $1
        WHERE id = $2
      `, [newName, nft.id]);
      
      console.log(`Исправлено название для NFT ${nft.id}: "${nft.name}" -> "${newName}"`);
    } catch (error) {
      console.error(`Ошибка при обновлении названия для NFT ${nft.id}:`, error.message);
    }
  }
  
  console.log(`Исправлено названий: ${suspiciousNFTs.length}`);
}

/**
 * Создает необходимые SVG для Mutant Ape
 */
function createMutantApeSVGs() {
  console.log('Создание SVG для Mutant Ape...');
  
  const mutantApeDir = './mutant_ape_nft';
  if (!fs.existsSync(mutantApeDir)) {
    fs.mkdirSync(mutantApeDir, { recursive: true });
  }
  
  for (let i = 10001; i <= 11000; i++) {
    const svgPath = path.join(mutantApeDir, `mutant_ape_${i}.svg`);
    if (!fs.existsSync(svgPath)) {
      try {
        createMutantApeSVG(svgPath, i);
      } catch (error) {
        console.error(`Ошибка при создании SVG для Mutant Ape ${i}:`, error.message);
      }
    }
  }
  
  console.log('Создано SVG для всех Mutant Ape (10001-11000)');
}

/**
 * Создает SVG изображение для Mutant Ape
 */
function createMutantApeSVG(filePath, id) {
  const colors = [
    '#1abc9c', '#2ecc71', '#3498db', '#9b59b6', '#34495e',
    '#f1c40f', '#e67e22', '#e74c3c', '#ecf0f1', '#95a5a6'
  ];
  
  const faceColors = [
    '#cdab8f', '#e0bb95', '#dfbd99', '#eecfb4', '#d29b68',
    '#a97c50', '#845d3d', '#513a2a', '#4d3629', '#36261e' 
  ];
  
  const color1 = colors[Math.floor(Math.random() * colors.length)];
  const color2 = colors[Math.floor(Math.random() * colors.length)];
  const faceColor = faceColors[Math.floor(Math.random() * faceColors.length)];
  
  const uniqueId = Math.floor(1000 + Math.random() * 9000);
  const eyeType = Math.random() > 0.5 ? 'circle' : 'ellipse';
  const eyeSize = 5 + Math.floor(Math.random() * 10);
  const mouthWidth = 20 + Math.floor(Math.random() * 40);
  
  // Создаем SVG контент с четким изображением обезьяны
  const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
    <style>
      .mutant-ape { font-family: 'Arial', sans-serif; }
      @keyframes mutate {
        0% { transform: scale(1); }
        50% { transform: scale(1.05); }
        100% { transform: scale(1); }
      }
      .animated { animation: mutate 3s infinite; }
    </style>
    <rect width="200" height="200" fill="${color1}" />
    <rect x="20" y="20" width="160" height="160" rx="15" fill="${color2}" class="animated" />
    
    <!-- Голова обезьяны -->
    <circle cx="100" cy="90" r="60" fill="${faceColor}" />
    
    <!-- Уши -->
    <ellipse cx="45" cy="70" rx="15" ry="25" fill="${faceColor}" />
    <ellipse cx="155" cy="70" rx="15" ry="25" fill="${faceColor}" />
    
    <!-- Глаза -->
    <${eyeType} cx="70" cy="80" rx="${eyeSize}" ry="${eyeSize}" fill="white" />
    <${eyeType} cx="130" cy="80" rx="${eyeSize}" ry="${eyeSize}" fill="white" />
    <circle cx="70" cy="80" r="3" fill="black" />
    <circle cx="130" cy="80" r="3" fill="black" />
    
    <!-- Нос -->
    <ellipse cx="100" cy="100" rx="10" ry="5" fill="#333" />
    
    <!-- Рот -->
    <path d="M${100 - mouthWidth/2},120 Q100,${130 + Math.random() * 10} ${100 + mouthWidth/2},120" fill="none" stroke="#333" stroke-width="3" />
    
    <!-- Метка коллекции -->
    <text x="40" y="170" fill="white" font-weight="bold" font-size="12" class="mutant-ape">Mutant Ape #${id-10000}</text>
    <text x="40" y="185" fill="white" font-size="10" class="mutant-ape">ID: MAYC-${uniqueId}</text>
  </svg>`;
  
  fs.writeFileSync(filePath, svgContent);
}

/**
 * Рандомизирует порядок отображения NFT
 */
async function randomizeOrder() {
  console.log('Рандомизация порядка отображения NFT...');
  
  await pool.query(`
    UPDATE nfts 
    SET sort_order = (RANDOM() * 20000)::INTEGER
  `);
  
  console.log('Порядок отображения NFT успешно перемешан');
}

/**
 * Основная функция
 */
async function main() {
  try {
    console.log('Запуск скрипта для проверки и замены иконок/логотипов...');
    
    // Создаем SVG для Mutant Ape (если нужно)
    createMutantApeSVGs();
    
    // Находим подозрительные файлы
    const suspiciousNFTs = await findIconsAndLogos();
    
    // Заменяем подозрительные изображения на обезьяньи
    await replaceIconsWithApes(suspiciousNFTs);
    
    // Находим NFT с подозрительными именами
    const suspiciousNames = await findSuspiciousNames();
    
    // Исправляем названия NFT
    await fixNFTNames(suspiciousNames);
    
    // Перемешиваем порядок отображения NFT
    await randomizeOrder();
    
    console.log('Скрипт успешно завершен!');
  } catch (error) {
    console.error('Ошибка выполнения скрипта:', error);
  } finally {
    // Закрываем соединение с базой данных
    await pool.end();
  }
}

// Запускаем скрипт
main();
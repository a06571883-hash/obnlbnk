/**
 * Скрипт для фильтрации NFT по путям к изображениям и удаления всех, 
 * которые не являются настоящими изображениями обезьян
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
 * Получает все пути к изображениям из базы данных
 */
async function getAllImagePaths() {
  const result = await pool.query(`
    SELECT id, image_path, token_id FROM nfts
  `);
  
  return result.rows;
}

/**
 * Фильтрует NFT, оставляя только те, которые содержат настоящие изображения обезьян
 */
async function filterNonApeNFT() {
  const nftList = await getAllImagePaths();
  console.log(`Получено ${nftList.length} NFT для проверки`);
  
  let deletedCount = 0;
  
  // Строка для записи удаленных NFT для журнала
  let deletedLog = "ID,TokenID,ImagePath\n";
  
  for (const nft of nftList) {
    const imagePath = nft.image_path;
    const isApe = isApeImage(imagePath);
    
    if (!isApe) {
      try {
        // Сначала удаляем связанные трансферы
        await pool.query(`
          DELETE FROM nft_transfers 
          WHERE nft_id = $1
        `, [nft.id]);
        
        // Затем удаляем само NFT
        await pool.query(`
          DELETE FROM nfts 
          WHERE id = $1
        `, [nft.id]);
        
        deletedCount++;
        deletedLog += `${nft.id},${nft.token_id},${imagePath}\n`;
        
        if (deletedCount % 10 === 0) {
          console.log(`Удалено ${deletedCount} не-обезьян NFT`);
        }
      } catch (error) {
        console.error(`Ошибка при удалении NFT ${nft.id}:`, error.message);
      }
    }
  }
  
  console.log(`Всего удалено ${deletedCount} NFT, которые не являются обезьянами`);
  
  // Записываем лог удаленных NFT в файл
  try {
    fs.writeFileSync('deleted_nft_log.csv', deletedLog);
    console.log('Лог удаленных NFT сохранен в deleted_nft_log.csv');
  } catch (error) {
    console.error('Ошибка при сохранении лога:', error.message);
  }
  
  return deletedCount;
}

/**
 * Проверяет, является ли изображение обезьяной по пути к файлу
 */
function isApeImage(imagePath) {
  if (!imagePath) return false;
  
  // Нормализуем путь (удаляем начальный слеш)
  const normalizedPath = imagePath.startsWith('/') ? imagePath.substring(1) : imagePath;
  
  // Проверяем ключевые слова в пути
  const lowerPath = normalizedPath.toLowerCase();
  
  // Проверяем, является ли это изображением Bored Ape
  if (lowerPath.includes('bored_ape') && lowerPath.endsWith('.png')) {
    return true;
  }
  
  // Проверяем, является ли это изображением Mutant Ape
  if (lowerPath.includes('mutant_ape') && (lowerPath.endsWith('.png') || lowerPath.endsWith('.svg'))) {
    return true;
  }
  
  // Исключаем все остальные пути, которые могут содержать ключевые слова
  if (lowerPath.includes('logo') || lowerPath.includes('icon') || 
      lowerPath.includes('banner') || lowerPath.includes('opensea') ||
      lowerPath.includes('avatar') || lowerPath.includes('background')) {
    return false;
  }
  
  return false;
}

/**
 * Создает SVG для Mutant Ape с номерами от 10001 до 11000
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
      createMutantApeSVG(svgPath, i);
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
    <text x="50" y="170" fill="white" font-weight="bold" font-size="12" class="mutant-ape">Mutant Ape #${id-10000}</text>
    <text x="50" y="185" fill="white" font-size="10" class="mutant-ape">ID: MAYC-${uniqueId}</text>
  </svg>`;
  
  fs.writeFileSync(filePath, svgContent);
}

/**
 * Обновляет пути к изображениям для всех NFT
 */
async function updateImagePaths() {
  console.log('Обновление путей к изображениям для всех NFT...');
  
  // Обновляем пути для Bored Ape
  console.log('Обновление путей для коллекции Bored Ape Yacht Club...');
  
  await pool.query(`
    UPDATE nfts 
    SET 
      image_path = CONCAT('/bored_ape_nft/bored_ape_', 
        (MOD(CAST(token_id AS INTEGER), 773) + 1), '.png'),
      original_image_path = CONCAT('/bored_ape_nft/bored_ape_', 
        (MOD(CAST(token_id AS INTEGER), 773) + 1), '.png')
    WHERE collection_id = 1
  `);
  
  // Обновляем пути для Mutant Ape
  console.log('Обновление путей для коллекции Mutant Ape Yacht Club...');
  
  await pool.query(`
    UPDATE nfts 
    SET 
      image_path = CONCAT('/mutant_ape_nft/mutant_ape_', 
        (MOD(CAST(token_id AS INTEGER) - 10000, 1000) + 10001), '.svg'),
      original_image_path = CONCAT('/mutant_ape_nft/mutant_ape_', 
        (MOD(CAST(token_id AS INTEGER) - 10000, 1000) + 10001), '.svg')
    WHERE collection_id = 2
  `);
  
  console.log('Пути к изображениям обновлены');
}

/**
 * Перемешивает порядок отображения NFT
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
 * Очищает директории от неподходящих файлов
 */
function cleanDirectories() {
  console.log('Очистка директорий от неподходящих файлов...');
  
  const boredApeDir = './bored_ape_nft';
  const mutantApeDir = './mutant_ape_nft';
  
  if (fs.existsSync(boredApeDir)) {
    const files = fs.readdirSync(boredApeDir);
    let removedCount = 0;
    
    for (const file of files) {
      if (!file.match(/^bored_ape_\d+\.png$/)) {
        try {
          fs.unlinkSync(path.join(boredApeDir, file));
          removedCount++;
        } catch (error) {
          console.error(`Ошибка при удалении файла ${file}:`, error.message);
        }
      }
    }
    
    console.log(`Удалено ${removedCount} неподходящих файлов из ${boredApeDir}`);
  }
  
  if (fs.existsSync(mutantApeDir)) {
    const files = fs.readdirSync(mutantApeDir);
    let removedCount = 0;
    
    for (const file of files) {
      if (!file.match(/^mutant_ape_\d+\.(svg|png)$/)) {
        try {
          fs.unlinkSync(path.join(mutantApeDir, file));
          removedCount++;
        } catch (error) {
          console.error(`Ошибка при удалении файла ${file}:`, error.message);
        }
      }
    }
    
    console.log(`Удалено ${removedCount} неподходящих файлов из ${mutantApeDir}`);
  }
}

/**
 * Основная функция
 */
async function main() {
  try {
    console.log('Запуск скрипта фильтрации NFT...');
    
    // Очищаем директории от неподходящих файлов
    cleanDirectories();
    
    // Создаем SVG для Mutant Ape
    createMutantApeSVGs();
    
    // Фильтруем NFT, оставляя только обезьян
    await filterNonApeNFT();
    
    // Обновляем пути к изображениям
    await updateImagePaths();
    
    // Перемешиваем порядок отображения
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
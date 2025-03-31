/**
 * Скрипт для исправления путей к изображениям NFT
 * и перемешивания порядка отображения в маркетплейсе
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const crypto = require('crypto');
const dotenv = require('dotenv');

// Загрузка переменных окружения
dotenv.config();

// Создание пула подключений к PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Создает директории для хранения изображений NFT
 */
async function createDirectories() {
  const dirs = [
    './nft_assets/bored_ape',
    './nft_assets/mutant_ape'
  ];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      console.log(`Создание директории ${dir}...`);
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

/**
 * Копирует изображения из temp_extract в структурированные директории
 */
async function copyExtractedImages() {
  console.log('Копирование извлеченных изображений в целевые директории...');
  
  // Найти все PNG файлы в temp_extract (без дубликатов с (1) или (2) в имени)
  const files = fs.readdirSync('./temp_extract')
    .filter(file => file.endsWith('.png') && !file.includes('(1)') && !file.includes('(2)'));
  
  console.log(`Найдено ${files.length} уникальных PNG файлов`);
  
  // Копировать файлы и давать им читаемые имена
  for (let i = 0; i < files.length; i++) {
    const sourceFile = path.join('./temp_extract', files[i]);
    const targetFile = path.join('./nft_assets/bored_ape', `bored_ape_${i + 1}.png`);
    
    fs.copyFileSync(sourceFile, targetFile);
    
    if (i % 100 === 0) {
      console.log(`Скопировано ${i} из ${files.length} файлов...`);
    }
  }
  
  console.log(`Успешно скопировано ${files.length} изображений Bored Apes`);
  return files.length;
}

/**
 * Генерирует SVG изображения для мутантных обезьян
 */
async function generateMutantApeImages(count) {
  console.log('Генерация изображений для Mutant Apes...');
  
  const targetDir = './nft_assets/mutant_ape';
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  
  const colors = [
    '#5EEAD4', '#3B82F6', '#EF4444', '#22C55E', '#F97316', 
    '#EC4899', '#A855F7', '#14B8A6', '#F59E0B', '#8B5CF6'
  ];
  
  const mutantCount = Math.min(count, 1000); // Ограничиваем количество мутантов
  
  for (let i = 0; i < mutantCount; i++) {
    const tokenId = 10001 + i;
    const rarity = determineRarity(tokenId);
    const color1 = colors[i % colors.length];
    const color2 = colors[(i + 3) % colors.length];
    
    const svg = `
      <svg width="350" height="350" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="${color1}" />
        <circle cx="175" cy="175" r="125" fill="${color2}" />
        <text x="175" y="165" font-family="Arial" font-size="24" text-anchor="middle" fill="white">Mutant Ape #${tokenId}</text>
        <text x="175" y="195" font-family="Arial" font-size="18" text-anchor="middle" fill="white">Rarity: ${rarity.toUpperCase()}</text>
      </svg>
    `;
    
    fs.writeFileSync(path.join(targetDir, `mutant_ape_${tokenId}.svg`), svg);
    
    if (i % 100 === 0) {
      console.log(`Сгенерировано ${i} из ${mutantCount} изображений Mutant Apes...`);
    }
  }
  
  console.log(`Успешно сгенерировано ${mutantCount} изображений Mutant Apes`);
  return mutantCount;
}

/**
 * Определяет редкость NFT на основе его ID
 */
function determineRarity(tokenId) {
  const seed = tokenId % 100;
  
  if (seed < 60) return 'common';
  if (seed < 85) return 'uncommon';
  if (seed < 95) return 'rare';
  if (seed < 99) return 'epic';
  return 'legendary';
}

/**
 * Обновляет пути к изображениям в базе данных
 */
async function updateImagePaths() {
  console.log('Обновление путей к изображениям в базе данных...');
  
  // Обновление путей для Bored Apes (collection_id = 1)
  const boredApeCount = await pool.query(`
    SELECT COUNT(*) FROM nfts WHERE collection_id = 1
  `);
  
  console.log(`Найдено ${boredApeCount.rows[0].count} NFT Bored Apes`);
  
  // Обновляем пути для Bored Apes
  await pool.query(`
    UPDATE nfts 
    SET 
      image_path = CONCAT('/nft_assets/bored_ape/bored_ape_', 
        (MOD(CAST(token_id AS INTEGER), 773) + 1), '.png'),
      original_image_path = CONCAT('/nft_assets/bored_ape/bored_ape_', 
        (MOD(CAST(token_id AS INTEGER), 773) + 1), '.png')
    WHERE collection_id = 1
  `);
  
  console.log('Пути к изображениям Bored Apes обновлены');
  
  // Обновление путей для Mutant Apes (collection_id = 2)
  const mutantApeCount = await pool.query(`
    SELECT COUNT(*) FROM nfts WHERE collection_id = 2
  `);
  
  console.log(`Найдено ${mutantApeCount.rows[0].count} NFT Mutant Apes`);
  
  // Обновляем пути для Mutant Apes
  await pool.query(`
    UPDATE nfts 
    SET 
      image_path = CONCAT('/nft_assets/mutant_ape/mutant_ape_', 
        CASE 
          WHEN CAST(token_id AS INTEGER) BETWEEN 10001 AND 11000 THEN CAST(token_id AS INTEGER)
          ELSE (MOD(CAST(token_id AS INTEGER), 1000) + 10001)
        END, '.svg'),
      original_image_path = CONCAT('/nft_assets/mutant_ape/mutant_ape_', 
        CASE 
          WHEN CAST(token_id AS INTEGER) BETWEEN 10001 AND 11000 THEN CAST(token_id AS INTEGER)
          ELSE (MOD(CAST(token_id AS INTEGER), 1000) + 10001)
        END, '.svg')
    WHERE collection_id = 2
  `);
  
  console.log('Пути к изображениям Mutant Apes обновлены');
}

/**
 * Проверяет, функциональны ли пути к изображениям NFT
 */
async function validateImagePaths() {
  console.log('Проверка путей к изображениям NFT...');
  
  // Получаем случайные 10 путей к изображениям для Bored Apes
  const boredApePaths = await pool.query(`
    SELECT id, token_id, image_path 
    FROM nfts 
    WHERE collection_id = 1 
    ORDER BY RANDOM() 
    LIMIT 10
  `);
  
  console.log('Примеры путей для Bored Apes:');
  boredApePaths.rows.forEach(row => {
    console.log(`  - ID: ${row.id}, Token ID: ${row.token_id}, Path: ${row.image_path}`);
    const fullPath = path.join('.', row.image_path);
    const baseDir = path.dirname(fullPath);
    console.log(`    Base Dir: ${baseDir}, Exists: ${fs.existsSync(baseDir)}`);
  });
  
  // Получаем случайные 10 путей к изображениям для Mutant Apes
  const mutantApePaths = await pool.query(`
    SELECT id, token_id, image_path 
    FROM nfts 
    WHERE collection_id = 2 
    ORDER BY RANDOM() 
    LIMIT 10
  `);
  
  console.log('Примеры путей для Mutant Apes:');
  mutantApePaths.rows.forEach(row => {
    console.log(`  - ID: ${row.id}, Token ID: ${row.token_id}, Path: ${row.image_path}`);
    const fullPath = path.join('.', row.image_path);
    const baseDir = path.dirname(fullPath);
    console.log(`    Base Dir: ${baseDir}, Exists: ${fs.existsSync(baseDir)}`);
  });
}

/**
 * Перемешивает порядок вывода NFT, добавляя случайные значения в поле сортировки
 */
async function randomizeNftOrder() {
  console.log('Перемешивание порядка вывода NFT в маркетплейсе...');
  
  await pool.query(`
    UPDATE nfts 
    SET sort_order = FLOOR(RANDOM() * 20000)::INTEGER
  `);
  
  console.log('Порядок вывода NFT успешно перемешан');
}

/**
 * Добавляет пути к директориям изображений для сервера
 */
async function fixServerImagePaths() {
  console.log('Обновление конфигурации сервера для доступа к изображениям...');
  
  const configFile = './server/config.js';
  
  if (fs.existsSync(configFile)) {
    let config = fs.readFileSync(configFile, 'utf8');
    
    if (!config.includes('/nft_assets')) {
      // Добавляем путь к nft_assets, если его нет
      const imagePathsPos = config.indexOf('nftImagePaths:');
      if (imagePathsPos !== -1) {
        const lineEndPos = config.indexOf(']', imagePathsPos);
        if (lineEndPos !== -1) {
          config = config.substring(0, lineEndPos) + 
                  ",'/nft_assets'" + 
                  config.substring(lineEndPos);
          fs.writeFileSync(configFile, config);
          console.log('Конфигурация сервера обновлена');
        }
      }
    } else {
      console.log('Путь к /nft_assets уже настроен в конфигурации');
    }
  } else {
    console.log('Файл конфигурации не найден, добавьте путь к директории вручную');
  }
}

/**
 * Основная функция скрипта
 */
async function main() {
  try {
    console.log('Запуск скрипта исправления путей к изображениям NFT...');
    
    // Создаем директории для изображений
    await createDirectories();
    
    // Копируем извлеченные изображения
    const boredApeImagesCount = await copyExtractedImages();
    console.log(`Успешно скопировано ${boredApeImagesCount} изображений Bored Apes`);
    
    // Генерируем изображения для мутантных обезьян
    const mutantApeImagesCount = await generateMutantApeImages(1000);
    console.log(`Успешно сгенерировано ${mutantApeImagesCount} изображений Mutant Apes`);
    
    // Обновляем пути к изображениям в базе данных
    await updateImagePaths();
    
    // Проверяем пути к изображениям
    await validateImagePaths();
    
    // Перемешиваем порядок вывода NFT
    await randomizeNftOrder();
    
    // Исправляем пути к изображениям в конфигурации сервера
    await fixServerImagePaths();
    
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
/**
 * Скрипт для удаления всех NFT, которые не являются Bored Ape или Mutant Ape,
 * и очистки папок от посторонних изображений
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const dotenv = require('dotenv');

// Загрузка переменных окружения
dotenv.config();

// Создание пула подключений к PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Очищает директорию от всех файлов, кроме тех, которые соответствуют шаблону
 */
function cleanDirectory(directory, validPattern) {
  console.log(`Очистка директории ${directory} от неподходящих файлов...`);
  
  if (!fs.existsSync(directory)) {
    console.log(`Директория ${directory} не существует, создаём...`);
    fs.mkdirSync(directory, { recursive: true });
    return;
  }
  
  const files = fs.readdirSync(directory);
  let removedCount = 0;
  
  for (const file of files) {
    if (!validPattern.test(file)) {
      const filePath = path.join(directory, file);
      try {
        fs.unlinkSync(filePath);
        removedCount++;
      } catch (error) {
        console.error(`Ошибка при удалении файла ${filePath}:`, error.message);
      }
    }
  }
  
  console.log(`Удалено ${removedCount} неподходящих файлов из ${directory}`);
}

/**
 * Удаляет из базы данных все NFT, которые не принадлежат к нужным коллекциям
 */
async function removeNonApeNFT() {
  console.log('Удаление NFT, не относящихся к коллекциям Bored Ape и Mutant Ape...');
  
  // Получаем ID нужных коллекций
  const collectionsResult = await pool.query(`
    SELECT id FROM collections 
    WHERE name IN ('Bored Ape Yacht Club', 'Mutant Ape Yacht Club')
  `);
  
  if (collectionsResult.rows.length === 0) {
    throw new Error('Коллекции Bored Ape и Mutant Ape не найдены в базе данных');
  }
  
  const validCollectionIds = collectionsResult.rows.map(row => row.id);
  
  // Удаляем NFT из других коллекций
  const deleteResult = await pool.query(`
    DELETE FROM nfts 
    WHERE collection_id NOT IN (${validCollectionIds.join(',')})
    RETURNING id
  `);
  
  console.log(`Удалено ${deleteResult.rowCount} NFT из других коллекций`);
}

/**
 * Удаляет дубликаты NFT на основе путей к изображениям
 */
async function removeDuplicateNFTs() {
  console.log('Удаление дубликатов NFT на основе путей к изображениям...');
  
  // Находим дубликаты по image_path
  const duplicatesResult = await pool.query(`
    WITH duplicates AS (
      SELECT id, image_path, 
        ROW_NUMBER() OVER(PARTITION BY image_path ORDER BY id) as rn
      FROM nfts
      WHERE image_path IS NOT NULL
    )
    DELETE FROM nfts
    WHERE id IN (
      SELECT id FROM duplicates WHERE rn > 1
    )
    RETURNING id
  `);
  
  console.log(`Удалено ${duplicatesResult.rowCount} дубликатов NFT`);
}

/**
 * Обновляет пути к изображениям для всех NFT
 */
async function fixImagePaths() {
  console.log('Обновление путей к изображениям для всех NFT...');
  
  // Обновляем пути для Bored Ape
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
  await pool.query(`
    UPDATE nfts 
    SET 
      image_path = CONCAT('/mutant_ape_nft/mutant_ape_', 
        (MOD(CAST(token_id AS INTEGER), 1000) + 10001), '.svg'),
      original_image_path = CONCAT('/mutant_ape_nft/mutant_ape_', 
        (MOD(CAST(token_id AS INTEGER), 1000) + 10001), '.svg')
    WHERE collection_id = 2
  `);
  
  console.log('Пути к изображениям обновлены');
}

/**
 * Генерирует SVG для Mutant Ape
 */
function generateMutantApeSVGs() {
  console.log('Генерация SVG для Mutant Ape...');
  
  const mutantApeDir = './mutant_ape_nft';
  if (!fs.existsSync(mutantApeDir)) {
    fs.mkdirSync(mutantApeDir, { recursive: true });
  }
  
  // Создаем SVG для каждого номера от 10001 до 11000
  for (let i = 10001; i <= 11000; i++) {
    const svgPath = path.join(mutantApeDir, `mutant_ape_${i}.svg`);
    
    // Если SVG уже существует, пропускаем
    if (fs.existsSync(svgPath)) {
      continue;
    }
    
    // Генерируем случайные параметры для SVG
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
    
    // Создаем простой SVG
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
      <circle cx="100" cy="100" r="60" fill="${faceColor}" />
      <${eyeType} cx="70" cy="80" rx="${eyeSize}" ry="${eyeSize}" fill="white" />
      <${eyeType} cx="130" cy="80" rx="${eyeSize}" ry="${eyeSize}" fill="white" />
      <circle cx="70" cy="80" r="3" fill="black" />
      <circle cx="130" cy="80" r="3" fill="black" />
      <rect x="${100 - mouthWidth/2}" y="120" width="${mouthWidth}" height="10" rx="5" fill="#333" />
      <text x="50" y="170" fill="white" font-weight="bold" font-size="12" class="mutant-ape">Mutant Ape #${i}</text>
      <text x="50" y="185" fill="white" font-size="10" class="mutant-ape">ID: MAYC-${uniqueId}</text>
    </svg>`;
    
    fs.writeFileSync(svgPath, svgContent);
  }
  
  console.log(`Создано SVG для Mutant Ape (10001-11000)`);
}

/**
 * Основная функция скрипта
 */
async function main() {
  try {
    console.log('Запуск скрипта для очистки NFT...');
    
    // Очищаем директории от посторонних файлов
    cleanDirectory('./bored_ape_nft', /^bored_ape_\d+\.png$/);
    cleanDirectory('./mutant_ape_nft', /^mutant_ape_\d+\.(svg|png)$/);
    
    // Генерируем SVG для Mutant Ape
    generateMutantApeSVGs();
    
    // Удаляем из базы данных NFT, не относящиеся к нужным коллекциям
    await removeNonApeNFT();
    
    // Удаляем дубликаты NFT
    await removeDuplicateNFTs();
    
    // Исправляем пути к изображениям
    await fixImagePaths();
    
    // Перемешиваем порядок отображения NFT
    await pool.query(`
      UPDATE nfts 
      SET sort_order = (RANDOM() * 20000)::INTEGER
    `);
    
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
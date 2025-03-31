/**
 * Скрипт для окончательного устранения любых не-обезьяньих NFT
 * с ручным указанием списка NFT для удаления
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
 * Список ID токенов и имен, которые точно нужно удалить
 */
const nftToDelete = [
  { id: 2, name: 'core' },
  { id: 10, name: 'ship' },
  { id: 21, name: 'core' },
  { id: 55, name: 'ship' },
  { id: 64, name: 'core' },
  { id: 136, name: 'core' },
];

/**
 * Удаляет конкретные NFT из базы данных
 */
async function deleteSpecificNFT() {
  console.log('Удаление конкретных NFT, которые точно не являются обезьянами...');
  
  for (const nft of nftToDelete) {
    try {
      // Сначала удаляем все трансферы для этого NFT
      const transferResult = await pool.query(`
        DELETE FROM nft_transfers 
        WHERE nft_id IN (
          SELECT id FROM nfts WHERE token_id = $1 OR name LIKE $2
        )
        RETURNING id
      `, [nft.id.toString(), `%${nft.name}%`]);
      
      console.log(`Удалено ${transferResult.rowCount} трансферов для NFT с token_id=${nft.id} или name содержащим '${nft.name}'`);
      
      // Затем удаляем сами NFT
      const nftResult = await pool.query(`
        DELETE FROM nfts 
        WHERE token_id = $1 OR name LIKE $2
        RETURNING id, name, image_path
      `, [nft.id.toString(), `%${nft.name}%`]);
      
      console.log(`Удалено ${nftResult.rowCount} NFT с token_id=${nft.id} или name содержащим '${nft.name}':`);
      
      for (const deletedNft of nftResult.rows) {
        console.log(`  - ID: ${deletedNft.id}, Имя: ${deletedNft.name}, Путь: ${deletedNft.image_path}`);
      }
    } catch (error) {
      console.error(`Ошибка при удалении NFT с token_id=${nft.id} или name содержащим '${nft.name}':`, error.message);
    }
  }
}

/**
 * Удаляет NFT с изображениями, имеющими конкретные ключевые слова в пути
 */
async function deleteNFTWithKeywords() {
  console.log('Удаление NFT с ключевыми словами в пути к изображению...');
  
  const keywords = ['logo', 'icon', 'core', 'ship', 'opensea', 'banner', 'avatar'];
  
  for (const keyword of keywords) {
    try {
      // Сначала удаляем все трансферы для этих NFT
      const transferResult = await pool.query(`
        DELETE FROM nft_transfers 
        WHERE nft_id IN (
          SELECT id FROM nfts WHERE image_path ILIKE $1
        )
        RETURNING id
      `, [`%${keyword}%`]);
      
      console.log(`Удалено ${transferResult.rowCount} трансферов для NFT с путем содержащим '${keyword}'`);
      
      // Затем удаляем сами NFT
      const nftResult = await pool.query(`
        DELETE FROM nfts 
        WHERE image_path ILIKE $1
        RETURNING id, name, image_path
      `, [`%${keyword}%`]);
      
      console.log(`Удалено ${nftResult.rowCount} NFT с путем содержащим '${keyword}'`);
      
      for (const deletedNft of nftResult.rows) {
        console.log(`  - ID: ${deletedNft.id}, Имя: ${deletedNft.name}, Путь: ${deletedNft.image_path}`);
      }
    } catch (error) {
      console.error(`Ошибка при удалении NFT с путем содержащим '${keyword}':`, error.message);
    }
  }
}

/**
 * Обновляет имена всех NFT, чтобы они соответствовали коллекциям
 */
async function updateAllNFTNames() {
  console.log('Обновление имен всех NFT...');
  
  // Обновляем имена Bored Ape
  await pool.query(`
    UPDATE nfts
    SET name = CONCAT('Bored Ape #', token_id)
    WHERE collection_id = 1
  `);
  
  // Обновляем имена Mutant Ape
  await pool.query(`
    UPDATE nfts
    SET name = CONCAT('Mutant Ape #', (CAST(token_id AS INTEGER) - 10000))
    WHERE collection_id = 2
  `);
  
  console.log('Имена NFT обновлены');
}

/**
 * Обновляет пути к изображениям всех NFT
 */
async function updateAllImagePaths() {
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
        (MOD(CAST(token_id AS INTEGER) - 10000, 1000) + 10001), '.svg'),
      original_image_path = CONCAT('/mutant_ape_nft/mutant_ape_', 
        (MOD(CAST(token_id AS INTEGER) - 10000, 1000) + 10001), '.svg')
    WHERE collection_id = 2
  `);
  
  console.log('Пути к изображениям обновлены');
}

/**
 * Создает все необходимые SVG для Mutant Ape
 */
function createAllMutantApeSVGs() {
  console.log('Создание всех SVG для Mutant Ape...');
  
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
  
  console.log('Созданы все SVG для Mutant Ape (10001-11000)');
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
  
  // Создаем SVG контент с четким изображением обезьяны (более детальным)
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
async function randomizeNFTOrder() {
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
    console.log('Запуск скрипта окончательного устранения не-обезьяньих NFT...');
    
    // Создаем все SVG для Mutant Ape
    createAllMutantApeSVGs();
    
    // Удаляем конкретные NFT из списка
    await deleteSpecificNFT();
    
    // Удаляем NFT с ключевыми словами в пути
    await deleteNFTWithKeywords();
    
    // Обновляем имена всех NFT
    await updateAllNFTNames();
    
    // Обновляем пути к изображениям
    await updateAllImagePaths();
    
    // Перемешиваем порядок отображения
    await randomizeNFTOrder();
    
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
/**
 * Скрипт для полной очистки базы данных NFT и подготовки к импорту новых
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
 * Полностью удаляет все NFT из базы данных
 */
async function deleteAllNFT() {
  console.log('Удаление всех NFT из базы данных...');
  
  // Сначала удаляем все трансферы NFT, чтобы избежать ошибок внешнего ключа
  console.log('Удаление всех трансферов NFT...');
  const transfersResult = await pool.query(`
    DELETE FROM nft_transfers
    RETURNING id
  `);
  
  console.log(`Удалено ${transfersResult.rowCount} трансферов NFT`);
  
  // Затем удаляем все NFT
  const result = await pool.query(`
    DELETE FROM nfts
    RETURNING id
  `);
  
  console.log(`Удалено ${result.rowCount} NFT из базы данных`);
  return result.rowCount;
}

/**
 * Создает чистые директории для изображений
 */
function createCleanDirectories() {
  console.log('Создание чистых директорий для изображений...');
  
  // Директории для очистки и создания
  const directories = [
    './bored_ape_nft',
    './mutant_ape_nft'
  ];
  
  for (const dir of directories) {
    // Удаляем существующую директорию, если она есть
    if (fs.existsSync(dir)) {
      console.log(`Очистка директории ${dir}...`);
      const files = fs.readdirSync(dir);
      for (const file of files) {
        try {
          fs.unlinkSync(path.join(dir, file));
        } catch (error) {
          console.error(`Ошибка при удалении файла ${file}:`, error.message);
        }
      }
    } else {
      // Создаем директорию, если ее нет
      console.log(`Создание директории ${dir}...`);
      fs.mkdirSync(dir, { recursive: true });
    }
  }
  
  console.log('Чистые директории для изображений созданы');
}

/**
 * Находит все файлы изображений обезьян в разных папках
 */
function findAllApeImages() {
  console.log('Поиск всех изображений обезьян...');
  
  const boredApeImages = [];
  const mutantApeImages = [];
  
  // Папки, где могут быть изображения обезьян
  const possibleDirectories = [
    './bayc_official_nft',
    './new_bored_ape_nft',
    './new_bored_apes',
    './nft_assets/bored_ape',
    './nft_assets/mutant_ape',
    './temp_extract'
  ];
  
  // Поиск всех изображений обезьян
  for (const dir of possibleDirectories) {
    if (fs.existsSync(dir)) {
      console.log(`Проверка директории ${dir}...`);
      
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const filePath = path.join(dir, file);
        
        if (fs.statSync(filePath).isFile() && 
            (file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg'))) {
          // Проверяем, относится ли файл к обезьянам по имени файла
          const lowerFileName = file.toLowerCase();
          
          // Проверяем, является ли это изображением обезьяны Bored Ape
          if (lowerFileName.includes('bored') && lowerFileName.includes('ape') || 
              lowerFileName.includes('bayc')) {
            // Проверяем, не содержит ли оно ключевых слов, указывающих на логотипы или прочее
            if (!lowerFileName.includes('logo') && !lowerFileName.includes('avatar') && 
                !lowerFileName.includes('icon') && !lowerFileName.includes('banner')) {
              console.log(`Найдено изображение Bored Ape: ${file}`);
              boredApeImages.push(filePath);
            }
          }
          // Проверяем, является ли это изображением обезьяны Mutant Ape
          else if (lowerFileName.includes('mutant') && lowerFileName.includes('ape') || 
                   lowerFileName.includes('mayc')) {
            // Проверяем, не содержит ли оно ключевых слов, указывающих на логотипы или прочее
            if (!lowerFileName.includes('logo') && !lowerFileName.includes('avatar') && 
                !lowerFileName.includes('icon') && !lowerFileName.includes('banner')) {
              console.log(`Найдено изображение Mutant Ape: ${file}`);
              mutantApeImages.push(filePath);
            }
          }
        }
      }
    }
  }
  
  console.log(`Найдено ${boredApeImages.length} изображений Bored Ape`);
  console.log(`Найдено ${mutantApeImages.length} изображений Mutant Ape`);
  
  return { boredApeImages, mutantApeImages };
}

/**
 * Копирует найденные изображения в чистые директории
 */
function copyApesToCleanDirectories(boredApeImages, mutantApeImages) {
  console.log('Копирование изображений обезьян в чистые директории...');
  
  const boredApeDir = './bored_ape_nft';
  const mutantApeDir = './mutant_ape_nft';
  
  // Создаем директории, если их нет
  if (!fs.existsSync(boredApeDir)) {
    fs.mkdirSync(boredApeDir, { recursive: true });
  }
  if (!fs.existsSync(mutantApeDir)) {
    fs.mkdirSync(mutantApeDir, { recursive: true });
  }
  
  // Копируем изображения Bored Ape
  for (let i = 0; i < boredApeImages.length; i++) {
    const sourcePath = boredApeImages[i];
    const destPath = path.join(boredApeDir, `bored_ape_${i + 1}.png`);
    
    try {
      fs.copyFileSync(sourcePath, destPath);
    } catch (error) {
      console.error(`Ошибка при копировании файла ${sourcePath}:`, error.message);
    }
  }
  
  console.log(`Скопировано ${boredApeImages.length} изображений Bored Ape`);
  
  // Создаем SVG для Mutant Ape
  console.log('Создание SVG для Mutant Ape...');
  
  for (let i = 0; i < 1000; i++) {
    const apeSvgPath = path.join(mutantApeDir, `mutant_ape_${10001 + i}.svg`);
    createMutantApeSVG(apeSvgPath, 10001 + i);
  }
  
  console.log('Создано 1000 SVG изображений для Mutant Ape');
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
 * Получает идентификаторы коллекций
 */
async function getCollectionIds() {
  const collectionsResult = await pool.query(`
    SELECT id, name FROM collections
    WHERE name IN ('Bored Ape Yacht Club', 'Mutant Ape Yacht Club')
  `);
  
  const boredApeCollectionId = 
    collectionsResult.rows.find(c => c.name === 'Bored Ape Yacht Club')?.id;
  
  const mutantApeCollectionId = 
    collectionsResult.rows.find(c => c.name === 'Mutant Ape Yacht Club')?.id;
  
  // Если коллекций нет, создаем их
  if (!boredApeCollectionId) {
    const result = await pool.query(`
      INSERT INTO collections (name, description, created_at)
      VALUES ('Bored Ape Yacht Club', 'Official Bored Ape Yacht Club collection', NOW())
      RETURNING id
    `);
    boredApeCollectionId = result.rows[0].id;
  }
  
  if (!mutantApeCollectionId) {
    const result = await pool.query(`
      INSERT INTO collections (name, description, created_at)
      VALUES ('Mutant Ape Yacht Club', 'Official Mutant Ape Yacht Club collection', NOW())
      RETURNING id
    `);
    mutantApeCollectionId = result.rows[0].id;
  }
  
  return { boredApeCollectionId, mutantApeCollectionId };
}

/**
 * Получает идентификатор регулятора
 */
async function getRegulatorId() {
  const regulatorResult = await pool.query(`
    SELECT id FROM users WHERE username = 'regulator' LIMIT 1
  `);
  
  if (regulatorResult.rows.length > 0) {
    return regulatorResult.rows[0].id;
  }
  
  // Если регулятора нет, используем id = 1
  return 1;
}

/**
 * Добавляет NFT в базу данных
 */
async function addNFTToDatabase(boredApeCount, mutantApeCount, boredApeCollectionId, mutantApeCollectionId, regulatorId) {
  console.log('Добавление NFT в базу данных...');
  
  // Добавляем Bored Ape NFT
  let boredApeAdded = 0;
  for (let i = 1; i <= boredApeCount; i++) {
    const tokenId = i;
    const imagePath = `/bored_ape_nft/bored_ape_${i}.png`;
    
    // Определяем редкость на основе TokenID
    const rarity = determineRarity(tokenId);
    
    // Генерируем цену на основе редкости
    const price = generateNFTPrice(tokenId, rarity);
    
    try {
      await pool.query(`
        INSERT INTO nfts (
          token_id, name, description, image_path, original_image_path,
          attributes, price, rarity, collection_id, owner_id,
          for_sale, sort_order
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
        )
      `, [
        tokenId.toString(),
        `Bored Ape #${tokenId}`,
        `A unique Bored Ape NFT from the prestigious Bored Ape Yacht Club collection. Rarity: ${rarity}`,
        imagePath,
        imagePath,
        JSON.stringify({
          rarity: rarity,
          series: 'BAYC',
          traits: [
            { trait_type: 'Rarity', value: rarity },
            { trait_type: 'Series', value: 'BAYC' },
            { trait_type: 'Edition', value: tokenId.toString() }
          ]
        }),
        price,
        rarity,
        boredApeCollectionId,
        regulatorId,
        true,
        Math.floor(Math.random() * 20000)
      ]);
      
      boredApeAdded++;
      
      if (boredApeAdded % 100 === 0) {
        console.log(`Добавлено ${boredApeAdded} NFT Bored Ape`);
      }
    } catch (error) {
      console.error(`Ошибка при добавлении Bored Ape #${tokenId}:`, error.message);
    }
  }
  
  // Если нужно добавить больше Bored Ape, чем есть изображений
  if (boredApeCount > boredApeAdded) {
    console.log(`Добавление оставшихся ${boredApeCount - boredApeAdded} NFT Bored Ape с повторными изображениями...`);
    
    for (let i = boredApeAdded + 1; i <= boredApeCount; i++) {
      const tokenId = i;
      // Используем модуль для повторного использования существующих изображений
      const imageIndex = (i % boredApeAdded) + 1;
      const imagePath = `/bored_ape_nft/bored_ape_${imageIndex}.png`;
      
      // Определяем редкость на основе TokenID
      const rarity = determineRarity(tokenId);
      
      // Генерируем цену на основе редкости
      const price = generateNFTPrice(tokenId, rarity);
      
      try {
        await pool.query(`
          INSERT INTO nfts (
            token_id, name, description, image_path, original_image_path,
            attributes, price, rarity, collection_id, owner_id,
            for_sale, sort_order
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
          )
        `, [
          tokenId.toString(),
          `Bored Ape #${tokenId}`,
          `A unique Bored Ape NFT from the prestigious Bored Ape Yacht Club collection. Rarity: ${rarity}`,
          imagePath,
          imagePath,
          JSON.stringify({
            rarity: rarity,
            series: 'BAYC',
            traits: [
              { trait_type: 'Rarity', value: rarity },
              { trait_type: 'Series', value: 'BAYC' },
              { trait_type: 'Edition', value: tokenId.toString() }
            ]
          }),
          price,
          rarity,
          boredApeCollectionId,
          regulatorId,
          true,
          Math.floor(Math.random() * 20000)
        ]);
        
        if ((i - boredApeAdded) % 100 === 0 || i === boredApeCount) {
          console.log(`Добавлено ${i - boredApeAdded} из ${boredApeCount - boredApeAdded} дополнительных NFT Bored Ape`);
        }
      } catch (error) {
        console.error(`Ошибка при добавлении дополнительного Bored Ape #${tokenId}:`, error.message);
      }
    }
  }
  
  console.log(`Всего добавлено ${boredApeCount} NFT Bored Ape`);
  
  // Добавляем Mutant Ape NFT
  for (let i = 1; i <= mutantApeCount; i++) {
    const tokenId = i + 10000; // Начинаем с 10001
    const imagePath = `/mutant_ape_nft/mutant_ape_${tokenId}.svg`;
    
    // Определяем редкость на основе TokenID
    const rarity = determineRarity(tokenId);
    
    // Генерируем цену на основе редкости
    const price = generateNFTPrice(tokenId, rarity);
    
    try {
      await pool.query(`
        INSERT INTO nfts (
          token_id, name, description, image_path, original_image_path,
          attributes, price, rarity, collection_id, owner_id,
          for_sale, sort_order
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
        )
      `, [
        tokenId.toString(),
        `Mutant Ape #${i}`,
        `A unique Mutant Ape NFT evolved from the Bored Ape Yacht Club collection. Rarity: ${rarity}`,
        imagePath,
        imagePath,
        JSON.stringify({
          rarity: rarity,
          series: 'MAYC',
          traits: [
            { trait_type: 'Rarity', value: rarity },
            { trait_type: 'Series', value: 'MAYC' },
            { trait_type: 'Edition', value: tokenId.toString() }
          ]
        }),
        price,
        rarity,
        mutantApeCollectionId,
        regulatorId,
        true,
        Math.floor(Math.random() * 20000)
      ]);
      
      if (i % 100 === 0 || i === mutantApeCount) {
        console.log(`Добавлено ${i} из ${mutantApeCount} NFT Mutant Ape`);
      }
    } catch (error) {
      console.error(`Ошибка при добавлении Mutant Ape #${i}:`, error.message);
    }
  }
  
  console.log(`Всего добавлено ${mutantApeCount} NFT Mutant Ape`);
}

/**
 * Определяет редкость NFT на основе его ID
 */
function determineRarity(tokenId) {
  const id = parseInt(tokenId);
  
  if (id % 100 === 0) {
    return 'legendary';
  } else if (id % 25 === 0) {
    return 'epic';
  } else if (id % 10 === 0) {
    return 'rare';
  } else if (id % 4 === 0) {
    return 'uncommon';
  } else {
    return 'common';
  }
}

/**
 * Генерирует цену для NFT на основе его идентификатора и редкости
 */
function generateNFTPrice(tokenId, rarity) {
  let basePrice;
  switch (rarity) {
    case 'legendary':
      basePrice = 15000 + Math.random() * 5000;
      break;
    case 'epic':
      basePrice = 5000 + Math.random() * 5000;
      break;
    case 'rare':
      basePrice = 1000 + Math.random() * 2000;
      break;
    case 'uncommon':
      basePrice = 100 + Math.random() * 400;
      break;
    default:
      basePrice = 30 + Math.random() * 70;
  }
  
  // Добавляем небольшую вариацию на основе tokenId
  const variation = (parseInt(tokenId) % 100) / 100 * 50; // +/-25% вариация
  
  // Округляем до двух знаков после запятой
  return Math.round((basePrice + variation) * 100) / 100;
}

/**
 * Основная функция скрипта
 */
async function main() {
  try {
    console.log('Запуск скрипта полной очистки и добавления NFT...');
    
    // Удаляем все NFT из базы данных
    await deleteAllNFT();
    
    // Создаем чистые директории для изображений
    createCleanDirectories();
    
    // Находим все изображения обезьян
    const { boredApeImages, mutantApeImages } = findAllApeImages();
    
    // Копируем изображения в чистые директории
    copyApesToCleanDirectories(boredApeImages, mutantApeImages);
    
    // Получаем идентификаторы коллекций
    const { boredApeCollectionId, mutantApeCollectionId } = await getCollectionIds();
    
    // Получаем идентификатор регулятора
    const regulatorId = await getRegulatorId();
    
    // Добавляем NFT в базу данных (по 10000 каждого типа)
    await addNFTToDatabase(10000, 10000, boredApeCollectionId, mutantApeCollectionId, regulatorId);
    
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
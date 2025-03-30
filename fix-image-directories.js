/**
 * Скрипт для проверки и создания директорий с изображениями NFT
 * Обеспечивает правильное отображение изображений в маркетплейсе
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';

const { Pool } = pg;

// Создаем подключение к базе данных PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Константы для директорий
const MUTANT_APE_DIR = './mutant_ape_nft';
const BORED_APE_DIR = './bored_ape_nft';
const SOURCE_DIRS = [
  './bayc_official_nft',
  './new_bored_ape_nft',
  './new_bored_apes',
  './temp_extract',
  './nft_assets',
  './bored_ape_nft'
];

/**
 * Создает необходимые директории, если они не существуют
 */
function createDirectories() {
  const dirs = [MUTANT_APE_DIR, BORED_APE_DIR];
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Создана директория: ${dir}`);
    } else {
      console.log(`Директория уже существует: ${dir}`);
    }
  });
}

/**
 * Сканирует директории с исходными изображениями
 */
function scanSourceDirectories() {
  const allImages = [];
  
  SOURCE_DIRS.forEach(dir => {
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir);
      console.log(`Директория ${dir}: найдено ${files.length} файлов`);
      
      files.forEach(file => {
        if (file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.avif')) {
          allImages.push({
            path: path.join(dir, file),
            filename: file
          });
        }
      });
    } else {
      console.log(`Директория ${dir} не существует`);
    }
  });
  
  return allImages;
}

/**
 * Определяет тип обезьяны (Mutant или Bored) по имени файла
 */
function getApeType(filename) {
  const lowerFilename = filename.toLowerCase();
  
  if (lowerFilename.includes('mutant') || lowerFilename.includes('mayc')) {
    return 'mutant';
  } else {
    return 'bored';
  }
}

/**
 * Извлекает ID токена из имени файла
 */
function extractTokenId(filename) {
  // Удаляем расширение
  const withoutExt = filename.replace(/\.[^/.]+$/, "");
  
  // Ищем числа в имени файла
  const matches = withoutExt.match(/\d+/);
  
  if (matches && matches.length > 0) {
    return matches[0].padStart(4, '0'); // Добавляем ведущие нули
  }
  
  return null;
}

/**
 * Копирует изображения из исходных директорий в целевые
 */
function copyImages(images) {
  let copiedBored = 0;
  let copiedMutant = 0;
  
  images.forEach(img => {
    try {
      const type = getApeType(img.filename);
      const tokenId = extractTokenId(img.filename);
      
      if (!tokenId) {
        console.log(`Не удалось извлечь ID токена из файла: ${img.filename}`);
        return;
      }
      
      let targetPath;
      if (type === 'mutant') {
        targetPath = path.join(MUTANT_APE_DIR, `mutant_ape_${tokenId}.png`);
        copiedMutant++;
      } else {
        targetPath = path.join(BORED_APE_DIR, `bored_ape_${tokenId}.png`);
        copiedBored++;
      }
      
      // Проверяем, существует ли целевой файл
      if (!fs.existsSync(targetPath)) {
        fs.copyFileSync(img.path, targetPath);
        console.log(`Скопирован файл: ${img.path} -> ${targetPath}`);
      }
    } catch (error) {
      console.error(`Ошибка при копировании файла ${img.filename}:`, error);
    }
  });
  
  console.log(`Скопировано изображений:`);
  console.log(`- Bored Ape: ${copiedBored}`);
  console.log(`- Mutant Ape: ${copiedMutant}`);
}

/**
 * Обновляет пути к изображениям в базе данных
 */
async function updateImagePaths() {
  const client = await pool.connect();
  
  try {
    console.log('Обновление путей к изображениям в базе данных...');
    
    // Получаем все NFT
    const { rows: allNFTs } = await client.query(`
      SELECT id, name, image_path, token_id 
      FROM nft
      ORDER BY id
    `);
    
    console.log(`Получено ${allNFTs.length} NFT для обновления путей`);
    
    let updatedCount = 0;
    
    // Проверяем и исправляем пути к изображениям для каждого NFT
    for (const nft of allNFTs) {
      const isMutant = nft.name.includes('Mutant Ape');
      const tokenId = nft.token_id.padStart(4, '0');
      
      // Генерируем новый путь на основе типа и ID токена
      let newPath;
      if (isMutant) {
        newPath = `/mutant_ape_nft/mutant_ape_${tokenId}.png`;
      } else {
        newPath = `/bored_ape_nft/bored_ape_${tokenId}.png`;
      }
      
      // Проверяем, существует ли файл в системе
      const fileExists = fs.existsSync(`.${newPath}`);
      
      // Обновляем путь только если файл существует
      if (fileExists) {
        await client.query(`
          UPDATE nft
          SET image_path = $1
          WHERE id = $2
        `, [newPath, nft.id]);
        
        updatedCount++;
      } else {
        console.log(`[${nft.id}] Файл не найден: ${newPath}`);
      }
    }
    
    console.log(`Обновлено ${updatedCount} путей к изображениям в базе данных`);
    
  } catch (error) {
    console.error('Ошибка при обновлении путей к изображениям:', error);
  } finally {
    client.release();
  }
}

/**
 * Проверяет, соответствуют ли названия NFT и коллекций их изображениям
 */
async function validateNamesAndPaths() {
  const client = await pool.connect();
  
  try {
    console.log('Проверка соответствия названий и изображений...');
    
    // Получаем все NFT
    const { rows: allNFTs } = await client.query(`
      SELECT id, name, image_path, token_id 
      FROM nft
      ORDER BY id
    `);
    
    console.log(`Получено ${allNFTs.length} NFT для проверки`);
    
    let mismatchCount = 0;
    
    // Проверяем соответствие названий и путей к изображениям
    for (const nft of allNFTs) {
      const imagePath = nft.image_path || '';
      const name = nft.name || '';
      
      // Определяем коллекцию на основе пути к изображению
      const isMutantByPath = imagePath.includes('mutant_ape');
      const isMutantByName = name.includes('Mutant Ape');
      
      // Проверяем на несоответствие
      if (isMutantByPath !== isMutantByName) {
        console.log(`[${nft.id}] Несоответствие: ${name} (${isMutantByName ? 'Mutant' : 'Bored'}) => ${imagePath} (${isMutantByPath ? 'Mutant' : 'Bored'})`);
        
        // Корректируем название на основе пути к изображению
        let newName = name;
        if (isMutantByPath) {
          newName = name.replace('Bored Ape', 'Mutant Ape');
        } else {
          newName = name.replace('Mutant Ape', 'Bored Ape');
        }
        
        await client.query(`
          UPDATE nft
          SET name = $1
          WHERE id = $2
        `, [newName, nft.id]);
        
        mismatchCount++;
      }
    }
    
    console.log(`Исправлено ${mismatchCount} несоответствий между названиями и изображениями`);
    
  } catch (error) {
    console.error('Ошибка при проверке соответствия названий и изображений:', error);
  } finally {
    client.release();
  }
}

/**
 * Главная функция скрипта
 */
async function main() {
  try {
    console.log('Запуск скрипта проверки директорий и изображений...');
    
    // Шаг 1: Создаем необходимые директории
    createDirectories();
    
    // Шаг 2: Сканируем директории с исходными изображениями
    const allImages = scanSourceDirectories();
    console.log(`Всего найдено ${allImages.length} изображений`);
    
    // Шаг 3: Копируем изображения из исходных директорий в целевые
    copyImages(allImages);
    
    // Шаг 4: Обновляем пути к изображениям в базе данных
    await updateImagePaths();
    
    // Шаг 5: Проверяем соответствие названий и путей к изображениям
    await validateNamesAndPaths();
    
    console.log('Все операции завершены успешно!');
    
  } catch (error) {
    console.error('Ошибка при выполнении скрипта:', error);
  } finally {
    process.exit(0);
  }
}

main();
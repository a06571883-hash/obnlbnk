/**
 * Скрипт для исправления путей к изображениям Mutant Ape NFT в базе данных
 * с возможностью указать смещение для возобновления работы
 */

const fs = require('fs');
const { Pool } = require('pg');

// Подключение к базе данных PostgreSQL через DATABASE_URL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Начальная позиция для обновления (с какого NFT начинать)
const START_OFFSET = 0;

/**
 * Получает список всех файлов Mutant Ape из директории
 * @returns {Promise<string[]>} Массив имен файлов
 */
async function getMutantApeFiles() {
  return new Promise((resolve, reject) => {
    fs.readdir('mutant_ape_nft', (err, files) => {
      if (err) {
        reject(err);
        return;
      }
      // Фильтруем только PNG файлы
      const pngFiles = files.filter(file => file.endsWith('.png'));
      resolve(pngFiles);
    });
  });
}

/**
 * Получает список всех Mutant Ape NFT из базы данных, у которых старый формат пути
 * @returns {Promise<Object[]>} Массив NFT объектов
 */
async function getMutantApeNFTs() {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT id, name, image_path 
      FROM nfts 
      WHERE collection_id = 2 
      AND image_path LIKE '/mutant_ape_nft/mutant_ape_1%'
      ORDER BY id
      LIMIT 500
    `);
    return result.rows;
  } finally {
    client.release();
  }
}

/**
 * Обновляет путь к изображению для конкретного NFT
 * @param {number} id ID NFT
 * @param {string} newPath Новый путь к изображению
 * @returns {Promise<boolean>} Успешность операции
 */
async function updateNFTImagePath(id, newPath) {
  const client = await pool.connect();
  try {
    await client.query(`
      UPDATE nfts 
      SET image_path = $1 
      WHERE id = $2
    `, [newPath, id]);
    return true;
  } catch (err) {
    console.error(`Ошибка при обновлении NFT ID ${id}:`, err);
    return false;
  } finally {
    client.release();
  }
}

/**
 * Обновляет пути изображений Mutant Ape NFT по одному
 * @param {Object[]} nfts Список NFT для обновления
 * @param {string[]} files Имена файлов для использования
 */
async function updateImagePathsOneByOne(nfts, files) {
  if (files.length === 0) {
    console.error('Ошибка: не найдено файлов Mutant Ape');
    return;
  }

  console.log(`Начинаем обновление путей для ${nfts.length} NFT со старым форматом пути...`);
  
  let successCount = 0;
  let failCount = 0;
  
  // Обновляем каждый NFT последовательно
  for (let i = 0; i < nfts.length; i++) {
    const nft = nfts[i];
    const fileIndex = i % files.length; // Циклически используем файлы
    const fileName = files[fileIndex];
    const newPath = `/mutant_ape_nft/${fileName}`;
    
    if (nft.image_path !== newPath) {
      const success = await updateNFTImagePath(nft.id, newPath);
      
      if (success) {
        successCount++;
      } else {
        failCount++;
      }
      
      // Выводим прогресс каждые 10 NFT
      if ((i + 1) % 10 === 0 || i === nfts.length - 1) {
        console.log(`Обработано ${i + 1} из ${nfts.length} NFT (успешно: ${successCount}, ошибок: ${failCount})`);
      }
    }
  }
  
  console.log(`Обновление путей завершено. Успешно обновлено: ${successCount}, ошибок: ${failCount}`);
}

/**
 * Основная функция скрипта
 */
async function main() {
  try {
    // Получаем список файлов
    const files = await getMutantApeFiles();
    console.log(`Найдено ${files.length} файлов Mutant Ape`);
    
    // Получаем список всех Mutant Ape NFT со старым форматом пути
    const nfts = await getMutantApeNFTs();
    console.log(`Найдено ${nfts.length} Mutant Ape NFT со старым форматом пути`);
    
    // Обновляем пути изображений по одному
    await updateImagePathsOneByOne(nfts, files);
    
    console.log('Скрипт успешно завершен!');
  } catch (err) {
    console.error('Ошибка при выполнении скрипта:', err);
  } finally {
    // Закрываем пул соединений
    await pool.end();
  }
}

// Запускаем скрипт
main();
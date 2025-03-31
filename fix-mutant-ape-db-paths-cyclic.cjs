/**
 * Скрипт для исправления путей к изображениям Mutant Ape NFT в базе данных
 * 
 * Проблема: В базе данных пути указывают на несуществующие файлы (mutant_ape_10002.png),
 * но реальные файлы имеют другие имена (mutant_ape_0048.png).
 * 
 * Решение: Обновить пути в базе данных, чтобы они указывали на существующие файлы.
 * Если файлов меньше, чем NFT, используем циклическое распределение.
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Подключение к базе данных PostgreSQL через DATABASE_URL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

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
 * Получает список всех Mutant Ape NFT из базы данных
 * @returns {Promise<Object[]>} Массив NFT объектов
 */
async function getMutantApeNFTs() {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT id, name, image_path 
      FROM nfts 
      WHERE collection_id = 2
      ORDER BY id
    `);
    return result.rows;
  } finally {
    client.release();
  }
}

/**
 * Распределяет существующие файлы Mutant Ape по NFT в базе данных
 * Использует циклическое распределение, если файлов меньше, чем NFT
 * @param {string[]} files Массив имен файлов
 * @param {Object[]} nfts Массив NFT объектов
 * @returns {Promise<void>}
 */
async function assignFilesToNFTs(files, nfts) {
  console.log(`Найдено ${files.length} файлов и ${nfts.length} NFT в базе данных`);
  
  if (files.length === 0) {
    console.error(`Ошибка: не найдено файлов Mutant Ape`);
    return;
  }

  // Создаем пул транзакций
  const client = await pool.connect();
  try {
    // Начинаем транзакцию
    await client.query('BEGIN');
    
    let updatedCount = 0;
    
    // Обновляем каждый NFT с новым путем
    for (let i = 0; i < nfts.length; i++) {
      const nft = nfts[i];
      const file = files[i % files.length]; // Циклически используем файлы
      const newPath = `/mutant_ape_nft/${file}`;
      
      // Проверяем, нужно ли обновлять путь
      if (nft.image_path !== newPath) {
        await client.query(`
          UPDATE nfts 
          SET image_path = $1 
          WHERE id = $2
        `, [newPath, nft.id]);
        
        updatedCount++;
        
        if (updatedCount <= 10 || updatedCount % 100 === 0) {
          console.log(`Обновлен NFT #${nft.id} (${nft.name}): ${nft.image_path} -> ${newPath}`);
        }
      }
    }
    
    // Фиксируем транзакцию
    await client.query('COMMIT');
    console.log(`Успешно обновлены пути для ${updatedCount} из ${nfts.length} NFT`);
  } catch (err) {
    // Откатываем транзакцию в случае ошибки
    await client.query('ROLLBACK');
    console.error('Ошибка при обновлении путей:', err);
  } finally {
    client.release();
  }
}

/**
 * Основная функция скрипта
 */
async function main() {
  try {
    // Получаем список файлов
    const files = await getMutantApeFiles();
    console.log(`Найдено ${files.length} файлов Mutant Ape`);
    
    // Получаем NFT из базы данных
    const nfts = await getMutantApeNFTs();
    console.log(`Найдено ${nfts.length} Mutant Ape NFT в базе данных`);
    
    // Распределяем файлы по NFT
    await assignFilesToNFTs(files, nfts);
    
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
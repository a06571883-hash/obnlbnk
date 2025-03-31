/**
 * Скрипт для прямого исправления путей к изображениям Mutant Ape NFT в базе данных
 * Использует прямой подход с обновлением через подготовленные запросы
 */

const fs = require('fs');
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
 * @returns {Promise<Object[]>} Массив ID NFT
 */
async function getMutantApeNFTIds() {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT id
      FROM nfts 
      WHERE collection_id = 2
      ORDER BY id
    `);
    return result.rows.map(row => row.id);
  } finally {
    client.release();
  }
}

/**
 * Обновляет пути изображений группами по 100 записей
 * @param {number[]} nftIds ID NFT для обновления
 * @param {string[]} files Имена файлов для использования
 */
async function updateImagePathsInBatches(nftIds, files) {
  if (files.length === 0) {
    console.error('Ошибка: не найдено файлов Mutant Ape');
    return;
  }

  const client = await pool.connect();
  try {
    console.log(`Начинаем обновление путей для ${nftIds.length} NFT...`);
    
    // Начинаем транзакцию
    await client.query('BEGIN');
    
    const batchSize = 100;
    let updatedCount = 0;
    
    for (let i = 0; i < nftIds.length; i += batchSize) {
      const batch = nftIds.slice(i, i + batchSize);
      const batchValues = [];
      const placeholders = [];
      
      for (let j = 0; j < batch.length; j++) {
        const nftId = batch[j];
        const fileIndex = i + j;
        const fileName = files[fileIndex % files.length]; // Циклически используем файлы
        const newPath = `/mutant_ape_nft/${fileName}`;
        
        batchValues.push(newPath, nftId);
        placeholders.push(`($${j*2+1}, $${j*2+2})`);
      }
      
      // Составляем запрос для пакетного обновления
      const query = `
        UPDATE nfts
        SET image_path = v.new_path
        FROM (VALUES ${placeholders.join(', ')}) AS v(new_path, nft_id)
        WHERE nfts.id = v.nft_id
      `;
      
      await client.query(query, batchValues);
      updatedCount += batch.length;
      console.log(`Обновлено ${updatedCount} из ${nftIds.length} NFT...`);
    }
    
    // Фиксируем транзакцию
    await client.query('COMMIT');
    
    console.log(`Успешно обновлены пути для ${updatedCount} Mutant Ape NFT`);
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
    
    // Получаем ID всех Mutant Ape NFT
    const nftIds = await getMutantApeNFTIds();
    console.log(`Найдено ${nftIds.length} Mutant Ape NFT в базе данных`);
    
    // Обновляем пути изображений пакетами
    await updateImagePathsInBatches(nftIds, files);
    
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
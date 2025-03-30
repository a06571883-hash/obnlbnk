/**
 * Скрипт для удаления дубликатов изображений NFT
 * Сканирует все изображения и удаляет повторяющиеся на основе контента изображения
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Получаем строку подключения из переменной окружения
const DATABASE_URL = process.env.DATABASE_URL;

// Настраиваем пул подключений
const pool = new Pool({
  connectionString: DATABASE_URL,
});

/**
 * Вычисляет хеш содержимого файла для идентификации дубликатов
 * @param {string} filePath Путь к файлу
 * @returns {Promise<string>} Хеш содержимого файла
 */
function calculateFileHash(filePath) {
  return new Promise((resolve, reject) => {
    try {
      const hash = crypto.createHash('md5');
      const stream = fs.createReadStream(filePath);
      
      stream.on('data', (data) => {
        hash.update(data);
      });
      
      stream.on('end', () => {
        resolve(hash.digest('hex'));
      });
      
      stream.on('error', (err) => {
        reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Главная функция для удаления дубликатов изображений
 */
async function removeDuplicateImages() {
  console.log('Запуск процесса удаления дубликатов изображений...');
  
  try {
    // Получаем все пути к изображениям NFT
    const getAllPathsQuery = 'SELECT id, token_id, image_path FROM nfts ORDER BY id';
    const allPathsResult = await pool.query(getAllPathsQuery);
    const allNFTs = allPathsResult.rows;
    
    console.log(`Получено ${allNFTs.length} NFT для анализа`);
    
    // Хешируем контент каждого файла для нахождения дубликатов
    const imageHashes = {};
    const duplicateGroups = {};
    const baseDir = '/home/runner/workspace';
    
    // Первый проход: вычисляем хеши файлов и находим дубликаты
    for (let i = 0; i < allNFTs.length; i++) {
      const nft = allNFTs[i];
      const imagePath = nft.image_path;
      
      if (!imagePath) {
        console.log(`NFT #${nft.id} не имеет пути к изображению`);
        continue;
      }
      
      const fullPath = path.join(baseDir, imagePath);
      
      // Проверяем существование файла
      if (!fs.existsSync(fullPath)) {
        console.log(`Файл не существует: ${fullPath}`);
        continue;
      }
      
      try {
        // Вычисляем хеш файла
        const fileHash = await calculateFileHash(fullPath);
        
        // Добавляем в группу дубликатов
        if (!imageHashes[fileHash]) {
          imageHashes[fileHash] = [];
        }
        
        imageHashes[fileHash].push({
          id: nft.id,
          tokenId: nft.token_id,
          imagePath
        });
        
        // Если это первый файл с таким хешем, создаем новую группу
        if (imageHashes[fileHash].length === 2) {
          duplicateGroups[fileHash] = imageHashes[fileHash];
        } else if (imageHashes[fileHash].length > 2) {
          duplicateGroups[fileHash] = imageHashes[fileHash];
        }
        
        // Показываем прогресс
        if (i % 100 === 0) {
          console.log(`Обработано ${i}/${allNFTs.length} изображений...`);
        }
      } catch (err) {
        console.error(`Ошибка при обработке файла ${fullPath}:`, err);
      }
    }
    
    // Анализируем дубликаты
    const duplicateCount = Object.keys(duplicateGroups).length;
    console.log(`Найдено ${duplicateCount} групп дубликатов изображений`);
    
    // Второй проход: удаляем дубликаты из базы данных
    let totalDuplicatesRemoved = 0;
    
    for (const hash in duplicateGroups) {
      const group = duplicateGroups[hash];
      
      if (group.length <= 1) continue; // Пропускаем, если нет дубликатов
      
      // Оставляем только первый элемент группы, удаляем остальные
      const keepItem = group[0];
      const removeItems = group.slice(1);
      
      console.log(`Группа дубликатов для изображения ${keepItem.imagePath}:`);
      console.log(`- Оставляем NFT #${keepItem.id} с tokenId ${keepItem.tokenId}`);
      
      // Удаляем дубликаты
      for (const item of removeItems) {
        console.log(`- Удаляем дубликат #${item.id} с tokenId ${item.tokenId}`);
        
        const deleteQuery = 'DELETE FROM nfts WHERE id = $1';
        await pool.query(deleteQuery, [item.id]);
        totalDuplicatesRemoved++;
      }
    }
    
    console.log(`Всего удалено ${totalDuplicatesRemoved} дубликатов изображений`);
    
    // Обновляем форматы цен для оставшихся NFT
    console.log('Обновление форматов цен...');
    const updatePricesQuery = `
      UPDATE nfts 
      SET price = 
        CASE 
          WHEN rarity = 'common' THEN '50'
          WHEN rarity = 'uncommon' THEN '1500'
          WHEN rarity = 'rare' THEN '5000'
          WHEN rarity = 'epic' THEN '10000'
          WHEN rarity = 'legendary' THEN '20000'
          ELSE '100'
        END
      WHERE image_path LIKE '%mutant_ape%'
    `;
    
    const updateMutantPricesResult = await pool.query(updatePricesQuery);
    console.log(`Обновлены цены для ${updateMutantPricesResult.rowCount} Mutant Ape NFT`);
    
    const updateBoredPricesQuery = `
      UPDATE nfts 
      SET price = 
        CASE 
          WHEN rarity = 'common' THEN '30'
          WHEN rarity = 'uncommon' THEN '1000'
          WHEN rarity = 'rare' THEN '3000'
          WHEN rarity = 'epic' THEN '8000'
          WHEN rarity = 'legendary' THEN '15000'
          ELSE '75'
        END
      WHERE image_path LIKE '%bored_ape%' OR image_path LIKE '%bayc_official%' OR image_path LIKE '%official_bored_ape%'
    `;
    
    const updateBoredPricesResult = await pool.query(updateBoredPricesQuery);
    console.log(`Обновлены цены для ${updateBoredPricesResult.rowCount} Bored Ape NFT`);
    
    return {
      success: true,
      duplicateGroupsCount: duplicateCount,
      removedDuplicates: totalDuplicatesRemoved
    };
    
  } catch (err) {
    console.error('Ошибка при удалении дубликатов изображений:', err);
    return {
      success: false,
      error: err.message
    };
  } finally {
    console.log('Завершение процесса удаления дубликатов изображений');
    await pool.end();
  }
}

// Запуск скрипта
removeDuplicateImages()
  .then(result => {
    console.log('\nРезультаты удаления дубликатов изображений:');
    console.log(JSON.stringify(result, null, 2));
    console.log('\n===============================');
    console.log('✅ Удаление дубликатов изображений успешно завершено!');
    console.log('===============================\n');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Критическая ошибка при удалении дубликатов изображений:', err);
    process.exit(1);
  });
/**
 * Скрипт для поиска и удаления дубликатов NFT по изображениям
 */
import pg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pg;
dotenv.config();

// Подключение к PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Находит и удаляет NFT с одинаковыми изображениями
 */
async function removeImageDuplicates() {
  console.log('Поиск и удаление NFT с одинаковыми изображениями...');
  
  try {
    // Подключение к базе данных
    const client = await pool.connect();
    
    try {
      // Проверим, есть ли дубликаты по image_path
      const checkDuplicatesQuery = `
        SELECT image_path, COUNT(*) as count
        FROM nfts
        WHERE image_path IS NOT NULL AND image_path != ''
        GROUP BY image_path
        HAVING COUNT(*) > 1
        ORDER BY count DESC
        LIMIT 10;
      `;
      
      console.log('Проверка на наличие дубликатов...');
      const checkResult = await client.query(checkDuplicatesQuery);
      
      if (checkResult.rows.length === 0) {
        console.log('Дубликаты не найдены. Проверим на возможные частичные совпадения по имени файла...');
        
        // Попробуем найти дубликаты по имени файла в image_path
        const checkByFilenameQuery = `
          SELECT 
            SUBSTRING(image_path FROM '[^/]+$') as filename,
            COUNT(*) as count
          FROM nfts
          WHERE image_path IS NOT NULL AND image_path != ''
          GROUP BY filename
          HAVING COUNT(*) > 1
          ORDER BY count DESC
          LIMIT 10;
        `;
        
        const filenameResult = await client.query(checkByFilenameQuery);
        
        if (filenameResult.rows.length === 0) {
          console.log('Дубликаты по имени файла также не найдены.');
          return { success: true, removed: 0 };
        }
        
        console.log('Найдены дубликаты по имени файла:');
        for (const row of filenameResult.rows) {
          console.log(`Файл: ${row.filename}, количество: ${row.count}`);
        }
        
        // Для каждого дубликата по имени файла, оставим только одну запись
        let totalRemoved = 0;
        
        for (const dup of filenameResult.rows) {
          const filename = dup.filename;
          
          // Получаем все NFT с этим именем файла
          const getNftsQuery = `
            SELECT id
            FROM nfts
            WHERE image_path LIKE '%${filename}'
            ORDER BY id ASC
          `;
          
          const nftsResult = await client.query(getNftsQuery);
          const nfts = nftsResult.rows;
          
          if (nfts.length > 1) {
            // Оставляем первый (с наименьшим id), удаляем остальные
            const idToKeep = nfts[0].id;
            const idsToRemove = nfts.slice(1).map(n => n.id);
            
            if (idsToRemove.length > 0) {
              // Удалить дубликаты
              const deleteQuery = `
                DELETE FROM nfts 
                WHERE id = ANY($1::int[])
              `;
              
              const deleteResult = await client.query(deleteQuery, [idsToRemove]);
              const removedCount = deleteResult.rowCount;
              
              totalRemoved += removedCount;
              console.log(`Удалено ${removedCount} дубликатов для файла ${filename}. Оставлен NFT с id=${idToKeep}.`);
            }
          }
        }
        
        console.log(`Всего удалено ${totalRemoved} дубликатов NFT по имени файла.`);
        return { success: true, removed: totalRemoved };
      }
      
      // Если найдены точные дубликаты по image_path
      console.log('Найдены дубликаты по полному пути к изображению:');
      for (const row of checkResult.rows) {
        console.log(`Путь: ${row.image_path}, количество: ${row.count}`);
      }
      
      // Найти все группы дубликатов и обработать их
      const findDuplicatesQuery = `
        SELECT image_path, ARRAY_AGG(id ORDER BY id) as nft_ids
        FROM nfts
        WHERE image_path IS NOT NULL AND image_path != ''
        GROUP BY image_path
        HAVING COUNT(*) > 1
      `;
      
      const duplicatesResult = await client.query(findDuplicatesQuery);
      const duplicates = duplicatesResult.rows;
      
      console.log(`Найдено ${duplicates.length} уникальных изображений с дубликатами.`);
      
      // Для каждого дубликата оставить только одну запись (с наименьшим id)
      let totalRemoved = 0;
      
      for (const dup of duplicates) {
        const imagePath = dup.image_path;
        const nftIds = dup.nft_ids;
        
        // Оставляем первый (с наименьшим id), удаляем остальные
        const idToKeep = nftIds[0];
        const idsToRemove = nftIds.slice(1);
        
        if (idsToRemove.length > 0) {
          // Удалить дубликаты
          const deleteQuery = `
            DELETE FROM nfts 
            WHERE id = ANY($1::int[])
          `;
          
          const deleteResult = await client.query(deleteQuery, [idsToRemove]);
          const removedCount = deleteResult.rowCount;
          
          totalRemoved += removedCount;
          console.log(`Удалено ${removedCount} дубликатов для изображения ${imagePath}. Оставлен NFT с id=${idToKeep}.`);
        }
      }
      
      console.log(`Всего удалено ${totalRemoved} дубликатов NFT.`);
      return { success: true, removed: totalRemoved };
      
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Ошибка при удалении дубликатов NFT по изображениям:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Проверка наличия одинаковых token_id
 */
async function checkDuplicateTokenIds() {
  console.log('Проверка наличия дубликатов по token_id...');
  
  try {
    // Подключение к базе данных
    const client = await pool.connect();
    
    try {
      // Найти дубликаты по token_id
      const findDuplicatesQuery = `
        SELECT token_id, COUNT(*) as count
        FROM nfts
        GROUP BY token_id
        HAVING COUNT(*) > 1
        ORDER BY count DESC;
      `;
      
      const duplicatesResult = await client.query(findDuplicatesQuery);
      const duplicates = duplicatesResult.rows;
      
      if (duplicates.length === 0) {
        console.log('Дубликаты по token_id не найдены.');
        return { success: true, count: 0 };
      }
      
      console.log(`Найдено ${duplicates.length} token_id с дубликатами:`);
      for (const dup of duplicates) {
        console.log(`  Token ID: ${dup.token_id}, количество: ${dup.count}`);
      }
      
      return { success: true, count: duplicates.length };
      
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Ошибка при проверке дубликатов по token_id:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Основная функция запуска скрипта
 */
async function main() {
  console.log('Запуск скрипта удаления дубликатов NFT по изображениям...');
  
  try {
    // Удалить дубликаты по изображениям
    const removeResult = await removeImageDuplicates();
    
    if (!removeResult.success) {
      console.error('Ошибка при удалении дубликатов по изображениям:', removeResult.error);
      return;
    }
    
    // Проверка дубликатов token_id после удаления
    if (removeResult.removed > 0) {
      console.log('Проверка дубликатов token_id после удаления изображений...');
      const checkResult = await checkDuplicateTokenIds();
      
      if (!checkResult.success) {
        console.error('Ошибка при проверке дубликатов token_id:', checkResult.error);
      } else if (checkResult.count > 0) {
        console.log(`Внимание: найдено ${checkResult.count} дубликатов по token_id. Рекомендуется запустить скрипт fix-token-ids.js для исправления.`);
      } else {
        console.log('Дубликаты token_id не обнаружены.');
      }
    }
    
    // Проверим общее количество NFT
    const client = await pool.connect();
    try {
      const countQuery = `SELECT COUNT(*) as count FROM nfts`;
      const countResult = await client.query(countQuery);
      const totalCount = parseInt(countResult.rows[0].count);
      
      console.log(`Всего уникальных NFT в базе данных: ${totalCount}`);
    } finally {
      client.release();
    }
    
    console.log('Скрипт завершен успешно.');
    
  } catch (error) {
    console.error('Ошибка при выполнении скрипта:', error);
  } finally {
    // Закрыть подключение к базе данных
    pool.end();
  }
}

// Запустить скрипт
main();
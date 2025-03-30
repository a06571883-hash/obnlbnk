/**
 * Скрипт для глубокой очистки дубликатов NFT
 * Проверяет дубликаты на уровне image_url и metadata
 */
import pg from 'pg';
import fs from 'fs';
import path from 'path';
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
      // Найти дубликаты по image_path
      const findDuplicatesQuery = `
        SELECT image_path, COUNT(*) as count, ARRAY_AGG(id ORDER BY id) as nft_ids
        FROM nfts
        WHERE image_path IS NOT NULL AND image_path != ''
        GROUP BY image_path
        HAVING COUNT(*) > 1
        ORDER BY count DESC;
      `;
      
      const duplicatesResult = await client.query(findDuplicatesQuery);
      const duplicates = duplicatesResult.rows;
      
      if (duplicates.length === 0) {
        console.log('NFT с одинаковыми изображениями не найдены.');
        return { success: true, removed: 0 };
      }
      
      console.log(`Найдено ${duplicates.length} уникальных изображений с дубликатами.`);
      
      // Для каждого дубликата оставить только одну запись (с наименьшим id)
      let totalRemoved = 0;
      
      for (const dup of duplicates) {
        const imagePath = dup.image_path;
        const count = parseInt(dup.count);
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
      
      console.log(`Всего удалено ${totalRemoved} дубликатов NFT на основе одинаковых изображений.`);
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
 * Проверяет пути к изображениям NFT и удаляет NFT с несуществующими файлами
 */
async function removeInvalidImagePaths() {
  console.log('Поиск и удаление NFT с несуществующими изображениями...');
  
  try {
    // Подключение к базе данных
    const client = await pool.connect();
    
    try {
      // Получить все NFT с их путями к изображениям
      const getNftsQuery = `
        SELECT id, token_id, image_path
        FROM nfts
      `;
      
      const nftsResult = await client.query(getNftsQuery);
      const nfts = nftsResult.rows;
      
      console.log(`Проверка путей к изображениям для ${nfts.length} NFT...`);
      
      // Проверить существование каждого файла
      const idsToRemove = [];
      
      for (const nft of nfts) {
        const imagePath = nft.image_path;
        
        if (!imagePath || imagePath === '') {
          idsToRemove.push(nft.id);
          continue;
        }
        
        // Извлечь локальный путь из URL
        let localPath = '';
        
        if (imagePath.includes('/bayc_official/')) {
          // Путь к официальным изображениям BAYC
          const fileName = path.basename(imagePath);
          localPath = path.join('public', 'bayc_official', fileName);
        } else if (imagePath.includes('/bored_ape_nft/')) {
          // Путь к изображениям в bored_ape_nft
          const fileName = path.basename(imagePath);
          localPath = path.join('bored_ape_nft', fileName);
        } else if (imagePath.includes('/public/assets/nft/')) {
          // Путь к изображениям в assets/nft
          const relPath = imagePath.split('/public/assets/nft/')[1];
          localPath = path.join('public', 'assets', 'nft', relPath);
        }
        
        // Проверить существование файла
        if (localPath && !fs.existsSync(localPath)) {
          console.log(`Файл не существует для NFT ${nft.id} (${nft.token_id}): ${localPath}`);
          idsToRemove.push(nft.id);
        }
      }
      
      if (idsToRemove.length === 0) {
        console.log('Все пути к изображениям NFT корректны.');
        return { success: true, removed: 0 };
      }
      
      console.log(`Найдено ${idsToRemove.length} NFT с несуществующими изображениями.`);
      
      // Удалить NFT с несуществующими изображениями
      if (idsToRemove.length > 0) {
        const deleteQuery = `
          DELETE FROM nfts 
          WHERE id = ANY($1::int[])
        `;
        
        const deleteResult = await client.query(deleteQuery, [idsToRemove]);
        const removedCount = deleteResult.rowCount;
        
        console.log(`Удалено ${removedCount} NFT с несуществующими изображениями.`);
        return { success: true, removed: removedCount };
      }
      
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Ошибка при проверке путей к изображениям NFT:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Обновляет token_id для обеспечения уникальности и последовательности
 */
async function normalizeTokenIds() {
  console.log('Нормализация token_id для всех NFT...');
  
  try {
    // Подключение к базе данных
    const client = await pool.connect();
    
    try {
      // Получить все уникальные NFT, отсортированные по текущему token_id
      const getNftsQuery = `
        SELECT id, token_id 
        FROM nfts 
        ORDER BY CAST(token_id AS INTEGER) ASC
      `;
      
      const nftsResult = await client.query(getNftsQuery);
      const nfts = nftsResult.rows;
      
      // Обновить каждый NFT с последовательным token_id
      let updateCount = 0;
      
      for (let i = 0; i < nfts.length; i++) {
        const nft = nfts[i];
        const newTokenId = i.toString();
        
        // Обновить token_id, если он отличается
        if (nft.token_id !== newTokenId) {
          const updateQuery = `
            UPDATE nfts 
            SET token_id = $1 
            WHERE id = $2
          `;
          
          await client.query(updateQuery, [newTokenId, nft.id]);
          updateCount++;
        }
      }
      
      console.log(`Обновлено ${updateCount} NFT для обеспечения последовательности token_id.`);
      return { success: true, updated: updateCount };
      
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Ошибка при нормализации token_id:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Основная функция запуска скрипта
 */
async function main() {
  console.log('Запуск скрипта глубокой очистки дубликатов NFT...');
  
  try {
    // Удалить дубликаты по изображениям
    const removeImageResult = await removeImageDuplicates();
    
    if (!removeImageResult.success) {
      console.error('Ошибка при удалении дубликатов по изображениям:', removeImageResult.error);
      return;
    }
    
    console.log(`Успешно удалено ${removeImageResult.removed} дубликатов NFT по изображениям.`);
    
    // Проверить недействительные пути к изображениям
    const invalidPathsResult = await removeInvalidImagePaths();
    
    if (!invalidPathsResult.success) {
      console.error('Ошибка при проверке путей к изображениям:', invalidPathsResult.error);
    } else {
      console.log(`Проверка путей к изображениям: удалено ${invalidPathsResult.removed} NFT с несуществующими файлами.`);
    }
    
    // Нормализовать token_id в любом случае
    const normalizeResult = await normalizeTokenIds();
    
    if (!normalizeResult.success) {
      console.error('Ошибка при нормализации token_id:', normalizeResult.error);
    } else {
      console.log(`Успешно обновлено ${normalizeResult.updated} token_id для последовательности.`);
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
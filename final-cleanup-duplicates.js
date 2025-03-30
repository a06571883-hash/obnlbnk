/**
 * Скрипт для окончательной очистки всех дубликатов NFT
 * с полной проверкой уникальности token_id
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const { Pool } = pg;

// Подключение к PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Находит и удаляет все дубликаты NFT с одинаковыми token_id
 * Оставляет только самую свежую запись для каждого token_id
 */
async function removeDuplicateTokenIds() {
  const client = await pool.connect();
  try {
    console.log('Поиск дубликатов по token_id...');
    
    // Находим все дубликаты по token_id
    const duplicatesResult = await client.query(`
      SELECT token_id, COUNT(*) as count 
      FROM nfts 
      GROUP BY token_id 
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC
    `);
    
    const duplicates = duplicatesResult.rows;
    console.log(`Найдено ${duplicates.length} дубликатов token_id`);
    
    if (duplicates.length === 0) {
      console.log('Дубликаты не найдены!');
      return;
    }
    
    // Для каждого дубликата оставляем только одну запись (самую свежую)
    // и удаляем остальные
    let totalRemoved = 0;
    
    for (const duplicate of duplicates) {
      const { token_id, count } = duplicate;
      console.log(`Обработка token_id ${token_id} (${count} дубликатов)`);
      
      // Получаем все записи с этим token_id, сортированные по дате создания (DESC)
      const nftsResult = await client.query(`
        SELECT id, token_id, minted_at, image_path 
        FROM nfts 
        WHERE token_id = $1 
        ORDER BY minted_at DESC
      `, [token_id]);
      
      const nfts = nftsResult.rows;
      
      // Оставляем первую запись (самую свежую) и удаляем остальные
      const idsToDelete = nfts.slice(1).map(nft => nft.id);
      
      if (idsToDelete.length > 0) {
        console.log(`Удаление ${idsToDelete.length} дубликатов для token_id ${token_id}`);
        
        // Удаляем дубликаты
        await client.query(`
          DELETE FROM nfts 
          WHERE id = ANY($1)
        `, [idsToDelete]);
        
        totalRemoved += idsToDelete.length;
      }
    }
    
    console.log(`Успешно удалено ${totalRemoved} дубликатов NFT`);
    
    // Проверяем результат очистки
    const countResult = await client.query('SELECT COUNT(*) FROM nfts');
    console.log(`Всего уникальных NFT в базе данных после очистки: ${countResult.rows[0].count}`);
    
    // Проверка, остались ли дубликаты
    const remainingDuplicatesResult = await client.query(`
      SELECT token_id, COUNT(*) 
      FROM nfts 
      GROUP BY token_id 
      HAVING COUNT(*) > 1
    `);
    
    if (remainingDuplicatesResult.rows.length > 0) {
      console.log(`ВНИМАНИЕ: В базе всё еще остались ${remainingDuplicatesResult.rows.length} дубликатов!`);
    } else {
      console.log('Все дубликаты успешно удалены!');
    }
    
  } catch (error) {
    console.error('Ошибка при удалении дубликатов:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Проверяет, что каждое NFT имеет соответствующий файл изображения
 * И удаляет NFT с несуществующими файлами
 */
async function removeNFTsWithMissingImages() {
  const client = await pool.connect();
  try {
    console.log('Проверка наличия файлов изображений для NFT...');
    
    // Получаем все NFT с путями к изображениям
    const nftsResult = await client.query(`
      SELECT id, token_id, image_path 
      FROM nfts
    `);
    
    const nfts = nftsResult.rows;
    console.log(`Всего NFT для проверки: ${nfts.length}`);
    
    let missingImages = 0;
    const idsToDelete = [];
    
    for (const nft of nfts) {
      const { id, token_id, image_path } = nft;
      
      if (!image_path) {
        console.log(`NFT ${id} (token_id ${token_id}) не имеет пути к изображению`);
        idsToDelete.push(id);
        missingImages++;
        continue;
      }
      
      // Преобразуем путь изображения в абсолютный путь на сервере
      const imageBasePath = '/home/runner/workspace'; // Базовый путь на Replit
      const relativePath = image_path.replace(/^\//, ''); // Удаляем начальный '/' если есть
      const imagePath = path.join(imageBasePath, relativePath);
      
      // Проверяем, существует ли файл
      if (!fs.existsSync(imagePath)) {
        console.log(`Файл изображения не найден для NFT ${id} (token_id ${token_id}): ${imagePath}`);
        idsToDelete.push(id);
        missingImages++;
      }
    }
    
    if (idsToDelete.length > 0) {
      console.log(`Удаление ${idsToDelete.length} NFT с отсутствующими изображениями...`);
      
      // Удаляем NFT с отсутствующими изображениями
      await client.query(`
        DELETE FROM nfts 
        WHERE id = ANY($1)
      `, [idsToDelete]);
      
      console.log(`Успешно удалено ${idsToDelete.length} NFT с отсутствующими изображениями`);
    } else {
      console.log('Все NFT имеют корректные пути к изображениям');
    }
    
  } catch (error) {
    console.error('Ошибка при проверке изображений:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Проверяет базу на наличие несоответствий и дублирующихся имен
 */
async function checkForInconsistencies() {
  const client = await pool.connect();
  try {
    console.log('Проверка несоответствий в базе данных...');
    
    // Проверка на дублирующиеся имена
    const duplicateNamesResult = await client.query(`
      SELECT name, COUNT(*) 
      FROM nfts 
      GROUP BY name 
      HAVING COUNT(*) > 1
    `);
    
    if (duplicateNamesResult.rows.length > 0) {
      console.log(`Найдено ${duplicateNamesResult.rows.length} дублирующихся имен NFT`);
      
      // Исправление дублирующихся имен путем добавления token_id к имени
      for (const duplicate of duplicateNamesResult.rows) {
        const { name } = duplicate;
        console.log(`Исправление дублирующегося имени: ${name}`);
        
        // Получаем все NFT с этим именем
        const nftsWithNameResult = await client.query(`
          SELECT id, token_id, name 
          FROM nfts 
          WHERE name = $1
        `, [name]);
        
        const nftsWithName = nftsWithNameResult.rows;
        
        // Для каждого NFT, кроме первого, обновляем имя, добавляя token_id
        for (let i = 1; i < nftsWithName.length; i++) {
          const nft = nftsWithName[i];
          const newName = `${name} #${nft.token_id}`;
          
          await client.query(`
            UPDATE nfts 
            SET name = $1 
            WHERE id = $2
          `, [newName, nft.id]);
          
          console.log(`Обновлено имя NFT ${nft.id} на "${newName}"`);
        }
      }
    } else {
      console.log('Дублирующихся имен не найдено');
    }
    
  } catch (error) {
    console.error('Ошибка при проверке несоответствий:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Основная функция запуска скрипта
 */
async function main() {
  try {
    console.log('Запуск скрипта окончательной очистки дубликатов NFT...');
    
    // Шаг 1: Удаление дубликатов по token_id
    await removeDuplicateTokenIds();
    
    // Шаг 2: Удаление NFT с отсутствующими изображениями
    await removeNFTsWithMissingImages();
    
    // Шаг 3: Проверка и исправление несоответствий
    await checkForInconsistencies();
    
    // Финальная проверка количества NFT
    const client = await pool.connect();
    try {
      const countResult = await client.query('SELECT COUNT(*) FROM nfts');
      console.log(`Финальное количество уникальных NFT в базе данных: ${countResult.rows[0].count}`);
    } finally {
      client.release();
    }
    
    console.log('Скрипт очистки дубликатов завершен успешно!');
    console.log('Для проверки результатов перезапустите приложение и обновите страницу маркетплейса');
    
  } catch (error) {
    console.error('Ошибка при выполнении скрипта:', error);
  } finally {
    // Закрываем пул соединений
    await pool.end();
    console.log('Подключение к базе данных закрыто.');
  }
}

// Запуск скрипта
main();
/**
 * Скрипт для восстановления правильных названий коллекций NFT
 * Возвращает Mutant Ape Yacht Club для мутантов и оставляет Bored Ape Yacht Club для обычных обезьян
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';

const { Pool } = pg;

// Создаем подключение к базе данных PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Определяет, относится ли NFT к коллекции Mutant Ape Yacht Club 
 * на основе пути к изображению (проверяет директорию)
 */
function isMutantApe(imagePath) {
  if (!imagePath) return false;
  
  // Проверяем, содержит ли путь к изображению 'mutant_ape' или находится в директории mutant_ape
  return imagePath.includes('mutant_ape') || 
         path.dirname(imagePath).includes('mutant_ape');
}

/**
 * Исправляет названия коллекций NFT
 */
async function fixCollectionNames() {
  const client = await pool.connect();
  
  try {
    console.log('Начинаем исправление названий коллекций NFT...');
    
    // Получаем все NFT с некорректными наименованиями
    const { rows: allNFTs } = await client.query(`
      SELECT id, name, image_path, token_id 
      FROM nfts
      ORDER BY id
    `);
    
    console.log(`Получено ${allNFTs.length} NFT для проверки и исправления`);
    
    let mutantCount = 0;
    let boredCount = 0;
    
    // Проходим по всем NFT и корректируем названия
    for (const nft of allNFTs) {
      const isMutant = isMutantApe(nft.image_path);
      const currentName = nft.name;
      
      // Определяем корректное название на основе пути к файлу
      let correctName;
      
      if (isMutant) {
        // Это Mutant Ape, проверяем нужно ли исправить название
        if (!currentName.includes('Mutant Ape')) {
          correctName = currentName.replace('Bored Ape', 'Mutant Ape');
          mutantCount++;
        }
      } else {
        // Это Bored Ape, проверяем нужно ли исправить название
        if (!currentName.includes('Bored Ape')) {
          correctName = currentName.replace('Mutant Ape', 'Bored Ape');
          boredCount++;
        }
      }
      
      // Если название нужно исправить
      if (correctName) {
        await client.query(`
          UPDATE nfts
          SET name = $1
          WHERE id = $2
        `, [correctName, nft.id]);
        
        console.log(`[${nft.id}] Исправлено: "${currentName}" -> "${correctName}"`);
      }
    }
    
    console.log(`Исправлено названий:`);
    console.log(`- Mutant Ape Yacht Club: ${mutantCount}`);
    console.log(`- Bored Ape Yacht Club: ${boredCount}`);
    console.log(`Всего исправлено: ${mutantCount + boredCount}`);
    
  } catch (error) {
    console.error('Ошибка при исправлении названий коллекций:', error);
  } finally {
    client.release();
  }
}

/**
 * Удаляет дубликаты NFT
 */
async function removeDuplicates() {
  const client = await pool.connect();
  
  try {
    console.log('Начинаем удаление дубликатов NFT...');
    
    // Находим дубликаты на основе token_id
    const { rows: duplicates } = await client.query(`
      SELECT token_id, COUNT(*) as count
      FROM nfts
      GROUP BY token_id
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `);
    
    console.log(`Найдено ${duplicates.length} токенов с дубликатами`);
    
    let removedCount = 0;
    
    // Удаляем дубликаты, оставляя только одну запись для каждого token_id
    for (const dup of duplicates) {
      // Получаем все дубликаты для текущего token_id
      const { rows: dupNfts } = await client.query(`
        SELECT id, name, token_id, minted_at as created_at 
        FROM nfts 
        WHERE token_id = $1
        ORDER BY id ASC
      `, [dup.token_id]);
      
      // Оставляем первую запись, удаляем остальные
      if (dupNfts.length > 1) {
        const keepId = dupNfts[0].id;
        const idsToRemove = dupNfts.slice(1).map(n => n.id);
        
        console.log(`TokenID: ${dup.token_id} - Сохраняем NFT #${keepId}, удаляем ${idsToRemove.length} дубликатов`);
        
        // Удаляем дубликаты
        await client.query(`
          DELETE FROM nfts
          WHERE id IN (${idsToRemove.join(',')})
        `);
        
        removedCount += idsToRemove.length;
      }
    }
    
    console.log(`Удалено ${removedCount} дублирующихся NFT`);
    
  } catch (error) {
    console.error('Ошибка при удалении дубликатов:', error);
  } finally {
    client.release();
  }
}

/**
 * Проверяет пути к изображениям NFT
 */
async function validateImagePaths() {
  const client = await pool.connect();
  
  try {
    console.log('Проверка путей к изображениям NFT...');
    
    // Получаем все NFT
    const { rows: allNFTs } = await client.query(`
      SELECT id, name, image_path, token_id 
      FROM nfts
      ORDER BY id
    `);
    
    console.log(`Получено ${allNFTs.length} NFT для проверки путей`);
    
    let fixedCount = 0;
    
    // Проверяем и исправляем пути к изображениям
    for (const nft of allNFTs) {
      const currentPath = nft.image_path;
      
      // Пропускаем, если путь корректный
      if (!currentPath || currentPath.trim() === '') {
        continue;
      }
      
      // Проверяем существование файла
      const exists = fs.existsSync(`.${currentPath}`);
      if (!exists) {
        console.log(`[${nft.id}] Файл не найден: ${currentPath}`);
        
        // Определяем коллекцию на основе имени
        const isMutant = nft.name.includes('Mutant Ape');
        const tokenId = nft.token_id;
        
        // Генерируем новый путь
        let newPath;
        if (isMutant) {
          newPath = `/mutant_ape_nft/mutant_ape_${tokenId}.png`;
        } else {
          newPath = `/bored_ape_nft/bored_ape_${tokenId}.png`;
        }
        
        // Проверяем существование нового пути
        if (fs.existsSync(`.${newPath}`)) {
          await client.query(`
            UPDATE nfts
            SET image_path = $1
            WHERE id = $2
          `, [newPath, nft.id]);
          
          console.log(`[${nft.id}] Исправлен путь: "${currentPath}" -> "${newPath}"`);
          fixedCount++;
        }
      }
    }
    
    console.log(`Исправлено ${fixedCount} путей к изображениям`);
    
  } catch (error) {
    console.error('Ошибка при проверке путей к изображениям:', error);
  } finally {
    client.release();
  }
}

/**
 * Перемешивает порядок NFT в маркетплейсе для случайной сортировки
 */
async function randomizeNftOrder() {
  const client = await pool.connect();
  
  try {
    console.log('Перемешивание порядка NFT...');
    
    // Обновляем поле sort_order для всех NFT случайными значениями
    await client.query(`
      UPDATE nfts
      SET sort_order = random() * 1000
    `);
    
    console.log('Порядок NFT успешно перемешан');
    
  } catch (error) {
    console.error('Ошибка при перемешивании порядка NFT:', error);
  } finally {
    client.release();
  }
}

/**
 * Главная функция скрипта
 */
async function main() {
  try {
    console.log('Запуск скрипта исправления NFT...');
    
    // Шаг 1: Исправить названия коллекций
    await fixCollectionNames();
    
    // Шаг 2: Удалить дубликаты
    await removeDuplicates();
    
    // Шаг 3: Проверить и исправить пути к изображениям
    await validateImagePaths();
    
    // Шаг 4: Перемешать порядок NFT для случайной сортировки
    await randomizeNftOrder();
    
    console.log('Все операции завершены успешно!');
    
  } catch (error) {
    console.error('Ошибка при выполнении скрипта:', error);
  } finally {
    process.exit(0);
  }
}

main();
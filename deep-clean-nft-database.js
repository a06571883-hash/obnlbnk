/**
 * Скрипт для полной очистки базы данных NFT от дубликатов
 * и удаления изображений, которые не являются обезьянами
 */
import { db, client, sql } from './server/db.js';
import { nfts } from './shared/schema.js';
import { eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

// Директории с изображениями
const NFT_DIRS = {
  BORED_APE: path.join(process.cwd(), 'bored_ape_nft'),
  MUTANT_APE: path.join(process.cwd(), 'mutant_ape_nft'),
  BAYC_OFFICIAL: path.join(process.cwd(), 'bayc_official_nft'),
  NEW_BORED_APE: path.join(process.cwd(), 'new_bored_ape_nft'),
  TEMP_EXTRACT: path.join(process.cwd(), 'temp_extract')
};

/**
 * Удаляет все дубликаты NFT на основе tokenId
 * Оставляет только одну уникальную запись для каждого tokenId
 * и удаляет остальные дублирующиеся записи
 */
async function removeDuplicateNFTs() {
  console.log('Начинаем очистку дубликатов NFT...');
  
  try {
    // Получаем все tokenId из базы данных
    const allTokenIds = await client`
      SELECT token_id, count(*) 
      FROM nft 
      GROUP BY token_id 
      HAVING count(*) > 1
    `;
    
    console.log(`Найдено ${allTokenIds.length} групп дублирующихся token_id в таблице nft (legacy)`);
    
    // Удаляем дубликаты, оставляя только самую свежую запись для каждого token_id
    for (const tokenIdGroup of allTokenIds) {
      const tokenId = tokenIdGroup.token_id;
      console.log(`Обработка дубликатов для token_id ${tokenId}...`);
      
      // Получаем все NFT с данным tokenId, сортируем по ID (самые новые записи имеют больший ID)
      const duplicates = await client`
        SELECT id FROM nft 
        WHERE token_id = ${tokenId} 
        ORDER BY id DESC
      `;
      
      if (duplicates.length <= 1) continue;
      
      // Оставляем самую свежую запись (первую в списке) и удаляем остальные
      const [keep, ...toDelete] = duplicates;
      const idsToDelete = toDelete.map(d => d.id);
      
      console.log(`Сохраняем NFT с ID ${keep.id}, удаляем ${idsToDelete.length} дубликатов`);
      
      // Удаляем дубликаты
      if (idsToDelete.length > 0) {
        await client`
          DELETE FROM nft 
          WHERE id IN (${sql.join(idsToDelete, sql`, `)})
        `;
      }
    }
    
    console.log('Очистка дубликатов по token_id в таблице nft (legacy) завершена');
    
    // Проверяем дубликаты в таблице nfts (Drizzle)
    const allDrizzleTokenIds = await db.execute(sql`
      SELECT "tokenId", count(*) 
      FROM nfts 
      GROUP BY "tokenId" 
      HAVING count(*) > 1
    `);
    
    console.log(`Найдено ${allDrizzleTokenIds.length} групп дублирующихся tokenId в таблице nfts (Drizzle)`);
    
    // Удаляем дубликаты, оставляя только самую свежую запись для каждого tokenId
    for (const tokenIdGroup of allDrizzleTokenIds) {
      const tokenId = tokenIdGroup.tokenId;
      console.log(`Обработка дубликатов для tokenId ${tokenId}...`);
      
      // Получаем все NFT с данным tokenId, сортируем по ID (самые новые записи имеют больший ID)
      const duplicateNfts = await db
        .select({ id: nfts.id })
        .from(nfts)
        .where(eq(nfts.tokenId, tokenId))
        .orderBy(nfts.id.desc());
      
      if (duplicateNfts.length <= 1) continue;
      
      // Оставляем самую свежую запись (первую в списке) и удаляем остальные
      const [keep, ...toDelete] = duplicateNfts;
      const idsToDelete = toDelete.map(d => d.id);
      
      console.log(`Сохраняем NFT с ID ${keep.id}, удаляем ${idsToDelete.length} дубликатов`);
      
      // Удаляем дубликаты
      if (idsToDelete.length > 0) {
        await db.execute(sql`
          DELETE FROM nfts 
          WHERE id IN (${sql.join(idsToDelete)})
        `);
      }
    }
    
    console.log('Очистка дубликатов по tokenId в таблице nfts (Drizzle) завершена');
    
    return true;
  } catch (error) {
    console.error('Ошибка при удалении дубликатов NFT:', error);
    return false;
  }
}

/**
 * Проверяет изображение и определяет, содержит ли оно обезьяну или нет
 * @param {string} imagePath Путь к изображению
 * @returns {Promise<boolean>} true если изображение содержит обезьяну, иначе false
 */
async function isApeImage(imagePath) {
  // Проверяем имя файла - если в названии есть "ape", "bored", "mutant", "bayc", считаем что это обезьяна
  const filename = path.basename(imagePath).toLowerCase();
  if (filename.includes('ape') || filename.includes('bored') || 
      filename.includes('mutant') || filename.includes('bayc')) {
    return true;
  }
  
  // Проверяем расширение - если это не изображение, считаем что это не обезьяна
  const ext = path.extname(imagePath).toLowerCase();
  if (!['.png', '.jpg', '.jpeg', '.avif', '.webp'].includes(ext)) {
    console.log(`Файл ${imagePath} имеет неподдерживаемое расширение ${ext}, считаем что это не обезьяна`);
    return false;
  }
  
  // Проверяем размер файла - обезьяны обычно имеют нормальный размер
  try {
    const stats = fs.statSync(imagePath);
    if (stats.size < 10 * 1024) { // Меньше 10KB скорее всего не обезьяна или очень маленькая картинка
      console.log(`Файл ${imagePath} слишком маленький (${stats.size} байт), считаем что это не обезьяна`);
      return false;
    }
  } catch (error) {
    console.error(`Ошибка при проверке размера файла ${imagePath}:`, error);
    return false; // Если не можем прочитать файл, считаем что это не обезьяна
  }
  
  return true;
}

/**
 * Очищает базу данных от NFT с изображениями, которые не содержат обезьян
 */
async function removeNonApeNFTs() {
  console.log('Начинаем проверку и удаление NFT, которые не являются обезьянами...');
  
  try {
    // Получаем все NFT из базы данных
    const allNfts = await db
      .select({
        id: nfts.id,
        tokenId: nfts.tokenId,
        imagePath: nfts.imagePath,
      })
      .from(nfts);
    
    console.log(`Проверяем ${allNfts.length} NFT на содержание обезьян...`);
    
    const nftsToDelete = [];
    let totalChecked = 0;
    let nonApeCount = 0;
    
    for (const nft of allNfts) {
      totalChecked++;
      
      if (totalChecked % 100 === 0) {
        console.log(`Проверено ${totalChecked} из ${allNfts.length} NFT...`);
      }
      
      // Нормализуем путь к изображению
      let imagePath = nft.imagePath;
      if (!imagePath) {
        console.log(`NFT ${nft.id} (${nft.tokenId}) не имеет пути к изображению, пропускаем`);
        continue;
      }
      
      // Преобразуем относительный путь в абсолютный
      let absolutePath = imagePath;
      if (!path.isAbsolute(imagePath)) {
        // Определяем базовую директорию в зависимости от пути
        let baseDir = process.cwd();
        
        if (imagePath.includes('bored_ape_nft/')) {
          absolutePath = path.join(process.cwd(), imagePath.replace('bored_ape_nft/', 'bored_ape_nft/'));
        } else if (imagePath.includes('mutant_ape_nft/')) {
          absolutePath = path.join(process.cwd(), imagePath.replace('mutant_ape_nft/', 'mutant_ape_nft/'));
        } else if (imagePath.includes('bayc_official_nft/')) {
          absolutePath = path.join(process.cwd(), imagePath.replace('bayc_official_nft/', 'bayc_official_nft/'));
        } else if (imagePath.startsWith('/')) {
          absolutePath = path.join(process.cwd(), imagePath.substring(1));
        } else {
          absolutePath = path.join(process.cwd(), imagePath);
        }
      }
      
      // Проверяем существование файла
      if (!fs.existsSync(absolutePath)) {
        // Пробуем искать в других директориях
        let found = false;
        for (const dirName in NFT_DIRS) {
          const dir = NFT_DIRS[dirName];
          const filename = path.basename(imagePath);
          const alternativePath = path.join(dir, filename);
          
          if (fs.existsSync(alternativePath)) {
            absolutePath = alternativePath;
            found = true;
            break;
          }
        }
        
        if (!found) {
          console.log(`Файл изображения для NFT ${nft.id} (${nft.tokenId}) не найден по пути ${absolutePath}, пропускаем`);
          continue;
        }
      }
      
      // Проверяем, содержит ли изображение обезьяну
      const isApe = await isApeImage(absolutePath);
      
      if (!isApe) {
        console.log(`NFT ${nft.id} (${nft.tokenId}) содержит изображение, которое не является обезьяной: ${imagePath}`);
        nftsToDelete.push(nft.id);
        nonApeCount++;
      }
    }
    
    // Удаляем NFT, которые не являются обезьянами
    if (nftsToDelete.length > 0) {
      console.log(`Удаляем ${nftsToDelete.length} NFT, которые не являются обезьянами...`);
      
      for (const id of nftsToDelete) {
        await db.delete(nfts).where(eq(nfts.id, id));
      }
      
      console.log(`Удалено ${nftsToDelete.length} NFT, которые не являются обезьянами`);
    } else {
      console.log('Не найдено NFT, которые не являются обезьянами');
    }
    
    console.log(`Проверка завершена. Всего проверено ${totalChecked} NFT, удалено ${nonApeCount} NFT`);
    
    return true;
  } catch (error) {
    console.error('Ошибка при удалении NFT, которые не являются обезьянами:', error);
    return false;
  }
}

/**
 * Проверяет, соответствуют ли пути к изображениям NFT их коллекциям
 * и корректирует пути при необходимости
 */
async function fixImagePaths() {
  console.log('Начинаем проверку и исправление путей к изображениям NFT...');
  
  try {
    // Получаем все NFT из базы данных
    const allNfts = await db
      .select({
        id: nfts.id,
        tokenId: nfts.tokenId,
        imagePath: nfts.imagePath,
        collectionId: nfts.collectionId,
        name: nfts.name
      })
      .from(nfts);
    
    console.log(`Проверяем пути к изображениям для ${allNfts.length} NFT...`);
    
    let updatedCount = 0;
    
    for (const nft of allNfts) {
      // Определяем правильную директорию на основе имени и коллекции
      let correctDir = '';
      const name = nft.name?.toLowerCase() || '';
      const isMutant = name.includes('mutant');
      
      if (isMutant) {
        correctDir = 'mutant_ape_nft';
      } else {
        correctDir = 'bored_ape_nft';
      }
      
      // Преобразуем текущий путь
      let currentPath = nft.imagePath || '';
      const filename = currentPath ? path.basename(currentPath) : '';
      
      if (!filename) {
        console.log(`NFT ${nft.id} (${nft.tokenId}) не имеет корректного пути к изображению: ${currentPath}`);
        continue;
      }
      
      // Создаем новый путь с правильной директорией
      const newPath = `/${correctDir}/${filename}`;
      
      // Если путь отличается, обновляем его
      if (newPath !== currentPath) {
        console.log(`Обновляем путь для NFT ${nft.id} (${nft.tokenId}): ${currentPath} -> ${newPath}`);
        
        await db.update(nfts)
          .set({ imagePath: newPath })
          .where(eq(nfts.id, nft.id));
        
        updatedCount++;
      }
    }
    
    console.log(`Обновлено ${updatedCount} путей к изображениям NFT`);
    
    return true;
  } catch (error) {
    console.error('Ошибка при исправлении путей к изображениям NFT:', error);
    return false;
  }
}

/**
 * Основная функция для запуска скрипта
 */
async function main() {
  console.log('Запуск полной очистки базы данных NFT...');
  
  try {
    // Удаляем дубликаты NFT
    const duplicatesRemoved = await removeDuplicateNFTs();
    if (!duplicatesRemoved) {
      console.error('Ошибка при удалении дубликатов NFT, прерываем выполнение');
      return;
    }
    
    // Удаляем NFT, которые не являются обезьянами
    const nonApeRemoved = await removeNonApeNFTs();
    if (!nonApeRemoved) {
      console.error('Ошибка при удалении NFT, которые не являются обезьянами, прерываем выполнение');
      return;
    }
    
    // Исправляем пути к изображениям NFT
    const pathsFixed = await fixImagePaths();
    if (!pathsFixed) {
      console.error('Ошибка при исправлении путей к изображениям NFT, прерываем выполнение');
      return;
    }
    
    console.log('Очистка базы данных NFT успешно завершена');
  } catch (error) {
    console.error('Произошла ошибка при выполнении скрипта:', error);
  }
}

main().catch(console.error).finally(() => {
  console.log('Скрипт завершил работу');
  process.exit(0);
});
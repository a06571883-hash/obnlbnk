/**
 * Скрипт для удаления дублирующихся NFT из базы данных
 * Более простая версия без использования ESM модулей
 */
const { Client } = require('pg');
const { config } = require('./server/config');
const fs = require('fs');
const path = require('path');

// Подключение к PostgreSQL
const client = new Client({
  connectionString: process.env.DATABASE_URL || config.databaseUrl
});

async function connectToDatabase() {
  try {
    await client.connect();
    console.log('Successfully connected to PostgreSQL database');
  } catch (error) {
    console.error('Error connecting to PostgreSQL database:', error);
    process.exit(1);
  }
}

/**
 * Удаляет все дубликаты NFT на основе tokenId из таблицы nft
 */
async function removeDuplicateNFTs() {
  console.log('Начинаем очистку дубликатов NFT...');
  
  try {
    // Получаем все токены с дубликатами
    const duplicateTokensResult = await client.query(`
      SELECT token_id, COUNT(*) 
      FROM nft 
      GROUP BY token_id 
      HAVING COUNT(*) > 1
    `);
    
    const duplicateTokens = duplicateTokensResult.rows;
    console.log(`Найдено ${duplicateTokens.length} групп дублирующихся token_id в таблице nft`);
    
    // Для каждого дублирующегося токена удаляем все, кроме одной записи
    for (const tokenGroup of duplicateTokens) {
      const tokenId = tokenGroup.token_id;
      console.log(`Обработка дубликатов для token_id ${tokenId}...`);
      
      // Получаем все NFT с этим tokenId, отсортированные по ID (по убыванию)
      const duplicatesResult = await client.query(`
        SELECT id FROM nft 
        WHERE token_id = $1 
        ORDER BY id DESC
      `, [tokenId]);
      
      const duplicates = duplicatesResult.rows;
      if (duplicates.length <= 1) continue;
      
      // Оставляем самую свежую запись (первую в списке) и удаляем остальные
      const [keep, ...toDelete] = duplicates;
      const idsToDelete = toDelete.map(d => d.id);
      
      console.log(`Сохраняем NFT с ID ${keep.id}, удаляем ${idsToDelete.length} дубликатов`);
      
      // Удаляем дубликаты
      if (idsToDelete.length > 0) {
        await client.query(`
          DELETE FROM nft 
          WHERE id = ANY($1)
        `, [idsToDelete]);
      }
    }
    
    console.log('Очистка дубликатов в таблице nft (legacy) завершена');
    
    // Проверяем дубликаты в таблице nfts
    const drizzleDuplicatesResult = await client.query(`
      SELECT "tokenId", COUNT(*) 
      FROM nfts 
      GROUP BY "tokenId" 
      HAVING COUNT(*) > 1
    `);
    
    const drizzleDuplicates = drizzleDuplicatesResult.rows;
    console.log(`Найдено ${drizzleDuplicates.length} групп дублирующихся tokenId в таблице nfts`);
    
    // Для каждого дублирующегося токена удаляем все, кроме одной записи
    for (const tokenGroup of drizzleDuplicates) {
      const tokenId = tokenGroup.tokenId;
      console.log(`Обработка дубликатов для tokenId ${tokenId}...`);
      
      // Получаем все NFT с этим tokenId, отсортированные по ID (по убыванию)
      const drizzleDuplicatesResult = await client.query(`
        SELECT id FROM nfts 
        WHERE "tokenId" = $1 
        ORDER BY id DESC
      `, [tokenId]);
      
      const drizzleDuplicatesList = drizzleDuplicatesResult.rows;
      if (drizzleDuplicatesList.length <= 1) continue;
      
      // Оставляем самую свежую запись (первую в списке) и удаляем остальные
      const [keep, ...toDelete] = drizzleDuplicatesList;
      const idsToDelete = toDelete.map(d => d.id);
      
      console.log(`Сохраняем NFT с ID ${keep.id}, удаляем ${idsToDelete.length} дубликатов`);
      
      // Удаляем дубликаты
      if (idsToDelete.length > 0) {
        await client.query(`
          DELETE FROM nfts 
          WHERE id = ANY($1)
        `, [idsToDelete]);
      }
    }
    
    console.log('Очистка дубликатов в таблице nfts (Drizzle) завершена');
    
    return true;
  } catch (error) {
    console.error('Ошибка при удалении дубликатов NFT:', error);
    return false;
  }
}

/**
 * Исправляет пути к изображениям NFT
 */
async function fixImagePaths() {
  console.log('Начинаем исправление путей к изображениям NFT...');
  
  try {
    // Получаем все NFT
    const nftsResult = await client.query(`
      SELECT id, "tokenId", "imagePath", "collectionId", name
      FROM nfts
    `);
    
    const allNfts = nftsResult.rows;
    console.log(`Проверяем пути к изображениям для ${allNfts.length} NFT...`);
    
    let updatedCount = 0;
    
    for (const nft of allNfts) {
      // Определяем правильную директорию на основе имени
      let correctDir = '';
      const name = (nft.name || '').toLowerCase();
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
        
        await client.query(`
          UPDATE nfts
          SET "imagePath" = $1
          WHERE id = $2
        `, [newPath, nft.id]);
        
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
 * Главная функция скрипта
 */
async function main() {
  try {
    await connectToDatabase();
    
    console.log('Запуск очистки дубликатов NFT...');
    
    // Удаляем дубликаты NFT
    const duplicatesRemoved = await removeDuplicateNFTs();
    if (!duplicatesRemoved) {
      console.error('Ошибка при удалении дубликатов NFT, прерываем выполнение');
      await client.end();
      return;
    }
    
    // Исправляем пути к изображениям NFT
    const pathsFixed = await fixImagePaths();
    if (!pathsFixed) {
      console.error('Ошибка при исправлении путей к изображениям NFT, прерываем выполнение');
      await client.end();
      return;
    }
    
    console.log('Очистка дубликатов NFT успешно завершена');
    
    await client.end();
    console.log('Database connection closed');
  } catch (error) {
    console.error('Произошла ошибка при выполнении скрипта:', error);
    if (client) {
      await client.end();
    }
  }
}

main();
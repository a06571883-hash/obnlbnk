/**
 * Скрипт для полного удаления дубликатов NFT и исправления неправильных путей к изображениям
 */
import pg from 'pg';
const { Pool } = pg;
import fs from 'fs';
import path from 'path';

// Подключение к базе данных
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function main() {
  console.log('🔄 Начинаем процесс очистки дубликатов NFT и исправления путей к изображениям...');

  try {
    // Получаем список всех NFT
    console.log('1️⃣ Получаем список всех NFT из базы данных...');
    const allNftsResult = await pool.query('SELECT * FROM nfts ORDER BY id');
    console.log(`Найдено ${allNftsResult.rows.length} NFT в базе данных.`);

    // Сохраняем первоначальные данные для сравнения
    const initialCount = allNftsResult.rows.length;
    console.log(`Изначальное количество NFT: ${initialCount}`);

    // Группировка NFT по collection_id для анализа
    const collections = {};
    allNftsResult.rows.forEach(nft => {
      const collectionId = nft.collection_id || 'undefined';
      if (!collections[collectionId]) {
        collections[collectionId] = 0;
      }
      collections[collectionId]++;
    });

    console.log('Распределение NFT по коллекциям:');
    Object.keys(collections).forEach(collection => {
      console.log(`- ${collection}: ${collections[collection]} NFT`);
    });

    // Определяем дубликаты по token_id
    console.log('2️⃣ Поиск дубликатов по token_id...');
    const tokenIds = {};
    const duplicates = [];

    allNftsResult.rows.forEach(nft => {
      if (!nft.token_id) return; // Пропускаем NFT без token_id

      if (!tokenIds[nft.token_id]) {
        tokenIds[nft.token_id] = [nft.id];
      } else {
        tokenIds[nft.token_id].push(nft.id);
        if (tokenIds[nft.token_id].length === 2) {
          duplicates.push(nft.token_id);
        }
      }
    });

    console.log(`Найдено ${duplicates.length} token_id с дубликатами.`);

    // Удаляем дубликаты, оставляя только одну запись с каждым token_id
    console.log('3️⃣ Удаление дубликатов...');
    
    let deletedCount = 0;
    
    for (const tokenId of duplicates) {
      const nftIds = tokenIds[tokenId];
      // Оставляем только первый ID, остальные удаляем
      const keepId = nftIds[0];
      const deleteIds = nftIds.slice(1);
      
      console.log(`Для token_id ${tokenId} оставляем NFT с ID ${keepId}, удаляем: ${deleteIds.join(', ')}`);
      
      // Удаляем связанные записи из nft_transfers
      for (const deleteId of deleteIds) {
        await pool.query('DELETE FROM nft_transfers WHERE nft_id = $1', [deleteId]);
      }
      
      // Удаляем дублирующие NFT
      const deleteResult = await pool.query(
        'DELETE FROM nft WHERE id = ANY($1::int[])', 
        [deleteIds]
      );
      
      deletedCount += deleteResult.rowCount;
    }
    
    console.log(`Удалено ${deletedCount} дублирующих NFT.`);

    // Проверяем наличие путей к изображениям Mutant Ape
    console.log('4️⃣ Поиск NFT с неправильными путями...');
    
    const wrongImagePathsResult = await pool.query(`
      SELECT n.id, c.name as collection_name, n.image_path
      FROM nfts n
      JOIN nft_collections c ON n.collection_id = c.id
      WHERE c.name LIKE '%Mutant%' AND (n.image_path NOT LIKE '%mutant%' OR n.image_path IS NULL)
    `);
    
    console.log(`Найдено ${wrongImagePathsResult.rows.length} Mutant Ape NFT с неправильными путями к изображениям.`);

    // Исправляем пути к изображениям Mutant Ape
    console.log('5️⃣ Исправление путей к изображениям Mutant Ape...');
    
    const mutantApeDirectory = path.join(process.cwd(), 'mutant_ape_nft');
    
    // Получаем список всех файлов изображений Mutant Ape
    let mutantApeImages = [];
    if (fs.existsSync(mutantApeDirectory)) {
      mutantApeImages = fs.readdirSync(mutantApeDirectory)
        .filter(file => file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg'))
        .map(file => path.join('/mutant_ape_nft', file));
      
      console.log(`Найдено ${mutantApeImages.length} изображений Mutant Ape для замены.`);
    } else {
      console.log(`Каталог Mutant Ape не найден: ${mutantApeDirectory}`);
    }

    // Исправляем пути для каждого Mutant Ape NFT с неправильным путем
    let fixedPaths = 0;
    
    for (const nft of wrongImagePathsResult.rows) {
      if (mutantApeImages.length > 0) {
        // Берем случайное изображение из каталога Mutant Ape
        const randomIndex = Math.floor(Math.random() * mutantApeImages.length);
        const newImageUrl = mutantApeImages[randomIndex];
        
        await pool.query(
          'UPDATE nfts SET image_path = $1 WHERE id = $2',
          [newImageUrl, nft.id]
        );
        
        console.log(`Обновлен путь для NFT #${nft.id}: ${nft.image_path || 'нет пути'} -> ${newImageUrl}`);
        fixedPaths++;
      }
    }
    
    console.log(`Исправлено ${fixedPaths} путей к изображениям Mutant Ape.`);

    // Проверяем конечное состояние
    console.log('6️⃣ Проверка конечного состояния базы данных...');
    
    const finalNftsResult = await pool.query('SELECT COUNT(*) FROM nfts');
    const finalCount = parseInt(finalNftsResult.rows[0].count);
    
    console.log(`Итоговое количество NFT: ${finalCount} (было: ${initialCount}, удалено: ${deletedCount}, разница: ${initialCount - finalCount})`);
    
    // Проверяем количество NFT в каждой коллекции
    const collectionCountsResult = await pool.query(`
      SELECT c.name as collection_name, COUNT(*) 
      FROM nfts n 
      JOIN nft_collections c ON n.collection_id = c.id
      GROUP BY c.name
    `);
    
    console.log('Итоговое распределение NFT по коллекциям:');
    collectionCountsResult.rows.forEach(row => {
      console.log(`- ${row.collection_name}: ${row.count} NFT`);
    });

    console.log('✅ Процесс успешно завершен!');
    
  } catch (error) {
    console.error('❌ Ошибка при выполнении скрипта:', error);
  } finally {
    // Закрываем соединение с базой данных
    await pool.end();
  }
}

main();
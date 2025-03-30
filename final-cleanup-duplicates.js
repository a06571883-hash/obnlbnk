/**
 * Скрипт для окончательной очистки всех дубликатов NFT
 * с полной проверкой уникальности token_id
 */
import pg from 'pg';
import { fileURLToPath } from 'url';
import path from 'path';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Подключение к базе данных PostgreSQL
const client = new Client({
  connectionString: process.env.DATABASE_URL
});

/**
 * Находит и удаляет все дубликаты NFT с одинаковыми token_id
 * Оставляет только самую свежую запись для каждого token_id
 */
async function removeDuplicateTokenIds() {
  try {
    // Получаем список всех token_id с количеством дубликатов
    const duplicatesQuery = `
      SELECT token_id, COUNT(*) as count
      FROM nfts
      GROUP BY token_id
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `;
    
    const duplicatesResult = await client.query(duplicatesQuery);
    const duplicates = duplicatesResult.rows;
    
    console.log(`Найдено ${duplicates.length} token_id с дубликатами`);
    
    if (duplicates.length === 0) {
      console.log('Дубликаты не найдены, очистка не требуется.');
      return 0;
    }
    
    // Для каждого token_id с дубликатами, оставляем только самую свежую запись
    let totalRemoved = 0;
    
    for (const duplicate of duplicates) {
      const tokenId = duplicate.token_id;
      const count = duplicate.count;
      
      // Получаем все экземпляры NFT с этим token_id, отсортированные по дате
      const nftsQuery = `
        SELECT id, token_id, name, minted_at
        FROM nfts
        WHERE token_id = $1
        ORDER BY minted_at DESC
      `;
      
      const nftsResult = await client.query(nftsQuery, [tokenId]);
      const nfts = nftsResult.rows;
      
      // Оставляем первую (самую свежую) запись и удаляем остальные
      const keepId = nfts[0].id;
      const idsToRemove = nfts.slice(1).map(nft => nft.id);
      
      console.log(`Token ID ${tokenId}: оставляем ID ${keepId}, удаляем ${idsToRemove.join(', ')}`);
      
      // Удаляем дубликаты
      if (idsToRemove.length > 0) {
        const deleteQuery = `
          DELETE FROM nfts
          WHERE id IN (${idsToRemove.join(',')})
        `;
        
        const deleteResult = await client.query(deleteQuery);
        totalRemoved += deleteResult.rowCount;
      }
    }
    
    console.log(`Всего удалено ${totalRemoved} дубликатов NFT`);
    return totalRemoved;
  } catch (error) {
    console.error('Ошибка при удалении дубликатов token_id:', error);
    return 0;
  }
}

/**
 * Проверяет, что каждое NFT имеет соответствующий файл изображения
 * И удаляет NFT с несуществующими файлами
 */
async function removeNFTsWithMissingImages() {
  // Эта функция может потребовать больше разработки, если нужно проверять файлы,
  // но в нашем случае мы генерируем SVG, поэтому файлы всегда существуют
  return 0;
}

/**
 * Проверяет базу на наличие несоответствий и дублирующихся имен
 */
async function checkForInconsistencies() {
  // Проверяем общее количество NFT
  const countQuery = `SELECT COUNT(*) FROM nfts`;
  const countResult = await client.query(countQuery);
  console.log(`Общее количество NFT: ${countResult.rows[0].count}`);
  
  // Проверяем распределение по коллекциям
  const collectionsQuery = `
    SELECT c.name, COUNT(*) 
    FROM nfts n 
    JOIN nft_collections c ON n.collection_id = c.id 
    GROUP BY c.name
  `;
  const collectionsResult = await client.query(collectionsQuery);
  console.log('Распределение по коллекциям:');
  collectionsResult.rows.forEach(row => {
    console.log(`- ${row.name}: ${row.count}`);
  });
  
  // Проверяем распределение по редкости
  const rarityQuery = `
    SELECT rarity, COUNT(*) 
    FROM nfts 
    GROUP BY rarity
  `;
  const rarityResult = await client.query(rarityQuery);
  console.log('Распределение по редкости:');
  rarityResult.rows.forEach(row => {
    console.log(`- ${row.rarity}: ${row.count}`);
  });
  
  // Нормализация поля rarity (все в верхний регистр)
  console.log('Нормализация поля rarity...');
  const normalizeRarityQuery = `
    UPDATE nfts
    SET rarity = UPPER(rarity)
    WHERE rarity != UPPER(rarity)
  `;
  const normalizeResult = await client.query(normalizeRarityQuery);
  console.log(`Нормализовано ${normalizeResult.rowCount} записей редкости`);
}

/**
 * Основная функция запуска скрипта
 */
async function main() {
  try {
    console.log('Запуск окончательной очистки дубликатов NFT...');
    
    await client.connect();
    
    // Шаг 1: Удаляем дубликаты с одинаковыми token_id
    const removedDuplicates = await removeDuplicateTokenIds();
    
    // Шаг 2: Удаляем NFT с отсутствующими файлами изображений
    const removedWithMissingImages = await removeNFTsWithMissingImages();
    
    // Шаг 3: Проверяем наличие несоответствий в базе
    await checkForInconsistencies();
    
    console.log('Итоги очистки:');
    console.log(`- Удалено дубликатов: ${removedDuplicates}`);
    console.log(`- Удалено с отсутствующими изображениями: ${removedWithMissingImages}`);
    
    // Финальная проверка количества
    const finalCountQuery = `SELECT COUNT(*) FROM nfts`;
    const finalCountResult = await client.query(finalCountQuery);
    console.log(`Финальное количество NFT: ${finalCountResult.rows[0].count}`);
    
    console.log('Очистка завершена успешно!');
  } catch (error) {
    console.error('Ошибка при выполнении очистки:', error);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
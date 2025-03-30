/**
 * Окончательный скрипт очистки дубликатов NFT с полным удалением повторяющихся tokenId
 * Этот скрипт серьезно очищает базу данных от всех дубликатов
 */
const { db } = require('./server/db');
const { nfts } = require('./shared/schema');
const { eq, sql } = require('drizzle-orm');

async function runDuplicateCleanup() {
  console.log('Запуск полной очистки дубликатов NFT...');

  try {
    // Шаг 1: Находим все дубликаты по tokenId
    console.log('Шаг 1: Поиск дубликатов по tokenId...');
    
    const query = `
      SELECT token_id, COUNT(*) as count, ARRAY_AGG(id) as ids
      FROM nfts 
      GROUP BY token_id 
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `;
    
    const duplicates = await db.execute(sql.raw(query));
    
    console.log(`Найдено ${duplicates.length} групп дубликатов с повторяющимися tokenId`);
    
    let totalDuplicates = 0;
    for (const group of duplicates) {
      totalDuplicates += group.count - 1; // вычитаем 1, так как оставляем один экземпляр
    }
    
    console.log(`Всего ${totalDuplicates} дубликатов NFT будет удалено`);
    
    // Шаг 2: Удаляем все дубликаты, оставляя только один экземпляр каждого tokenId
    console.log('Шаг 2: Удаление дубликатов...');
    
    let deletedCount = 0;
    
    for (const group of duplicates) {
      const tokenId = group.token_id;
      let ids = group.ids;
      
      // Проверяем, что ids это массив
      if (!Array.isArray(ids)) {
        ids = JSON.parse(ids);
      }
      
      console.log(`Обработка группы с tokenId=${tokenId}, количество дубликатов: ${ids.length}`);
      
      // Оставляем последний добавленный NFT (обычно с наибольшим ID)
      const sortedIds = [...ids].sort((a, b) => b - a);
      const keepId = sortedIds[0];
      const deleteIds = sortedIds.slice(1);
      
      console.log(`  Сохраняем NFT с ID=${keepId}, удаляем ${deleteIds.length} дубликатов`);
      
      // Удаляем все дубликаты кроме оставляемого
      for (const idToDelete of deleteIds) {
        await db.delete(nfts).where(eq(nfts.id, idToDelete));
        deletedCount++;
        
        if (deletedCount % 100 === 0) {
          console.log(`  Удалено ${deletedCount} дубликатов`);
        }
      }
    }
    
    console.log(`Удаление дубликатов завершено. Всего удалено: ${deletedCount} NFT`);
    
    // Шаг 3: Проверяем, что все tokenId теперь уникальны
    console.log('Шаг 3: Проверка уникальности tokenId...');
    
    const checkQuery = `
      SELECT token_id, COUNT(*) as count
      FROM nfts 
      GROUP BY token_id 
      HAVING COUNT(*) > 1
    `;
    
    const remainingDuplicates = await db.execute(sql.raw(checkQuery));
    
    if (remainingDuplicates.length > 0) {
      console.log(`ВНИМАНИЕ: Найдено ${remainingDuplicates.length} групп дубликатов после очистки:`);
      console.log(remainingDuplicates);
    } else {
      console.log('Проверка успешна! Все tokenId теперь уникальны.');
    }
    
    // Шаг 4: Проверяем, сколько NFT осталось в базе
    const countQuery = `SELECT COUNT(*) as total FROM nfts`;
    const countResult = await db.execute(sql.raw(countQuery));
    const totalNFTs = countResult[0].total;
    
    console.log(`Всего в базе данных осталось ${totalNFTs} NFT`);
    
    // Шаг 5: Обновляем статус forSale для всех NFT
    console.log('Шаг 5: Обновление статуса forSale для всех NFT...');
    
    const updateForSaleQuery = `
      UPDATE nfts 
      SET for_sale = true 
      WHERE for_sale = false
    `;
    
    await db.execute(sql.raw(updateForSaleQuery));
    
    console.log('Статус forSale обновлен для всех NFT.');
    
    return {
      success: true,
      deletedCount,
      totalRemaining: totalNFTs,
      uniqueTokenIds: true
    };
    
  } catch (error) {
    console.error('Ошибка при очистке дубликатов NFT:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Запускаем функцию очистки
runDuplicateCleanup()
  .then(result => {
    console.log('Результат очистки:', result);
    process.exit(0);
  })
  .catch(err => {
    console.error('Неожиданная ошибка:', err);
    process.exit(1);
  });
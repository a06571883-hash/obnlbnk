/**
 * Скрипт для проверки и исправления статуса маркетплейса NFT
 * Выявляет NFT, которые неправильно помечены как forSale = true или false
 * и исправляет их статус
 */
import pg from 'pg';
import fs from 'fs';
import path from 'path';

const { Pool } = pg;

// Подключение к PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

/**
 * Проверяет и исправляет статус NFT в маркетплейсе
 */
async function fixNFTMarketplaceStatus() {
  const client = await pool.connect();
  
  try {
    console.log('Начинаем проверку статуса NFT в маркетплейсе...');
    
    // Получаем все NFT
    const allNftsResult = await client.query('SELECT id, name, for_sale, price, owner_id FROM nfts');
    console.log(`Всего NFT в базе: ${allNftsResult.rows.length}`);
    
    // Получаем все NFT, которые отмечены как "на продаже"
    const forSaleNftsResult = await client.query('SELECT id, name, for_sale, price, owner_id FROM nfts WHERE for_sale = true');
    console.log(`NFT, отмеченные как "на продаже": ${forSaleNftsResult.rows.length}`);
    
    // Выводим примеры NFT на продажу
    console.log('\nПримеры NFT на продаже:');
    forSaleNftsResult.rows.slice(0, 5).forEach(nft => {
      console.log(`ID: ${nft.id}, Название: ${nft.name}, Цена: ${nft.price}, Владелец: ${nft.owner_id}`);
    });
    
    // Список ID неправильно помеченных NFT
    const badNfts = [];
    
    // Проверяем все NFT, чтобы убедиться, что они правильно помечены
    for (const nft of allNftsResult.rows) {
      // NFT должен быть помечен как "на продаже" если у него есть цена
      if (nft.price && parseFloat(nft.price) > 0 && !nft.for_sale) {
        console.log(`НЕ НА ПРОДАЖЕ, НО С ЦЕНОЙ: ID ${nft.id}, Название: ${nft.name}, Цена: ${nft.price}`);
        badNfts.push({ id: nft.id, shouldBeForSale: true });
      }
      
      // NFT должен быть НЕ помечен как "на продаже", если цена 0 или пуста
      if ((!nft.price || parseFloat(nft.price) === 0) && nft.for_sale) {
        console.log(`НА ПРОДАЖЕ, НО БЕЗ ЦЕНЫ: ID ${nft.id}, Название: ${nft.name}`);
        badNfts.push({ id: nft.id, shouldBeForSale: false });
      }
    }
    
    console.log(`\nНайдено ${badNfts.length} NFT с неправильным статусом продажи`);
    
    // Исправляем NFT с неправильным статусом
    if (badNfts.length > 0) {
      console.log('Исправляем статус для NFT...');
      
      for (const nft of badNfts) {
        const { id, shouldBeForSale } = nft;
        
        // Получаем текущую информацию об NFT
        const nftInfo = await client.query('SELECT name, price FROM nfts WHERE id = $1', [id]);
        const currentName = nftInfo.rows[0]?.name || 'Unknown';
        const currentPrice = nftInfo.rows[0]?.price || '0';
        
        // Обновляем статус NFT
        await client.query(
          'UPDATE nfts SET for_sale = $1 WHERE id = $2',
          [shouldBeForSale, id]
        );
        
        console.log(`ID ${id} "${currentName}" обновлен: for_sale = ${shouldBeForSale}, цена = ${currentPrice}`);
      }
      
      console.log('Статусы NFT успешно обновлены');
    } else {
      console.log('Все NFT имеют корректный статус продажи');
    }
    
    // Проверяем сколько теперь NFT на продажу после исправлений
    const updatedForSaleNftsResult = await client.query('SELECT COUNT(*) FROM nfts WHERE for_sale = true');
    console.log(`\nПосле исправлений NFT на продаже: ${updatedForSaleNftsResult.rows[0].count}`);
    
    // Получаем и выводим пользователей, у которых есть NFT на продаже
    const sellersResult = await client.query(`
      SELECT u.id, u.username, COUNT(n.id) as nft_count
      FROM users u
      JOIN nfts n ON u.id = n.owner_id
      WHERE n.for_sale = true
      GROUP BY u.id, u.username
      ORDER BY nft_count DESC
    `);
    
    console.log('\nПользователи, выставившие NFT на продажу:');
    for (const seller of sellersResult.rows) {
      console.log(`ID: ${seller.id}, Имя: ${seller.username}, Количество NFT на продаже: ${seller.nft_count}`);
    }
    
    return {
      totalNfts: allNftsResult.rows.length,
      forSaleNftsBefore: forSaleNftsResult.rows.length,
      fixedNfts: badNfts.length,
      forSaleNftsAfter: parseInt(updatedForSaleNftsResult.rows[0].count),
      sellerCount: sellersResult.rows.length
    };
    
  } catch (error) {
    console.error('Ошибка при проверке статуса NFT:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Удаляет дубликаты NFT в маркетплейсе
 */
async function removeNFTDuplicates() {
  const client = await pool.connect();
  
  try {
    console.log('\nПоиск дубликатов NFT по token_id...');
    
    // Находим дубликаты по token_id
    const duplicatesResult = await client.query(`
      SELECT token_id, COUNT(*) as count
      FROM nfts
      GROUP BY token_id
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `);
    
    console.log(`Найдено ${duplicatesResult.rows.length} токенов с дубликатами`);
    
    let totalDuplicatesRemoved = 0;
    
    // Для каждого token_id с дубликатами
    for (const duplicate of duplicatesResult.rows) {
      const { token_id, count } = duplicate;
      
      console.log(`\nОбработка token_id: ${token_id} (количество дубликатов: ${count})`);
      
      // Получаем все дубликаты для данного token_id
      const duplicateNfts = await client.query(`
        SELECT id, name, for_sale, price, owner_id, collection_id, minted_at
        FROM nfts
        WHERE token_id = $1
        ORDER BY id ASC
      `, [token_id]);
      
      // Выберем NFT, который нужно оставить (самый новый или тот, который на продаже)
      // Приоритет: 1) NFT на продаже, 2) самый недавний по minted_at
      let nftToKeep = duplicateNfts.rows[0];
      
      for (let i = 1; i < duplicateNfts.rows.length; i++) {
        const current = duplicateNfts.rows[i];
        
        // Если текущий NFT на продаже, а наш выбранный - нет, заменить
        if (current.for_sale && !nftToKeep.for_sale) {
          nftToKeep = current;
        }
        // Если оба на продаже или оба не на продаже, выбираем по дате создания
        else if ((current.for_sale === nftToKeep.for_sale) && 
                 new Date(current.minted_at) > new Date(nftToKeep.minted_at)) {
          nftToKeep = current;
        }
      }
      
      console.log(`Оставляем NFT с ID: ${nftToKeep.id}, Название: ${nftToKeep.name}, for_sale: ${nftToKeep.for_sale}`);
      
      // Удаляем все дубликаты, кроме выбранного
      const nftsToDelete = duplicateNfts.rows
        .filter(nft => nft.id !== nftToKeep.id)
        .map(nft => nft.id);
      
      if (nftsToDelete.length > 0) {
        // Перед удалением, удаляем связанные записи в таблице истории передач
        await client.query(`
          DELETE FROM nft_transfers
          WHERE nft_id = ANY($1::int[])
        `, [nftsToDelete]);
        
        // Удаляем сами NFT
        const deleteResult = await client.query(`
          DELETE FROM nfts
          WHERE id = ANY($1::int[])
          RETURNING id
        `, [nftsToDelete]);
        
        console.log(`Удалено ${deleteResult.rows.length} дубликатов NFT с IDs: ${nftsToDelete.join(', ')}`);
        totalDuplicatesRemoved += deleteResult.rows.length;
      }
    }
    
    console.log(`\nВсего удалено ${totalDuplicatesRemoved} дубликатов NFT`);
    
    return { totalDuplicatesRemoved };
    
  } catch (error) {
    console.error('Ошибка при удалении дубликатов NFT:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Главная функция для запуска скрипта
 */
async function main() {
  try {
    console.log('Запуск проверки и исправления статуса NFT маркетплейса...\n');
    
    // Шаг 1: Исправляем статусы NFT
    const statusFixResults = await fixNFTMarketplaceStatus();
    
    console.log('\n--- Результаты исправления статусов ---');
    console.log(`Всего NFT: ${statusFixResults.totalNfts}`);
    console.log(`NFT на продаже (до): ${statusFixResults.forSaleNftsBefore}`);
    console.log(`Исправлено NFT: ${statusFixResults.fixedNfts}`);
    console.log(`NFT на продаже (после): ${statusFixResults.forSaleNftsAfter}`);
    console.log(`Количество продавцов: ${statusFixResults.sellerCount}`);
    
    // Шаг 2: Удаляем дубликаты NFT
    const duplicateFixResults = await removeNFTDuplicates();
    
    console.log('\n--- Результаты удаления дубликатов ---');
    console.log(`Удалено дубликатов: ${duplicateFixResults.totalDuplicatesRemoved}`);
    
    console.log('\nПроверка и исправление NFT маркетплейса успешно завершены!');
  } catch (error) {
    console.error('Ошибка при выполнении скрипта:', error);
  } finally {
    // Закрываем пул соединений
    await pool.end();
  }
}

// Запускаем скрипт
main();
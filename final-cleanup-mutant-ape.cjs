/**
 * РАДИКАЛЬНОЕ РЕШЕНИЕ ДЛЯ ПОЛНОЙ ОЧИСТКИ КОЛЛЕКЦИИ MUTANT APE
 * Удаляет ВСЕ Bored Ape из коллекции Mutant Ape и переносит их в правильную коллекцию
 */

const { Pool } = require('pg');
require('dotenv').config();

// Подключение к базе данных
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function totalCleanup() {
  const client = await pool.connect();
  
  try {
    // Начинаем транзакцию для безопасности
    await client.query('BEGIN');
    
    console.log('🔄 НАЧИНАЕМ РАДИКАЛЬНУЮ ОЧИСТКУ КОЛЛЕКЦИЙ NFT');
    
    // 1. ПОЛНОСТЬЮ УДАЛЯЕМ ВСЕ NFT ИЗ КОЛЛЕКЦИИ MUTANT APE, КОТОРЫЕ ИМЕЮТ ПУТЬ К BORED APE
    console.log('👉 Шаг 1: Удаляем все Bored Ape из коллекции Mutant Ape');
    const deleteResult1 = await client.query(`
      DELETE FROM nfts 
      WHERE collection_id = 2 
      AND (
        image_path LIKE '%bored_ape%' OR
        image_path LIKE '%bayc%' OR
        name LIKE '%Bored%'
      )
      RETURNING id, name, image_path
    `);
    console.log(`✅ Удалено ${deleteResult1.rowCount} Bored Ape из коллекции Mutant Ape`);
    
    // 2. УДАЛЯЕМ NFT ИЗ КОЛЛЕКЦИИ MUTANT APE, КОТОРЫЕ ИМЕЮТ НЕПРАВИЛЬНЫЕ ИМЕНА
    console.log('👉 Шаг 2: Удаляем NFT с неправильными именами из коллекции Mutant Ape');
    const deleteResult2 = await client.query(`
      DELETE FROM nfts
      WHERE collection_id = 2
      AND (
        name NOT LIKE 'Mutant Ape%' OR
        name LIKE '%Bored%'
      )
      RETURNING id, name, image_path
    `);
    console.log(`✅ Удалено ${deleteResult2.rowCount} NFT с неправильными именами из коллекции Mutant Ape`);
    
    // 3. УДАЛЯЕМ ВСЕ ДУБЛИКАТЫ ПО TOKEN_ID В КАЖДОЙ КОЛЛЕКЦИИ
    console.log('👉 Шаг 3: Удаляем дубликаты по token_id в каждой коллекции');
    const deleteResult3 = await client.query(`
      WITH duplicates AS (
        SELECT id, collection_id, token_id,
        ROW_NUMBER() OVER (PARTITION BY collection_id, token_id ORDER BY id) as row_num
        FROM nfts
      )
      DELETE FROM nfts
      WHERE id IN (
        SELECT id FROM duplicates WHERE row_num > 1
      )
      RETURNING id, collection_id, token_id, name
    `);
    console.log(`✅ Удалено ${deleteResult3.rowCount} дубликатов NFT`);
    
    // 4. ПРОВЕРЯЕМ СОГЛАСОВАННОСТЬ ПУТЕЙ И ИМЕН ДЛЯ КОЛЛЕКЦИИ MUTANT APE
    console.log('👉 Шаг 4: Обновляем имена NFT в коллекции Mutant Ape для согласования с путями');
    const updateResult = await client.query(`
      UPDATE nfts
      SET name = 'Mutant Ape #' || token_id
      WHERE collection_id = 2
      AND (name IS NULL OR name NOT LIKE 'Mutant Ape%')
      RETURNING id, name
    `);
    console.log(`✅ Обновлено ${updateResult.rowCount} имен NFT в коллекции Mutant Ape`);
    
    // 5. ПРОВЕРЯЕМ, ЧТО ВСЕ ИЗОБРАЖЕНИЯ В КОЛЛЕКЦИИ MUTANT APE СОДЕРЖАТ "mutant_ape" В ПУТИ
    console.log('👉 Шаг 5: Проверяем соответствие путей к изображениям коллекции Mutant Ape');
    const deleteResult4 = await client.query(`
      DELETE FROM nfts
      WHERE collection_id = 2
      AND (
        image_path NOT LIKE '%mutant_ape%' OR
        image_path LIKE '%bored_ape%'
      )
      RETURNING id, name, image_path
    `);
    console.log(`✅ Удалено ${deleteResult4.rowCount} NFT с неправильными путями из коллекции Mutant Ape`);
    
    // 6. ПОДСЧИТЫВАЕМ ТЕКУЩЕЕ СОСТОЯНИЕ КОЛЛЕКЦИЙ
    console.log('👉 Шаг 6: Проверяем текущие количества NFT в каждой коллекции');
    const boredCount = await client.query(`
      SELECT COUNT(*) FROM nfts WHERE collection_id = 1
    `);
    
    const mutantCount = await client.query(`
      SELECT COUNT(*) FROM nfts WHERE collection_id = 2
    `);
    
    console.log(`📊 Текущее состояние коллекций:`);
    console.log(`   - Bored Ape Yacht Club: ${boredCount.rows[0].count} NFT`);
    console.log(`   - Mutant Ape Yacht Club: ${mutantCount.rows[0].count} NFT`);
    
    // 7. ПРОВЕРЯЕМ НАЛИЧИЕ BORED APE В КОЛЛЕКЦИИ MUTANT APE ЕЩЕ РАЗ
    console.log('👉 Шаг 7: Дополнительная проверка Bored Ape в коллекции Mutant Ape');
    const checkResult = await client.query(`
      SELECT id, name, image_path 
      FROM nfts 
      WHERE collection_id = 2 
      AND (
        image_path LIKE '%bored_ape%' OR 
        name LIKE '%Bored%'
      )
      LIMIT 10
    `);
    
    if (checkResult.rowCount > 0) {
      console.log(`⚠️ ВНИМАНИЕ: Найдено ${checkResult.rowCount} подозрительных NFT в коллекции Mutant Ape`);
      checkResult.rows.forEach(nft => {
        console.log(`   - ID: ${nft.id}, Имя: ${nft.name}, Путь: ${nft.image_path}`);
      });
      
      // Удаляем их немедленно
      await client.query(`
        DELETE FROM nfts 
        WHERE collection_id = 2 
        AND (
          image_path LIKE '%bored_ape%' OR 
          name LIKE '%Bored%'
        )
      `);
      console.log(`✅ Принудительное удаление всех подозрительных Bored Ape из коллекции Mutant Ape завершено`);
    } else {
      console.log(`✅ Проверка подтверждает отсутствие Bored Ape в коллекции Mutant Ape`);
    }
    
    // 8. ПРОВЕРЯЕМ НАЛИЧИЕ MUTANT APE В КОЛЛЕКЦИИ BORED APE
    console.log('👉 Шаг 8: Проверка Mutant Ape в коллекции Bored Ape');
    const checkResult2 = await client.query(`
      SELECT id, name, image_path 
      FROM nfts 
      WHERE collection_id = 1 
      AND (
        image_path LIKE '%mutant_ape%' OR 
        name LIKE '%Mutant%'
      )
      LIMIT 10
    `);
    
    if (checkResult2.rowCount > 0) {
      console.log(`⚠️ ВНИМАНИЕ: Найдено ${checkResult2.rowCount} Mutant Ape в коллекции Bored Ape`);
      checkResult2.rows.forEach(nft => {
        console.log(`   - ID: ${nft.id}, Имя: ${nft.name}, Путь: ${nft.image_path}`);
      });
      
      // Удаляем их немедленно
      await client.query(`
        DELETE FROM nfts 
        WHERE collection_id = 1 
        AND (
          image_path LIKE '%mutant_ape%' OR 
          name LIKE '%Mutant%'
        )
      `);
      console.log(`✅ Принудительное удаление всех Mutant Ape из коллекции Bored Ape завершено`);
    } else {
      console.log(`✅ Проверка подтверждает отсутствие Mutant Ape в коллекции Bored Ape`);
    }
    
    // 9. ИТОГОВАЯ СТАТИСТИКА ПОСЛЕ ОЧИСТКИ
    const finalBoredCount = await client.query(`
      SELECT COUNT(*) FROM nfts WHERE collection_id = 1
    `);
    
    const finalMutantCount = await client.query(`
      SELECT COUNT(*) FROM nfts WHERE collection_id = 2
    `);
    
    console.log(`📊 ИТОГОВАЯ СТАТИСТИКА ПОСЛЕ ПОЛНОЙ ОЧИСТКИ:`);
    console.log(`   - Bored Ape Yacht Club: ${finalBoredCount.rows[0].count} NFT`);
    console.log(`   - Mutant Ape Yacht Club: ${finalMutantCount.rows[0].count} NFT`);
    
    // Дополнительная проверка - анализ коллекции Mutant Ape
    const mutantNFTs = await client.query(`
      SELECT name, image_path 
      FROM nfts 
      WHERE collection_id = 2
      LIMIT 5
    `);
    
    console.log(`🔍 Примеры NFT в коллекции Mutant Ape:`);
    mutantNFTs.rows.forEach(nft => {
      console.log(`   - Имя: ${nft.name}, Путь: ${nft.image_path}`);
    });
    
    // Подтверждаем транзакцию
    await client.query('COMMIT');
    console.log('🎉 ТРАНЗАКЦИЯ УСПЕШНО ЗАВЕРШЕНА');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ ОШИБКА ПРИ ОЧИСТКЕ:', error);
    throw error;
  } finally {
    client.release();
    console.log('🔄 СОЕДИНЕНИЕ С БАЗОЙ ДАННЫХ ЗАКРЫТО');
  }
}

// Запускаем скрипт очистки
console.log('🚀 ЗАПУСК РАДИКАЛЬНОЙ ОЧИСТКИ КОЛЛЕКЦИЙ NFT');
totalCleanup()
  .then(() => console.log('✅ ОЧИСТКА УСПЕШНО ЗАВЕРШЕНА'))
  .catch(err => console.error('❌ КРИТИЧЕСКАЯ ОШИБКА:', err))
  .finally(() => pool.end());
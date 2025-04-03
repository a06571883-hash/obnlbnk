/**
 * Экстренный скрипт для полной очистки коллекций NFT
 * Удаляет все Bored Ape из коллекции Mutant Ape и наоборот
 * Также удаляет все дубликаты
 */

const { Pool } = require('pg');
require('dotenv').config();

// Получаем данные для подключения из переменных окружения
const {
  PGHOST,
  PGPORT,
  PGUSER,
  PGPASSWORD,
  PGDATABASE,
  DATABASE_URL
} = process.env;

// Создаем подключение к базе данных
const pool = new Pool({
  connectionString: DATABASE_URL || `postgresql://${PGUSER}:${PGPASSWORD}@${PGHOST}:${PGPORT}/${PGDATABASE}`,
  ssl: { rejectUnauthorized: false } // Для Neon PostgreSQL
});

async function fixCollections() {
  try {
    console.log('🚨 Запуск экстренной очистки коллекций NFT');
    
    const client = await pool.connect();
    console.log('✅ Подключение к базе данных успешно');
    
    try {
      // Начинаем транзакцию
      await client.query('BEGIN');
      console.log('🔄 Начата транзакция');
      
      // 1. Удаляем все Bored Ape из коллекции Mutant Ape
      // (коллекция 2) но путь к изображению содержит bored_ape
      const removeBored = await client.query(`
        DELETE FROM nfts 
        WHERE collection_id = 2 
        AND image_path LIKE '%/bored_ape%'
        RETURNING id, name, image_path
      `);
      
      console.log(`🧹 Удалено ${removeBored.rowCount} Bored Ape из коллекции Mutant Ape`);
      if (removeBored.rowCount > 0) {
        console.log('📝 Примеры удаленных NFT:');
        removeBored.rows.slice(0, 5).forEach(nft => {
          console.log(`   - ID: ${nft.id}, Имя: ${nft.name}, Путь: ${nft.image_path}`);
        });
      }
      
      // 2. Удаляем все Mutant Ape из коллекции Bored Ape
      const removeMutant = await client.query(`
        DELETE FROM nfts 
        WHERE collection_id = 1 
        AND image_path LIKE '%/mutant_ape%'
        RETURNING id, name, image_path
      `);
      
      console.log(`🧹 Удалено ${removeMutant.rowCount} Mutant Ape из коллекции Bored Ape`);
      if (removeMutant.rowCount > 0) {
        console.log('📝 Примеры удаленных NFT:');
        removeMutant.rows.slice(0, 5).forEach(nft => {
          console.log(`   - ID: ${nft.id}, Имя: ${nft.name}, Путь: ${nft.image_path}`);
        });
      }
      
      // 3. Очищаем все NFT с неправильными именами в своих коллекциях
      const cleanNames = await client.query(`
        DELETE FROM nfts 
        WHERE 
          (collection_id = 1 AND name LIKE 'Mutant Ape%') OR
          (collection_id = 2 AND name LIKE 'Bored Ape%')
        RETURNING id, name, image_path
      `);
      
      console.log(`🧹 Удалено ${cleanNames.rowCount} NFT с неправильными именами`);
      if (cleanNames.rowCount > 0) {
        console.log('📝 Примеры удаленных NFT:');
        cleanNames.rows.slice(0, 5).forEach(nft => {
          console.log(`   - ID: ${nft.id}, Имя: ${nft.name}, Путь: ${nft.image_path}`);
        });
      }
      
      // 4. Удаляем все дубликаты по token_id в каждой коллекции
      const removeDuplicates = await client.query(`
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
      
      console.log(`🧹 Удалено ${removeDuplicates.rowCount} дубликатов NFT`);
      if (removeDuplicates.rowCount > 0) {
        console.log('📝 Примеры удаленных дубликатов:');
        removeDuplicates.rows.slice(0, 5).forEach(nft => {
          console.log(`   - ID: ${nft.id}, Коллекция: ${nft.collection_id}, TokenID: ${nft.token_id}, Имя: ${nft.name}`);
        });
      }
      
      // 5. Обновляем имена NFT в обеих коллекциях
      const updateNames = await client.query(`
        UPDATE nfts 
        SET name = 
          CASE 
            WHEN collection_id = 1 THEN 'Bored Ape #' || token_id 
            WHEN collection_id = 2 THEN 'Mutant Ape #' || token_id
            ELSE name
          END
        WHERE (collection_id = 1 OR collection_id = 2)
        RETURNING id, collection_id, name
      `);
      
      console.log(`🔄 Обновлено ${updateNames.rowCount} имен NFT`);
      
      // Проверяем количество в каждой коллекции
      const boredCount = await client.query(`
        SELECT COUNT(*) FROM nfts WHERE collection_id = 1
      `);
      
      const mutantCount = await client.query(`
        SELECT COUNT(*) FROM nfts WHERE collection_id = 2
      `);
      
      console.log(`📊 Статистика после очистки:`);
      console.log(`   - Bored Ape Yacht Club: ${boredCount.rows[0].count} NFT`);
      console.log(`   - Mutant Ape Yacht Club: ${mutantCount.rows[0].count} NFT`);
      
      // Подтверждаем транзакцию
      await client.query('COMMIT');
      console.log('✅ Транзакция успешно завершена');
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('❌ Ошибка при очистке коллекций:', err);
      throw err;
    } finally {
      client.release();
      console.log('🔄 Соединение с базой данных закрыто');
    }
    
    console.log('✅ Очистка коллекций NFT успешно завершена');
  } catch (err) {
    console.error('❌ Критическая ошибка:', err);
  } finally {
    pool.end();
  }
}

// Запускаем функцию
fixCollections();
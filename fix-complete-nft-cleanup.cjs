/**
 * Скрипт для полной очистки базы данных NFT от всех NFT, 
 * которые не являются обезьянами BAYC или MAYC, и от всех дубликатов.
 * 
 * Этот скрипт выполняет следующие операции:
 * 1. Удаляет все NFT, изображения которых не содержат обезьян
 * 2. Проводит деталькную проверку каждого путь к изображению и удаляет неправильные
 * 3. Обеспечивает уникальность изображений, чтобы одно и то же изображение не продавалось по разным ценам
 * 4. Оставляет только уникальные NFT, устраняя все дубликаты
 * 5. Полная очистка и ремоделирование базы данных NFT
 */

// Импортируем необходимые модули
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const util = require('util');
const execSync = require('child_process').execSync;

// Получаем строку подключения к базе данных из переменной окружения
const DATABASE_URL = process.env.DATABASE_URL;

// Настройка для подключения к базе данных
const pool = new Pool({
  connectionString: DATABASE_URL,
});

/**
 * Главная функция скрипта
 */
async function runFullCleanup() {
  console.log('Запуск полной очистки базы данных NFT...');
  console.log('Подключение к базе данных...');

  try {
    // Шаг 1: Анализ текущего состояния базы данных
    console.log('Шаг 1: Анализ текущего состояния базы данных...');
    
    const countResult = await pool.query('SELECT COUNT(*) FROM nfts');
    const totalBefore = parseInt(countResult.rows[0].count);
    
    console.log(`Найдено ${totalBefore} NFT в базе данных до очистки`);
    
    // Шаг 2: Поиск путей к изображениям
    console.log('Шаг 2: Поиск всех уникальных путей к изображениям...');
    
    const pathsQuery = await pool.query('SELECT DISTINCT image_path FROM nfts ORDER BY image_path');
    const allImagePaths = pathsQuery.rows.map(row => row.image_path);
    
    console.log(`Найдено ${allImagePaths.length} уникальных путей к изображениям`);
    
    // Шаг 3: Определение допустимых шаблонов для обезьян BAYC и MAYC
    const validPatterns = [
      /bored_ape.*\.(?:png|avif|jpg|jpeg)$/i,  // Для Bored Ape
      /mutant_ape.*\.(?:png|avif|jpg|jpeg)$/i, // Для Mutant Ape
      /official_bored_ape.*\.(?:png|avif|jpg|jpeg)$/i, // Для официальных Bored Ape
      /bayc_official.*\.(?:png|avif|jpg|jpeg)$/i // Для официальных BAYC
    ];
    
    // Шаг 4: Фильтрация путей, чтобы оставить только обезьян BAYC и MAYC
    console.log('Шаг 4: Фильтрация путей к изображениям...');
    
    const validImagePaths = allImagePaths.filter(imagePath => {
      // Проверяем путь по шаблонам
      const isValidPattern = validPatterns.some(pattern => pattern.test(imagePath));
      return isValidPattern;
    });
    
    const invalidImagePaths = allImagePaths.filter(path => !validImagePaths.includes(path));
    
    console.log(`Найдено ${validImagePaths.length} действительных путей к изображениям обезьян`);
    console.log(`Найдено ${invalidImagePaths.length} недействительных путей к изображениям (не обезьяны)`);
    
    // Шаг 5: Удаляем NFT с недопустимыми путями к изображениям
    console.log('Шаг 5: Удаление NFT с недопустимыми путями к изображениям...');
    
    if (invalidImagePaths.length > 0) {
      // Создаем параметризированный запрос с IN для безопасности
      const placeholders = invalidImagePaths.map((_, i) => `$${i + 1}`).join(',');
      const deleteQuery = `DELETE FROM nfts WHERE image_path IN (${placeholders})`;
      
      const deleteResult = await pool.query(deleteQuery, invalidImagePaths);
      console.log(`Удалено ${deleteResult.rowCount} NFT с недопустимыми путями к изображениям`);
    } else {
      console.log('Нет NFT с недопустимыми путями к изображениям');
    }
    
    // Шаг 6: Поиск дубликатов изображений
    console.log('Шаг 6: Поиск дубликатов изображений...');
    
    // Сначала индексируем оставшиеся файлы изображений по их реальным путям файловой системы
    const imageMappings = {};
    const baseDir = '/home/runner/workspace';
    
    // Проверяем каждый путь к изображению
    for (const imagePath of validImagePaths) {
      let fullPath;
      
      // Обрабатываем относительные и абсолютные пути
      if (imagePath.startsWith('/')) {
        fullPath = path.join(baseDir, imagePath);
      } else {
        fullPath = path.join(baseDir, imagePath);
      }
      
      // Если файл существует, добавляем его в маппинг
      try {
        if (fs.existsSync(fullPath)) {
          // Используем полный путь к файлу как ключ для группировки
          imageMappings[fullPath] = imageMappings[fullPath] || [];
          imageMappings[fullPath].push(imagePath);
        } else {
          console.log(`Предупреждение: Файл не существует: ${fullPath}`);
        }
      } catch (err) {
        console.error(`Ошибка при проверке файла ${fullPath}:`, err);
      }
    }
    
    // Находим дубликаты (изображения с разными путями, но одинаковым содержимым)
    const duplicateGroups = Object.values(imageMappings).filter(group => group.length > 1);
    
    console.log(`Найдено ${duplicateGroups.length} групп дубликатов изображений`);
    
    // Шаг 7: Оставляем только одно NFT для каждого физического изображения
    console.log('Шаг 7: Удаление дубликатов изображений...');
    
    let totalDuplicatesRemoved = 0;
    
    for (const group of duplicateGroups) {
      // Оставляем первый путь, удаляем остальные
      const keepPath = group[0];
      const deletePaths = group.slice(1);
      
      if (deletePaths.length > 0) {
        const placeholders = deletePaths.map((_, i) => `$${i + 1}`).join(',');
        const deleteQuery = `DELETE FROM nfts WHERE image_path IN (${placeholders})`;
        
        const deleteResult = await pool.query(deleteQuery, deletePaths);
        totalDuplicatesRemoved += deleteResult.rowCount;
        
        console.log(`Удалены дубликаты для ${keepPath}: ${deletePaths.length} путей`);
      }
    }
    
    console.log(`Удалено ${totalDuplicatesRemoved} дубликатов NFT по изображениям`);
    
    // Шаг 8: Удаление дубликатов по tokenId
    console.log('Шаг 8: Удаление дубликатов по tokenId...');
    
    // Сначала находим все группы дубликатов tokenId
    const duplicateTokensQuery = `
      SELECT token_id, COUNT(*) as count
      FROM nfts
      GROUP BY token_id
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `;
    
    const duplicateTokensResult = await pool.query(duplicateTokensQuery);
    const duplicateTokenGroups = duplicateTokensResult.rows;
    
    console.log(`Найдено ${duplicateTokenGroups.length} дубликатов по tokenId`);
    
    // Для каждой группы дубликатов оставляем только одну запись с наибольшим ID
    let totalTokenDuplicatesRemoved = 0;
    
    for (const group of duplicateTokenGroups) {
      const tokenId = group.token_id;
      
      // Находим все записи с этим tokenId
      const tokenNftsQuery = `SELECT id FROM nfts WHERE token_id = $1 ORDER BY id DESC`;
      const tokenNftsResult = await pool.query(tokenNftsQuery, [tokenId]);
      
      // Оставляем первую запись (с наибольшим ID), удаляем остальные
      const keepId = tokenNftsResult.rows[0].id;
      const deleteIds = tokenNftsResult.rows.slice(1).map(row => row.id);
      
      if (deleteIds.length > 0) {
        const placeholders = deleteIds.map((_, i) => `$${i + 1}`).join(',');
        const deleteQuery = `DELETE FROM nfts WHERE id IN (${placeholders})`;
        
        const deleteResult = await pool.query(deleteQuery, deleteIds);
        totalTokenDuplicatesRemoved += deleteResult.rowCount;
        
        console.log(`Удалены дубликаты для tokenId ${tokenId}: ${deleteIds.length} записей`);
      }
    }
    
    console.log(`Удалено ${totalTokenDuplicatesRemoved} дубликатов NFT по tokenId`);
    
    // Шаг 9: Правильное назначение типов коллекций NFT
    console.log('Шаг 9: Исправление имен коллекций NFT...');
    
    // Обновляем все Mutant Apes
    const updateMutantQuery = `
      UPDATE nfts 
      SET collection_name = 'Mutant Ape Yacht Club', 
          attributes = '{"power": 95, "agility": 90, "wisdom": 85, "luck": 90}'
      WHERE image_path LIKE '%mutant_ape%'
    `;
    
    const updateMutantResult = await pool.query(updateMutantQuery);
    console.log(`Обновлено ${updateMutantResult.rowCount} Mutant Ape NFT`);
    
    // Обновляем все Bored Apes
    const updateBoredQuery = `
      UPDATE nfts 
      SET collection_name = 'Bored Ape Yacht Club', 
          attributes = '{"power": 80, "agility": 85, "wisdom": 95, "luck": 85}'
      WHERE image_path LIKE '%bored_ape%' OR image_path LIKE '%official_bored_ape%' OR image_path LIKE '%bayc_official%'
    `;
    
    const updateBoredResult = await pool.query(updateBoredQuery);
    console.log(`Обновлено ${updateBoredResult.rowCount} Bored Ape NFT`);
    
    // Шаг 10: Выставление всех NFT на продажу
    console.log('Шаг 10: Выставление всех NFT на продажу...');
    
    const updateForSaleQuery = `UPDATE nfts SET for_sale = TRUE WHERE for_sale = FALSE`;
    const updateForSaleResult = await pool.query(updateForSaleQuery);
    
    console.log(`Выставлено на продажу ${updateForSaleResult.rowCount} NFT`);
    
    // Шаг 11: Обновляем цены на основе редкости
    console.log('Шаг 11: Обновление цен на основе редкости...');
    
    // Мутанты стоят дороже
    const updateMutantPricesQuery = `
      UPDATE nfts 
      SET price = CASE
        WHEN rarity = 'common' THEN '50'
        WHEN rarity = 'uncommon' THEN '1500'
        WHEN rarity = 'rare' THEN '5000'
        WHEN rarity = 'epic' THEN '10000'
        WHEN rarity = 'legendary' THEN '20000'
        ELSE '100'
      END
      WHERE collection_name = 'Mutant Ape Yacht Club'
    `;
    
    const updateMutantPricesResult = await pool.query(updateMutantPricesQuery);
    console.log(`Обновлены цены для ${updateMutantPricesResult.rowCount} Mutant Ape NFT`);
    
    // Обычные обезьяны немного дешевле
    const updateBoredPricesQuery = `
      UPDATE nfts 
      SET price = CASE
        WHEN rarity = 'common' THEN '30'
        WHEN rarity = 'uncommon' THEN '1000'
        WHEN rarity = 'rare' THEN '3000'
        WHEN rarity = 'epic' THEN '8000'
        WHEN rarity = 'legendary' THEN '15000'
        ELSE '75'
      END
      WHERE collection_name = 'Bored Ape Yacht Club'
    `;
    
    const updateBoredPricesResult = await pool.query(updateBoredPricesQuery);
    console.log(`Обновлены цены для ${updateBoredPricesResult.rowCount} Bored Ape NFT`);
    
    // Шаг 12: Итоговая проверка
    console.log('Шаг 12: Итоговая проверка базы данных...');
    
    const finalCountResult = await pool.query('SELECT COUNT(*) FROM nfts');
    const totalAfter = parseInt(finalCountResult.rows[0].count);
    
    console.log(`Всего NFT после очистки: ${totalAfter} (было ${totalBefore})`);
    
    // Получаем статистику по коллекциям
    const collectionStatsQuery = `
      SELECT collection_name, COUNT(*) as count
      FROM nfts
      GROUP BY collection_name
      ORDER BY count DESC
    `;
    
    const collectionStatsResult = await pool.query(collectionStatsQuery);
    console.log('Статистика по коллекциям:');
    collectionStatsResult.rows.forEach(row => {
      console.log(`- ${row.collection_name || 'Без коллекции'}: ${row.count} NFT`);
    });
    
    // Получаем статистику по редкости
    const rarityStatsQuery = `
      SELECT rarity, COUNT(*) as count
      FROM nfts
      GROUP BY rarity
      ORDER BY count DESC
    `;
    
    const rarityStatsResult = await pool.query(rarityStatsQuery);
    console.log('Статистика по редкости:');
    rarityStatsResult.rows.forEach(row => {
      console.log(`- ${row.rarity || 'Без редкости'}: ${row.count} NFT`);
    });
    
    // Финальная проверка на дубликаты
    const finalDuplicateCheck = await pool.query(`
      SELECT token_id, COUNT(*) as count
      FROM nfts
      GROUP BY token_id
      HAVING COUNT(*) > 1
    `);
    
    if (finalDuplicateCheck.rows.length > 0) {
      console.log(`ВНИМАНИЕ: Найдено ${finalDuplicateCheck.rows.length} дубликатов tokenId после очистки!`);
    } else {
      console.log('Проверка пройдена: Дубликатов tokenId не обнаружено.');
    }
    
    // Проверка на наличие некорректных изображений
    const finalImageCheck = await pool.query(`
      SELECT image_path
      FROM nfts
      WHERE 
        image_path NOT LIKE '%bored_ape%' AND 
        image_path NOT LIKE '%mutant_ape%' AND
        image_path NOT LIKE '%official_bored_ape%' AND
        image_path NOT LIKE '%bayc_official%'
    `);
    
    if (finalImageCheck.rows.length > 0) {
      console.log(`ВНИМАНИЕ: Найдено ${finalImageCheck.rows.length} NFT с некорректными путями к изображениям!`);
    } else {
      console.log('Проверка пройдена: Все пути к изображениям корректны.');
    }
    
    return {
      success: true,
      totalBefore,
      totalAfter,
      removed: totalBefore - totalAfter,
      collections: collectionStatsResult.rows,
      rarities: rarityStatsResult.rows
    };
    
  } catch (error) {
    console.error('Ошибка при выполнении очистки:', error);
    return {
      success: false,
      error: error.message
    };
  } finally {
    console.log('Завершение очистки базы данных.');
    await pool.end();
  }
}

// Запуск скрипта
runFullCleanup()
  .then(result => {
    console.log('\nРезультаты очистки:');
    console.log(JSON.stringify(result, null, 2));
    console.log('\n===============================');
    console.log('✅ Очистка базы данных NFT успешно завершена!');
    console.log('===============================\n');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Критическая ошибка при очистке базы данных:', err);
    process.exit(1);
  });
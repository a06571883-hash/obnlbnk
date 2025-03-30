/**
 * Скрипт для исправления путей к изображениям NFT
 */
import pg from 'pg';

// Подключение к базе данных PostgreSQL
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL
});

/**
 * Исправляет пути для SVG-изображений в коллекции Mutant Ape
 */
async function fixMutantApePaths() {
  try {
    // SQL запрос для обновления путей
    const updateQuery = `
      UPDATE nfts 
      SET image_path = CONCAT('/public/assets/nft/mutant_ape_', token_id, '.svg')
      WHERE collection_id = (
        SELECT id FROM nft_collections WHERE name = 'Mutant Ape Yacht Club'
      )
      AND (
        image_path LIKE '%/mutant_ape_%' OR
        image_path LIKE '%/mayc_%' OR
        image_path LIKE '%/nft_assets/mutant_ape_%'
      )
    `;
    
    const result = await client.query(updateQuery);
    
    console.log(`Обновлено ${result.rowCount} путей для Mutant Ape NFT`);
    
    return { success: true, updated: result.rowCount };
  } catch (error) {
    console.error('Ошибка при обновлении путей Mutant Ape:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Исправляет пути для SVG-изображений в коллекции Bored Ape
 */
async function fixBoredApePaths() {
  try {
    // SQL запрос для обновления путей
    const updateQuery = `
      UPDATE nfts 
      SET image_path = CONCAT('/public/assets/nft/bored_ape_', token_id, '.svg')
      WHERE collection_id = (
        SELECT id FROM nft_collections WHERE name = 'Bored Ape Yacht Club'
      )
      AND (
        image_path LIKE '%/bored_ape_%' OR
        image_path LIKE '%/bayc_%'
      )
    `;
    
    const result = await client.query(updateQuery);
    
    console.log(`Обновлено ${result.rowCount} путей для Bored Ape NFT`);
    
    return { success: true, updated: result.rowCount };
  } catch (error) {
    console.error('Ошибка при обновлении путей Bored Ape:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Запускает проверку и восстановление всех невалидных путей
 */
async function scanAndFixAllInvalidPaths() {
  try {
    // Поиск записей с невалидными путями
    const findInvalidQuery = `
      SELECT 
        id,
        token_id,
        name,
        image_path,
        (SELECT name FROM nft_collections WHERE id = nfts.collection_id) as collection_name
      FROM nfts 
      WHERE image_path NOT LIKE '/public/assets/%'
      LIMIT 50
    `;
    
    const invalidResults = await client.query(findInvalidQuery);
    
    console.log(`Найдено ${invalidResults.rows.length} NFT с невалидными путями к изображениям`);
    
    for (const row of invalidResults.rows) {
      console.log(`ID: ${row.id}, Collection: ${row.collection_name}, TokenID: ${row.token_id}, Path: ${row.image_path}`);
    }
    
    // Обновляем все пути
    const updateAllQuery = `
      UPDATE nfts 
      SET image_path = CASE
        WHEN collection_id = (SELECT id FROM nft_collections WHERE name = 'Mutant Ape Yacht Club')
          THEN CONCAT('/public/assets/nft/mutant_ape_', token_id, '.svg')
        WHEN collection_id = (SELECT id FROM nft_collections WHERE name = 'Bored Ape Yacht Club')
          THEN CONCAT('/public/assets/nft/bored_ape_', token_id, '.svg')
        ELSE image_path
      END
      WHERE image_path NOT LIKE '/public/assets/%'
    `;
    
    const updateResult = await client.query(updateAllQuery);
    
    console.log(`Обновлено ${updateResult.rowCount} записей с невалидными путями`);
    
    return { success: true, updated: updateResult.rowCount };
  } catch (error) {
    console.error('Ошибка при сканировании и исправлении путей:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Основная функция для запуска скрипта
 */
async function main() {
  try {
    // Подключаемся к базе данных
    await client.connect();
    console.log('Подключено к базе данных');
    
    // Исправляем пути для Mutant Ape
    const mutantResult = await fixMutantApePaths();
    console.log('Результат исправления Mutant Ape:', mutantResult);
    
    // Исправляем пути для Bored Ape
    const boredResult = await fixBoredApePaths();
    console.log('Результат исправления Bored Ape:', boredResult);
    
    // Проверяем и исправляем все оставшиеся невалидные пути
    const scanResult = await scanAndFixAllInvalidPaths();
    console.log('Результат сканирования и исправления:', scanResult);
    
    console.log('Операция завершена успешно');
  } catch (error) {
    console.error('Ошибка при выполнении скрипта:', error);
  } finally {
    // Закрываем соединение с базой данных
    await client.end();
    console.log('Соединение с базой данных закрыто');
  }
}

// Запускаем основную функцию
main().catch(console.error);
/**
 * Скрипт для фиксации (закрепления) NFT изображений
 * Сохраняет текущий путь к изображению как оригинальный и использует его в дальнейшем
 */

import pg from 'pg';
import dotenv from 'dotenv';

const { Client } = pg;
dotenv.config();

// Подключаемся к PostgreSQL
const client = new Client({
  connectionString: process.env.DATABASE_URL
});

/**
 * Фиксирует изображения NFT для обеспечения постоянства
 * @param {number[]} nftIds - Опционально список конкретных ID NFT для обработки
 */
async function lockNftImages(nftIds = null) {
  try {
    await client.connect();
    console.log('Подключение к базе данных установлено');
    
    // Начинаем транзакцию
    await client.query('BEGIN');
    
    let whereClause = '';
    let params = [];
    
    if (nftIds && nftIds.length > 0) {
      whereClause = 'WHERE id = ANY($1)';
      params = [nftIds];
    }
    
    // 1. Обновляем поле original_image_path для новых NFT
    const updateQuery = `
      UPDATE nfts 
      SET original_image_path = image_path 
      ${whereClause}
      WHERE original_image_path IS NULL OR original_image_path = ''
    `;
    
    const result = await client.query(updateQuery, params);
    console.log(`Обновлено ${result.rowCount} NFT: сохранены текущие пути изображений как оригинальные`);
    
    // 2. Устанавливаем правило использования оригинального пути
    // Обновляем image_path на основе original_image_path, если они различаются для указанных NFT
    let updatePathParams = params.length > 0 ? params : [];
    const updatePathQuery = `
      UPDATE nfts 
      SET image_path = original_image_path 
      ${whereClause}
      WHERE image_path <> original_image_path AND original_image_path IS NOT NULL
    `;
    
    const updatePathResult = await client.query(updatePathQuery, updatePathParams);
    console.log(`Восстановлено ${updatePathResult.rowCount} NFT: восстановлены оригинальные пути изображений`);
    
    // Завершаем транзакцию
    await client.query('COMMIT');
    
    return {
      success: true,
      totalUpdated: result.rowCount,
      totalRestored: updatePathResult.rowCount
    };
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Ошибка при фиксации NFT изображений:', error);
    return {
      success: false,
      error: error.message
    };
  } finally {
    await client.end();
    console.log('Подключение к базе данных закрыто');
  }
}

/**
 * Главная функция для запуска скрипта
 */
async function main() {
  // Получаем аргументы из командной строки
  const args = process.argv.slice(2);
  let nftIds = null;
  
  // Если переданы ID NFT в формате --nfts=1,2,3
  const nftIdsArg = args.find(arg => arg.startsWith('--nfts='));
  if (nftIdsArg) {
    nftIds = nftIdsArg.replace('--nfts=', '').split(',').map(id => parseInt(id));
    console.log(`Обрабатываем конкретные NFT: ${nftIds.join(', ')}`);
  }
  
  try {
    console.log('Запуск скрипта фиксации NFT изображений...');
    const result = await lockNftImages(nftIds);
    
    if (result.success) {
      console.log(`Скрипт успешно выполнен: ${result.totalUpdated} NFT обновлено, ${result.totalRestored} NFT восстановлено`);
    } else {
      console.error('Ошибка при выполнении скрипта:', result.error);
    }
  } catch (error) {
    console.error('Необработанная ошибка:', error);
  }
}

// Запускаем скрипт
main();
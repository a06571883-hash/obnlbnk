/**
 * Скрипт для полного исправления путей ко всем NFT изображениям
 */
import pg from 'pg';

// Подключение к базе данных PostgreSQL
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL
});

/**
 * Исправляет пути для всех NFT изображений
 */
async function fixAllImagePaths() {
  try {
    // SQL запрос для обновления всех путей
    const updateQuery = `
      UPDATE nfts 
      SET image_path = CASE
        WHEN collection_id = (SELECT id FROM nft_collections WHERE name = 'Mutant Ape Yacht Club')
          THEN CONCAT('/assets/nft/mutant_ape_', token_id, '.svg')
        WHEN collection_id = (SELECT id FROM nft_collections WHERE name = 'Bored Ape Yacht Club')
          THEN CONCAT('/assets/nft/bored_ape_', token_id, '.svg')
        ELSE image_path
      END
    `;
    
    const result = await client.query(updateQuery);
    
    console.log(`Обновлено ${result.rowCount} путей для NFT`);
    
    return { success: true, updated: result.rowCount };
  } catch (error) {
    console.error('Ошибка при обновлении путей NFT:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Перемешивает порядок вывода NFT, добавляя случайные значения в поле сортировки
 */
async function randomizeNftOrder() {
  try {
    // Добавляем поле sort_order, если его еще нет
    try {
      const addColumnQuery = `
        ALTER TABLE nfts 
        ADD COLUMN IF NOT EXISTS sort_order FLOAT
      `;
      await client.query(addColumnQuery);
      console.log('Поле sort_order добавлено или уже существует');
    } catch (err) {
      console.log('Поле sort_order уже существует или возникла ошибка:', err);
    }
    
    // Обновляем поле sort_order случайными значениями
    const updateOrderQuery = `
      UPDATE nfts 
      SET sort_order = random()
    `;
    
    const result = await client.query(updateOrderQuery);
    
    console.log(`Случайные значения для сортировки добавлены для ${result.rowCount} NFT`);
    
    return { success: true, updated: result.rowCount };
  } catch (error) {
    console.error('Ошибка при перемешивании NFT:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Проверяет текущие значения SQL запросов для маркетплейса
 */
async function checkMarketplaceQueries() {
  try {
    // Анализируем SQL запросы, используемые для получения NFT
    const nftController = await import('./server/controllers/nft-controller.js');
    
    if (nftController && nftController.default) {
      console.log('NFT контроллер найден');
      
      // Выводим информацию о доступных маршрутах
      const routes = nftController.default.stack
        .filter(layer => layer.route)
        .map(layer => {
          return {
            path: layer.route.path,
            methods: Object.keys(layer.route.methods)
          };
        });
      
      console.log('Маршруты NFT контроллера:', routes);
    } else {
      console.log('NFT контроллер не найден или не содержит маршрутов');
    }
    
    // Проверяем количество NFT в каждой коллекции
    const boredApeQuery = `
      SELECT COUNT(*) FROM nfts 
      WHERE collection_id = (SELECT id FROM nft_collections WHERE name = 'Bored Ape Yacht Club')
    `;
    
    const mutantApeQuery = `
      SELECT COUNT(*) FROM nfts 
      WHERE collection_id = (SELECT id FROM nft_collections WHERE name = 'Mutant Ape Yacht Club')
    `;
    
    const boredApeResult = await client.query(boredApeQuery);
    const mutantApeResult = await client.query(mutantApeQuery);
    
    console.log(`Количество Bored Ape NFT: ${boredApeResult.rows[0].count}`);
    console.log(`Количество Mutant Ape NFT: ${mutantApeResult.rows[0].count}`);
    
    return { 
      success: true, 
      boredApeCount: parseInt(boredApeResult.rows[0].count), 
      mutantApeCount: parseInt(mutantApeResult.rows[0].count) 
    };
  } catch (error) {
    console.error('Ошибка при проверке запросов маркетплейса:', error);
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
    
    // Исправляем пути к изображениям
    const fixResult = await fixAllImagePaths();
    console.log('Результат исправления путей:', fixResult);
    
    // Перемешиваем порядок NFT
    const randomizeResult = await randomizeNftOrder();
    console.log('Результат перемешивания NFT:', randomizeResult);
    
    // Проверяем текущие запросы маркетплейса
    const checkResult = await checkMarketplaceQueries();
    console.log('Результат проверки запросов маркетплейса:', checkResult);
    
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
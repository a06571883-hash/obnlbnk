/**
 * Скрипт для корректного импорта только Mutant Ape NFT 
 * с правильными путями к изображениям
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const { Pool } = pg;

// Подключение к базе данных PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Константы и конфигурация
const COLLECTION_NAME = 'Mutant Ape Yacht Club';
const BASE_DIR = './mutant_ape_nft';
const IMAGE_PUBLIC_PATH = '/mutant_ape_nft';

/**
 * Получает все изображения Mutant Ape из директории
 */
function scanMutantApeDirectory() {
  const images = [];
  
  try {
    if (!fs.existsSync(BASE_DIR)) {
      console.error(`Директория ${BASE_DIR} не существует!`);
      return images;
    }
    
    const files = fs.readdirSync(BASE_DIR)
      .filter(file => 
        (file.endsWith('.png') || file.endsWith('.jpg')) && 
        file.toLowerCase().includes('mutant_ape')
      );
    
    console.log(`Найдено ${files.length} изображений Mutant Ape в директории ${BASE_DIR}`);
    
    for (const file of files) {
      const match = file.match(/mutant_ape_(\d+)\.png/i);
      if (match) {
        const tokenId = parseInt(match[1]);
        images.push({
          tokenId,
          fileName: file,
          fullPath: path.join(BASE_DIR, file),
          publicPath: `${IMAGE_PUBLIC_PATH}/${file}`
        });
      }
    }
    
    console.log(`Подготовлено ${images.length} изображений Mutant Ape`);
    return images;
  } catch (error) {
    console.error(`Ошибка при сканировании директории ${BASE_DIR}:`, error);
    return images;
  }
}

/**
 * Определяет редкость NFT на основе его ID
 */
function determineRarity(tokenId) {
  // Определяем редкость на основе ID токена
  if (tokenId % 100 === 0) return 'legendary'; // Каждый сотый
  if (tokenId % 50 === 0) return 'epic';       // Каждый пятидесятый
  if (tokenId % 20 === 0) return 'rare';       // Каждый двадцатый
  if (tokenId % 5 === 0) return 'uncommon';    // Каждый пятый
  return 'common';                            // Все остальные
}

/**
 * Генерирует цену для NFT на основе его редкости
 */
function generateNFTPrice(tokenId, rarity) {
  // Базовые цены по редкости
  const basePrice = {
    'common': 60,
    'uncommon': 200,
    'rare': 800,
    'epic': 3000,
    'legendary': 12000
  };
  
  // Вносим некоторую случайность в цену
  const randomFactor = 0.8 + (0.4 * Math.random());
  
  // Особые цены для некоторых токенов
  if (tokenId === 1) return 20000; // Самый первый токен
  if (tokenId <= 10) return 8000 + Math.random() * 3000; // Первые 10
  
  return (basePrice[rarity] * randomFactor).toFixed(2);
}

/**
 * Генерирует атрибуты для NFT
 */
function generateNFTAttributes(tokenId, rarity) {
  // Создаем псевдослучайные значения на основе tokenId
  const seed = tokenId;
  const hash = crypto.createHash('md5').update(seed.toString()).digest('hex');
  
  // Определяем базовые значения в зависимости от редкости
  let baseValue = 0;
  switch (rarity) {
    case 'legendary': baseValue = 85; break;
    case 'epic': baseValue = 75; break;
    case 'rare': baseValue = 65; break;
    case 'uncommon': baseValue = 55; break;
    default: baseValue = 45;
  }
  
  // Генерируем случайные отклонения для атрибутов
  function getVariation(index) {
    const value = parseInt(hash.substring(index * 2, index * 2 + 2), 16);
    return (value % 20) - 10; // отклонение от -10 до +10
  }
  
  return {
    power: Math.min(100, Math.max(1, baseValue + 15 + getVariation(0))),  // Мутанты сильнее
    agility: Math.min(100, Math.max(1, baseValue + 10 + getVariation(1))), // И быстрее
    wisdom: Math.min(100, Math.max(1, baseValue - 10 + getVariation(2))),  // Но намного глупее
    luck: Math.min(100, Math.max(1, baseValue + 5 + getVariation(3)))     // Чуть более удачливые
  };
}

/**
 * Устанавливает регулятора (администратора) как владельца NFT
 */
async function getRegulatorId() {
  const client = await pool.connect();
  try {
    // Ищем регулятора (администратора) в системе
    const adminResult = await client.query(
      'SELECT id FROM users WHERE is_regulator = true LIMIT 1'
    );
    
    if (adminResult.rows.length > 0) {
      const regulatorId = adminResult.rows[0].id;
      console.log(`Найден регулятор (администратор) с ID=${regulatorId}`);
      return regulatorId;
    }
    
    // Если регулятор не найден, используем первого пользователя
    const firstUserResult = await client.query(
      'SELECT id FROM users ORDER BY id LIMIT 1'
    );
    
    if (firstUserResult.rows.length > 0) {
      const firstUserId = firstUserResult.rows[0].id;
      console.log(`Регулятор не найден, используем первого пользователя с ID=${firstUserId}`);
      return firstUserId;
    }
    
    console.log('Пользователи не найдены, используем ID=1');
    return 1;
  } finally {
    client.release();
  }
}

/**
 * Импортирует коллекцию Mutant Ape NFT
 */
async function importMutantApeCollection() {
  const client = await pool.connect();
  try {
    console.log('Начало импорта коллекции Mutant Ape...');
    
    // Проверяем, существует ли коллекция с ID=2
    const collectionResult = await client.query(
      'SELECT id FROM nft_collections WHERE id = 2'
    );
    
    if (collectionResult.rows.length === 0) {
      // Создаем коллекцию, если не существует
      await client.query(
        'INSERT INTO nft_collections (id, name, description, cover_image) VALUES ($1, $2, $3, $4)',
        [
          2,
          COLLECTION_NAME,
          'Коллекция Mutant Ape Yacht Club - мутировавшие обезьяны из престижного клуба BAYC.',
          '/mutant_ape_nft/mutant_ape_0001.png'
        ]
      );
      console.log('Создана новая коллекция Mutant Ape Yacht Club с ID=2');
    } else {
      console.log('Найдена существующая коллекция Mutant Ape Yacht Club с ID=2');
    }
    
    // Получаем ID регулятора
    const ownerId = await getRegulatorId();
    
    // Получаем все изображения
    const images = scanMutantApeDirectory();
    
    if (images.length === 0) {
      console.error('Не найдены изображения для импорта!');
      return 0;
    }
    
    // Импортируем изображения пакетами
    const batchSize = 50;
    let importedCount = 0;
    
    for (let i = 0; i < images.length; i += batchSize) {
      const batch = images.slice(i, i + batchSize);
      console.log(`Обработка пакета ${Math.floor(i/batchSize) + 1}: ${batch.length} NFT...`);
      
      // Формируем запрос массовой вставки
      let insertQuery = `
        INSERT INTO nfts (
          token_id, name, description, image_path, price, 
          for_sale, owner_id, collection_id, rarity, attributes, 
          minted_at, sort_order
        ) VALUES 
      `;
      
      const values = [];
      let valueIndex = 1;
      
      for (let j = 0; j < batch.length; j++) {
        const image = batch[j];
        const tokenId = image.tokenId;
        const rarity = determineRarity(tokenId);
        const price = generateNFTPrice(tokenId, rarity);
        const attributes = JSON.stringify(generateNFTAttributes(tokenId, rarity));
        const name = `Mutant Ape #${tokenId}`;
        const description = `Mutant Ape Yacht Club NFT #${tokenId}. Редкость: ${rarity}. Мутированная обезьяна из престижного яхт-клуба.`;
        
        if (j > 0) {
          insertQuery += ', ';
        }
        
        insertQuery += `($${valueIndex++}, $${valueIndex++}, $${valueIndex++}, $${valueIndex++}, $${valueIndex++}, $${valueIndex++}, $${valueIndex++}, $${valueIndex++}, $${valueIndex++}, $${valueIndex++}, $${valueIndex++}, $${valueIndex++})`;
        
        values.push(
          tokenId.toString(),
          name,
          description,
          image.publicPath,
          price,
          true, // for_sale = true, доступно для покупки
          ownerId,
          2, // collection_id = 2 (Mutant Ape Yacht Club)
          rarity,
          attributes,
          new Date(),
          Math.floor(Math.random() * 10000) // случайный порядок сортировки
        );
      }
      
      try {
        await client.query(insertQuery, values);
        importedCount += batch.length;
        console.log(`Успешно импортировано ${batch.length} NFT (всего: ${importedCount})`);
      } catch (error) {
        console.error(`Ошибка при импорте пакета NFT:`, error);
      }
    }
    
    console.log(`\nИмпорт завершен. Всего добавлено ${importedCount} Mutant Ape NFT.`);
    return importedCount;
  } finally {
    client.release();
  }
}

/**
 * Главная функция скрипта
 */
async function main() {
  try {
    console.log('Запуск исправления коллекции Mutant Ape...');
    
    // Импортируем коллекцию
    const importedCount = await importMutantApeCollection();
    
    // Выводим статистику
    const client = await pool.connect();
    try {
      // Общая статистика NFT
      const countResult = await client.query(
        'SELECT collection_id, COUNT(*) as count FROM nfts GROUP BY collection_id ORDER BY collection_id'
      );
      
      console.log('\nСтатистика NFT по коллекциям:');
      countResult.rows.forEach(row => {
        console.log(`- Коллекция ID=${row.collection_id}: ${row.count} NFT`);
      });
      
      // Статистика по редкости для Mutant Ape
      const rarityQuery = `
        SELECT rarity, COUNT(*) as count 
        FROM nfts 
        WHERE collection_id = 2
        GROUP BY rarity 
        ORDER BY COUNT(*) DESC
      `;
      
      const rarityResult = await client.query(rarityQuery);
      
      console.log('\nРаспределение Mutant Ape NFT по редкости:');
      rarityResult.rows.forEach(row => {
        console.log(`- ${row.rarity}: ${row.count} NFT`);
      });
      
      // Проверяем правильность путей к изображениям
      const pathCheckQuery = `
        SELECT DISTINCT substring(image_path from '^/[^/]+') as base_path, COUNT(*) as count
        FROM nfts
        WHERE collection_id = 2
        GROUP BY base_path
      `;
      
      const pathCheckResult = await client.query(pathCheckQuery);
      
      console.log('\nПроверка путей к изображениям:');
      pathCheckResult.rows.forEach(row => {
        console.log(`- ${row.base_path}: ${row.count} NFT`);
        if (row.base_path !== '/mutant_ape_nft') {
          console.warn(`⚠️ ВНИМАНИЕ: Обнаружены неправильные пути: ${row.base_path}`);
        }
      });
      
    } finally {
      client.release();
    }
    
    console.log('\n✅ Исправление коллекции Mutant Ape успешно завершено!');
    
  } catch (error) {
    console.error('❌ Ошибка при выполнении скрипта:', error);
  } finally {
    // Закрываем соединение с базой данных
    await pool.end();
  }
}

// Запускаем скрипт
main();
/**
 * Скрипт для импорта обычной коллекции Mutant Ape Yacht Club из директории mutant_ape_nft
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
const MAX_NFTS = 1000; // Максимальное количество NFT для импорта

/**
 * Получает все изображения из директории mutant_ape_nft
 */
function scanMutantApeDirectory() {
  const images = [];
  
  try {
    if (!fs.existsSync(BASE_DIR)) {
      console.error(`Директория ${BASE_DIR} не существует!`);
      return images;
    }
    
    const files = fs.readdirSync(BASE_DIR)
      .filter(file => file.endsWith('.png') || file.endsWith('.jpg'));
    
    console.log(`Найдено ${files.length} изображений в директории ${BASE_DIR}`);
    
    for (const file of files) {
      const match = file.match(/mutant_ape_(\d+)\.png/);
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
    
    console.log(`Обработано ${images.length} изображений Mutant Ape`);
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
    'common': 30,
    'uncommon': 100,
    'rare': 500,
    'epic': 2000,
    'legendary': 10000
  };
  
  // Вносим некоторую случайность в цену
  const randomFactor = 0.8 + (0.4 * Math.random());
  
  // Особые цены для некоторых токенов
  if (tokenId === 1) return 12000; // Самый первый токен
  if (tokenId <= 10) return 5000 + Math.random() * 2000; // Первые 10
  
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
    power: Math.min(100, Math.max(1, baseValue + getVariation(0))),
    agility: Math.min(100, Math.max(1, baseValue + getVariation(1))),
    wisdom: Math.min(100, Math.max(1, baseValue - 5 + getVariation(2))), // Мутанты немного глупее
    luck: Math.min(100, Math.max(1, baseValue + 5 + getVariation(3)))   // Но им везёт чаще
  };
}

/**
 * Удаляет существующие NFT из коллекции Mutant Ape
 */
async function cleanRegularMutantApeNFTs() {
  console.log('Очистка существующих NFT обычной коллекции Mutant Ape...');
  
  const client = await pool.connect();
  try {
    // Находим ID коллекции Mutant Ape (обычная коллекция)
    const collectionResult = await client.query(
      'SELECT id FROM nft_collections WHERE id = 2'
    );
    
    if (collectionResult.rows.length === 0) {
      console.log('Коллекция с ID 2 (regular Mutant Ape) не найдена, создаём новую');
      
      // Создаем коллекцию
      const insertResult = await client.query(
        'INSERT INTO nft_collections (id, name, description, image_url) VALUES ($1, $2, $3, $4) RETURNING id',
        [
          2,
          COLLECTION_NAME,
          'Обычная коллекция Mutant Ape Yacht Club',
          '/mutant_ape_nft/mutant_ape_0001.png'
        ]
      );
      
      return insertResult.rows[0].id;
    }
    
    const collectionId = collectionResult.rows[0].id;
    console.log(`Найдена коллекция Regular Mutant Ape с ID ${collectionId}`);
    
    // Подсчитываем количество NFT в коллекции
    const countResult = await client.query(
      'SELECT COUNT(*) FROM nfts WHERE collection_id = $1',
      [collectionId]
    );
    
    const nftCount = parseInt(countResult.rows[0].count);
    console.log(`В коллекции найдено ${nftCount} NFT.`);
    
    if (nftCount > 0) {
      // Удаляем NFT из коллекции
      const deleteResult = await client.query(
        'DELETE FROM nfts WHERE collection_id = $1 RETURNING id',
        [collectionId]
      );
      
      console.log(`Удалено ${deleteResult.rowCount} NFT из коллекции Regular Mutant Ape.`);
    }
    
    return collectionId;
  } catch (error) {
    console.error('Ошибка при очистке коллекции:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Импортирует коллекцию Regular Mutant Ape из директории
 */
async function importRegularMutantApes(collectionId) {
  console.log('Начало импорта обычной коллекции Mutant Ape...');
  
  // Получаем все изображения из директории
  const images = scanMutantApeDirectory();
  
  if (images.length === 0) {
    console.error('Не найдены изображения для импорта!');
    return 0;
  }
  
  const client = await pool.connect();
  try {
    // Устанавливаем владельца - регулятора (администратора)
    const adminResult = await client.query(
      'SELECT id FROM users WHERE is_regulator = true LIMIT 1'
    );
    
    let ownerId = 1; // По умолчанию первый пользователь
    if (adminResult.rows.length > 0) {
      ownerId = adminResult.rows[0].id;
    }
    
    console.log(`Владелец NFT (администратор): ID=${ownerId}`);
    
    // Импортируем изображения как NFT
    let importedCount = 0;
    const batchSize = 50;
    
    for (let i = 0; i < images.length; i += batchSize) {
      const batch = images.slice(i, i + batchSize);
      console.log(`Обработка партии ${i/batchSize + 1}: ${batch.length} NFT...`);
      
      // Подготавливаем запрос для массовой вставки
      let insertQuery = 'INSERT INTO nfts (token_id, name, description, image_path, price, for_sale, owner_id, collection_id, rarity, attributes, minted_at, sort_order) VALUES ';
      const values = [];
      let valueIndex = 1;
      
      for (let j = 0; j < batch.length; j++) {
        const image = batch[j];
        const tokenId = image.tokenId;
        const rarity = determineRarity(tokenId);
        const price = generateNFTPrice(tokenId, rarity);
        const attributes = JSON.stringify(generateNFTAttributes(tokenId, rarity));
        const name = `Mutant Ape #${tokenId}`;
        const description = `Mutant Ape Yacht Club NFT #${tokenId}. Редкость: ${rarity}. Уникальный цифровой актив на блокчейне.`;
        const sortOrder = Math.floor(Math.random() * 10000); // Случайный порядок сортировки
        
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
          true, // для продажи
          ownerId,
          collectionId,
          rarity,
          attributes,
          new Date(),
          sortOrder
        );
      }
      
      try {
        await client.query(insertQuery, values);
        importedCount += batch.length;
        console.log(`Успешно импортировано ${batch.length} NFT, общее количество: ${importedCount}`);
      } catch (error) {
        console.error(`Ошибка при добавлении партии NFT:`, error);
      }
    }
    
    return importedCount;
  } catch (error) {
    console.error('Ошибка при импорте коллекции:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Главная функция скрипта
 */
async function main() {
  try {
    console.log('Запуск импорта обычной коллекции Mutant Ape Yacht Club...');
    
    // Шаг 1: Очищаем существующие Regular Mutant Ape NFT
    const collectionId = await cleanRegularMutantApeNFTs();
    
    // Шаг 2: Импортируем коллекцию из директории
    const importedCount = await importRegularMutantApes(collectionId);
    
    // Шаг 3: Проверка статистики
    const client = await pool.connect();
    try {
      const countResult = await client.query(
        'SELECT COUNT(*) FROM nfts WHERE collection_id = $1',
        [collectionId]
      );
      
      const nftCount = parseInt(countResult.rows[0].count);
      console.log(`\nИтоговая статистика:`);
      console.log(`- Коллекция Regular Mutant Ape ID: ${collectionId}`);
      console.log(`- Импортировано NFT: ${importedCount}`);
      console.log(`- Всего NFT в коллекции: ${nftCount}`);
      
      // Статистика по редкости
      const rarityQuery = `
        SELECT rarity, COUNT(*) as count 
        FROM nfts 
        WHERE collection_id = $1 
        GROUP BY rarity 
        ORDER BY COUNT(*) DESC
      `;
      
      const rarityResult = await client.query(rarityQuery, [collectionId]);
      
      console.log('\nРаспределение по редкости:');
      rarityResult.rows.forEach(row => {
        console.log(`- ${row.rarity}: ${row.count} NFT`);
      });
      
      // Считаем общее количество NFT в базе
      const totalQuery = 'SELECT COUNT(*) FROM nfts';
      const totalResult = await client.query(totalQuery);
      console.log(`\nВсего NFT в базе данных: ${totalResult.rows[0].count}`);
      
    } finally {
      client.release();
    }
    
    console.log('\n✅ Импорт обычной коллекции Mutant Ape Yacht Club успешно завершен!');
    
  } catch (error) {
    console.error('Ошибка при выполнении скрипта:', error);
  } finally {
    // Закрываем соединение с базой данных
    await pool.end();
  }
}

// Запускаем скрипт
main();
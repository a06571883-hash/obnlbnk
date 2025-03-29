/**
 * Скрипт для скачивания официальных NFT из коллекции Bored Ape Yacht Club
 * и добавления их в маркетплейс
 */
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import pkg from 'pg';
const { Pool } = pkg;
import { fileURLToPath } from 'url';

// Получаем текущую директорию
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Создаем директорию для хранения изображений
const DOWNLOAD_DIR = path.join(__dirname, 'bayc_official_nft');
if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

// API URL для получения метаданных и изображений Bored Ape Yacht Club
const IPFS_GATEWAY = 'https://ipfs.io/ipfs/';
const BAYC_METADATA_CID = 'QmeSjSinHpPnmXmspMjwiXyN6zS4E9zccariGR3jxcaWtq';
const BAYC_IMAGES_CID = 'QmYDvPAXtiJg7s8JdRBSLWdgSphQdac8j1YuQNNxcGE1hg';

/**
 * Загружает метаданные NFT по его идентификатору
 * @param {number} tokenId Идентификатор NFT
 * @returns {Promise<Object>} Метаданные NFT
 */
async function fetchNFTMetadata(tokenId) {
  try {
    const url = `${IPFS_GATEWAY}${BAYC_METADATA_CID}/${tokenId}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Ошибка при загрузке метаданных для NFT #${tokenId}:`, error);
    return null;
  }
}

/**
 * Загружает изображение NFT и сохраняет его локально
 * @param {string} imageUri URI изображения (IPFS)
 * @param {number} tokenId Идентификатор NFT
 * @returns {Promise<string>} Путь к сохраненному изображению
 */
async function downloadNFTImage(imageUri, tokenId) {
  try {
    // Извлекаем CID и путь из ipfs:// URI
    const ipfsPath = imageUri.replace('ipfs://', '');
    
    // Если путь начинается с CID изображений, используем его напрямую
    // иначе используем шлюз IPFS
    const imageUrl = ipfsPath.startsWith(BAYC_IMAGES_CID)
      ? `${IPFS_GATEWAY}${ipfsPath}`
      : `${IPFS_GATEWAY}${BAYC_IMAGES_CID}/${tokenId}.png`;
    
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const buffer = await response.buffer();
    const savePath = path.join(DOWNLOAD_DIR, `official_bored_ape_${tokenId}.png`);
    fs.writeFileSync(savePath, buffer);
    
    // Возвращаем относительный путь к изображению для сохранения в базе данных
    return `/bayc_official_nft/official_bored_ape_${tokenId}.png`;
  } catch (error) {
    console.error(`Ошибка при загрузке изображения для NFT #${tokenId}:`, error);
    return null;
  }
}

/**
 * Генерирует цену для NFT на основе его атрибутов и идентификатора
 * @param {number} tokenId Идентификатор NFT
 * @param {Array} attributes Атрибуты NFT
 * @returns {number} Цена NFT в долларах
 */
function generateNFTPrice(tokenId, attributes) {
  // Базовая цена для всех NFT
  let basePrice = 20;
  
  // Редкие идентификаторы имеют более высокую базовую стоимость
  if (tokenId < 10) basePrice += 5000;
  else if (tokenId < 100) basePrice += 1000;
  else if (tokenId < 1000) basePrice += 100;
  
  // Увеличиваем цену в зависимости от количества редких атрибутов
  if (attributes && attributes.length) {
    // Редкие типы шляп, очков и фонов увеличивают стоимость
    const rareTraits = attributes.filter(attr => {
      const value = attr.value ? attr.value.toString().toLowerCase() : '';
      return (
        (attr.trait_type === 'Hat' && ['crown', 'halo', 'laurel wreath', 'kings crown'].includes(value)) ||
        (attr.trait_type === 'Eyes' && ['3d', 'laser eyes', 'hypnotized'].includes(value)) ||
        (attr.trait_type === 'Background' && ['yellow', 'aquamarine', 'purple'].includes(value))
      );
    });
    
    basePrice += rareTraits.length * 5000;
  }
  
  // Особые NFT с очень высокой ценой (до $300,000)
  if (tokenId % 1000 === 0) basePrice += 290000;
  else if (tokenId % 500 === 0) basePrice += 150000;
  else if (tokenId % 100 === 0) basePrice += 50000;
  
  // Добавляем небольшой случайный фактор для разнообразия
  const randomFactor = Math.floor(Math.random() * 1000);
  
  return basePrice + randomFactor;
}

/**
 * Добавляет NFT в маркетплейс
 */
async function importBoredApesToMarketplace() {
  let client;
  try {
    console.log('Начинаем импорт официальных NFT Bored Ape Yacht Club в маркетплейс...');
    
    // Создаем пул подключений к БД
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });
    
    // Используем подключение из пула
    client = await pool.connect();
    
    // Начинаем транзакцию
    await client.query('BEGIN');
    
    // Очищаем существующие NFT
    console.log('Удаляем существующие NFT...');
    await client.query('DELETE FROM nft_transfers');
    await client.query('DELETE FROM nfts');
    await client.query('DELETE FROM nft');
    await client.query('ALTER SEQUENCE nfts_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE nft_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE nft_transfers_id_seq RESTART WITH 1');
    
    // Специальный регулятор (админ) для получения комиссии
    const regulator = {
      id: 5,
      username: 'admin'
    };
    
    // Проверяем, существует ли коллекция для регулятора
    const collectionResult = await client.query(`
      SELECT id FROM nft_collections WHERE user_id = $1 LIMIT 1
    `, [regulator.id]);
    
    let collectionId;
    if (collectionResult.rows.length > 0) {
      collectionId = collectionResult.rows[0].id;
    } else {
      // Создаем коллекцию для регулятора
      const newCollectionResult = await client.query(`
        INSERT INTO nft_collections (user_id, name, description, created_at)
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `, [
        regulator.id, 
        'Bored Ape Yacht Club Official', 
        'The official collection of 10,000 Bored Ape NFTs—unique digital collectibles living on the Ethereum blockchain.',
        new Date()
      ]);
      collectionId = newCollectionResult.rows[0].id;
    }
    
    // Определяем количество NFT, которые мы хотим импортировать
    // В полной коллекции 10000 NFT, но для экономии времени можно загрузить меньше
    const START_TOKEN_ID = 0;
    const NUM_TOKENS = 1000; // Загружаем первую 1000 NFT
    
    let created = 0;
    let skipped = 0;
    let errors = 0;
    
    console.log(`Загружаем ${NUM_TOKENS} NFT из коллекции Bored Ape Yacht Club...`);
    
    // Процесс импорта
    for (let i = START_TOKEN_ID; i < START_TOKEN_ID + NUM_TOKENS; i++) {
      try {
        // Проверяем, есть ли уже NFT с таким токеном в базе
        const tokenId = `BAYC-${i}`;
        const checkResult = await client.query(`
          SELECT id FROM nfts WHERE token_id = $1
        `, [tokenId]);
        
        if (checkResult.rows.length > 0) {
          console.log(`NFT с token_id ${tokenId} уже существует, пропускаем`);
          skipped++;
          continue;
        }
        
        // Загружаем метаданные NFT
        const metadata = await fetchNFTMetadata(i);
        if (!metadata) {
          console.error(`Не удалось загрузить метаданные для NFT #${i}, пропускаем`);
          errors++;
          continue;
        }
        
        // Загружаем изображение NFT
        const imagePath = await downloadNFTImage(metadata.image, i);
        if (!imagePath) {
          console.error(`Не удалось загрузить изображение для NFT #${i}, пропускаем`);
          errors++;
          continue;
        }
        
        // Генерируем цену для NFT
        const price = generateNFTPrice(i, metadata.attributes);
        
        // Преобразуем атрибуты в нужный формат
        const attributes = {};
        if (metadata.attributes) {
          metadata.attributes.forEach(attr => {
            attributes[attr.trait_type.toLowerCase()] = attr.value;
          });
        }
        
        // Определяем редкость на основе цены
        let rarity = 'common';
        if (price > 100000) rarity = 'legendary';
        else if (price > 50000) rarity = 'epic';
        else if (price > 10000) rarity = 'rare';
        else if (price > 1000) rarity = 'uncommon';
        
        // Вставляем NFT в базу
        const result = await client.query(`
          INSERT INTO nfts (
            collection_id, name, description, image_path, attributes, 
            rarity, price, for_sale, owner_id, minted_at, token_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          RETURNING id
        `, [
          collectionId,
          metadata.name || `Bored Ape #${i}`,
          metadata.description || `Official Bored Ape Yacht Club NFT #${i}. This digital collectible is part of the iconic BAYC series.`,
          imagePath,
          attributes,
          rarity,
          price.toString(),
          true, // Выставляем сразу на продажу
          regulator.id, // Владелец - регулятор
          new Date(),
          tokenId
        ]);
        
        if (result.rows.length > 0) {
          console.log(`Создано NFT с ID ${result.rows[0].id}, token_id ${tokenId}, цена $${price}`);
          created++;
          
          // Выводим прогресс каждые 10 NFT
          if (created % 10 === 0) {
            console.log(`Прогресс: ${Math.min(i + 1, START_TOKEN_ID + NUM_TOKENS)}/${START_TOKEN_ID + NUM_TOKENS} (${Math.round(((i + 1 - START_TOKEN_ID) / NUM_TOKENS) * 100)}%)`);
          }
        } else {
          console.error(`Не удалось создать NFT #${i}`);
          errors++;
        }
      } catch (error) {
        console.error(`Ошибка при обработке NFT #${i}:`, error);
        errors++;
      }
    }
    
    // Если всё успешно, фиксируем транзакцию
    await client.query('COMMIT');
    
    console.log(`\nИмпорт завершен. Создано: ${created}, пропущено: ${skipped}, ошибок: ${errors}`);
    return { success: true, created, skipped, errors };
  } catch (error) {
    // Если произошла ошибка, откатываем транзакцию
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error('Ошибка при импорте NFT:', error);
    return { success: false, created: 0, skipped: 0, errors: 1, error };
  } finally {
    // Освобождаем клиента
    if (client) {
      client.release();
    }
  }
}

// Запускаем импорт
importBoredApesToMarketplace().catch(console.error);
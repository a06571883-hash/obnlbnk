/**
 * Улучшенный скрипт для импорта NFT Bored Ape с гарантированным отсутствием дубликатов
 * Импортирует NFT только в таблицу nfts, игнорируя устаревшую таблицу nft
 */
import fs from 'fs';
import path from 'path';
import pkg from 'pg';
const { Pool } = pkg;
import { fileURLToPath } from 'url';

// Получаем текущую директорию
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Функция для подсчета изображений в директории
async function countBoredApeImages() {
  try {
    const nftDir = path.join(__dirname, 'bored_ape_nft');
    
    if (!fs.existsSync(nftDir)) {
      console.error(`Директория ${nftDir} не существует!`);
      return { total: 0, png: 0, avif: 0 };
    }
    
    const files = fs.readdirSync(nftDir);
    const pngFiles = files.filter(file => file.toLowerCase().endsWith('.png'));
    const avifFiles = files.filter(file => file.toLowerCase().endsWith('.avif'));
    
    return {
      total: pngFiles.length + avifFiles.length,
      png: pngFiles.length,
      avif: avifFiles.length
    };
  } catch (error) {
    console.error('Ошибка при подсчете изображений:', error);
    return { total: 0, png: 0, avif: 0 };
  }
}

/**
 * Генерирует цену для NFT на основе его ID
 * @param {number} id - ID NFT
 * @returns {number} - Цена NFT в долларах
 */
function generateNFTPrice(id) {
  // Генерируем цену от $20 до $300,000
  // Некоторые NFT будут иметь высокую цену, но большинство относительно недорогие
  const basePrice = 20;
  
  // Используем функцию распределения, где большинство NFT имеют низкую цену
  if (id % 100 === 0) {
    // Топовое NFT (1%)
    return basePrice + Math.floor(Math.random() * 290000) + 10000;
  } else if (id % 20 === 0) {
    // Редкое NFT (5%)
    return basePrice + Math.floor(Math.random() * 9000) + 1000;
  } else if (id % 5 === 0) {
    // Необычное NFT (20%)
    return basePrice + Math.floor(Math.random() * 900) + 100;
  } else {
    // Обычное NFT (74%)
    return basePrice + Math.floor(Math.random() * 80);
  }
}

/**
 * Генерирует описание для NFT
 * @param {number} id - ID NFT
 * @param {number} price - Цена NFT
 * @returns {string} - Описание NFT
 */
function generateNFTDescription(id, price) {
  const rarityLevels = [
    { min: 10000, level: 'Legendary', desc: 'An ultra-rare, legendary Bored Ape NFT with unique characteristics that make it one of the most coveted pieces in the entire collection.' },
    { min: 1000, level: 'Epic', desc: 'This epic Bored Ape NFT features rare traits that only appear in a small percentage of the entire collection.' },
    { min: 100, level: 'Rare', desc: 'A rare Bored Ape NFT with uncommon traits that stand out from the standard collection.' },
    { min: 0, level: 'Common', desc: 'A stylish Bored Ape NFT from the iconic collection, featuring the signature disinterested expression.' }
  ];
  
  const rarity = rarityLevels.find(r => price >= r.min);
  
  return `${rarity.level} Bored Ape #${id} - ${rarity.desc} This digital collectible is part of the iconic Bored Ape Yacht Club series, representing exclusive membership in the club. Each Ape has its own unique combination of traits, making it a one-of-a-kind digital asset.`;
}

/**
 * Импортирует пакет NFT из коллекции Bored Ape в маркетплейс
 * @param {Array<string>} filesToProcess - Массив файлов для обработки в текущем пакете
 * @param {Object} regulator - Информация о регуляторе (админе)
 * @param {Object} client - Клиент подключения к БД
 * @returns {Promise<{success: boolean, created: number, skipped: number, errors: number, error?: Error}>}
 */
async function importBoredApesBatch(filesToProcess, regulator, client) {
  try {
    let created = 0;
    let skipped = 0;
    let errors = 0;
    
    // Начинаем транзакцию
    await client.query('BEGIN');
    
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
        'Bored Ape Yacht Club', 
        'Official collection of Bored Ape Yacht Club NFTs',
        new Date()
      ]);
      collectionId = newCollectionResult.rows[0].id;
    }
    
    // Создаем Set для отслеживания уже обработанных идентификаторов
    const processedIds = new Set();
    
    // Процесс импорта
    for (const file of filesToProcess) {
      try {
        // Извлекаем ID из имени файла вида bored_ape_123.png
        const match = file.match(/bored_ape_(\d+)/i);
        const id = match ? parseInt(match[1]) : 0;
        
        if (!id) {
          console.warn(`Пропускаем файл ${file}: невозможно извлечь ID`);
          skipped++;
          continue;
        }
        
        // Проверяем, не обрабатывали ли мы уже этот ID в текущем пакете
        if (processedIds.has(id)) {
          console.log(`NFT с ID ${id} уже обработан в текущем пакете, пропускаем`);
          skipped++;
          continue;
        }
        
        // Добавляем ID в множество обработанных
        processedIds.add(id);
        
        // Проверяем, нет ли уже этого NFT в базе
        const tokenId = `BAYC-${id}`;
        const checkResult = await client.query(`
          SELECT id FROM nfts WHERE token_id = $1
        `, [tokenId]);
        
        if (checkResult.rows.length > 0) {
          console.log(`NFT с token_id ${tokenId} уже существует, пропускаем`);
          skipped++;
          continue;
        }
        
        // Определяем тип файла и относительный путь
        const fileExt = path.extname(file).toLowerCase();
        const nftPath = `/bored_ape_nft/${file}`;
        
        // Генерируем цену для NFT
        const price = generateNFTPrice(id);
        const description = generateNFTDescription(id, price);
        
        // Генерируем атрибуты для NFT
        const attributes = {
          power: Math.floor(Math.random() * 100) + 1,
          agility: Math.floor(Math.random() * 100) + 1,
          wisdom: Math.floor(Math.random() * 100) + 1,
          luck: Math.floor(Math.random() * 100) + 1
        };
        
        // Определяем редкость на основе цены
        let rarity = 'common';
        if (price > 10000) rarity = 'legendary';
        else if (price > 1000) rarity = 'epic';
        else if (price > 100) rarity = 'rare';
        else if (price > 50) rarity = 'uncommon';
        
        // Вставляем NFT в базу только в таблицу nfts
        const result = await client.query(`
          INSERT INTO nfts (
            collection_id, name, description, image_path, attributes, 
            rarity, price, for_sale, owner_id, minted_at, token_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          RETURNING id
        `, [
          collectionId,
          `Bored Ape #${id}`,
          description,
          nftPath,
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
        } else {
          console.error(`Не удалось создать NFT для файла ${file}`);
          errors++;
        }
      } catch (error) {
        console.error(`Ошибка при обработке файла ${file}:`, error);
        errors++;
      }
    }
    
    // Если всё успешно, фиксируем транзакцию
    await client.query('COMMIT');
    
    return {
      success: true,
      created,
      skipped,
      errors
    };
  } catch (error) {
    // Если произошла ошибка, откатываем транзакцию
    await client.query('ROLLBACK');
    console.error('Ошибка при импорте NFT:', error);
    return {
      success: false,
      created: 0,
      skipped: 0,
      errors: 1,
      error
    };
  }
}

// Запускаем поэтапный импорт
async function runImprovedImport() {
  let client;
  try {
    console.log('Начинаем улучшенный импорт NFT в маркетплейс...');
    
    // Проверяем наличие изображений
    const imageInfo = await countBoredApeImages();
    console.log(`Найдено изображений: ${imageInfo.total} (PNG: ${imageInfo.png}, AVIF: ${imageInfo.avif})`);
    
    if (imageInfo.total === 0) {
      console.error('Ошибка: Нет изображений для импорта!');
      return;
    }
    
    // Специальный регулятор (админ) для получения комиссии
    const regulator = {
      id: 5,
      username: 'admin'
    };
    
    // Создаем пул подключений к БД
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });
    
    // Используем подключение из пула
    client = await pool.connect();
    
    // Получаем список всех файлов
    const nftDir = path.join(__dirname, 'bored_ape_nft');
    const files = fs.readdirSync(nftDir);
    
    // Фильтруем только файлы изображений и сортируем их
    const imageFiles = files
      .filter(file => file.toLowerCase().endsWith('.png') || file.toLowerCase().endsWith('.avif'))
      .sort((a, b) => {
        const numA = parseInt(a.match(/bored_ape_(\d+)/i)?.[1] || '0');
        const numB = parseInt(b.match(/bored_ape_(\d+)/i)?.[1] || '0');
        return numA - numB;
      });
    
    console.log(`Всего ${imageFiles.length} файлов для обработки`);
    
    // Проверяем уже существующие NFT
    const existingNFTResult = await client.query(`
      SELECT COUNT(*) as count 
      FROM nfts
    `);
    
    const existingCount = parseInt(existingNFTResult.rows[0].count);
    console.log(`В базе уже есть ${existingCount} NFT из коллекции Bored Ape`);
    
    // Определяем размер пакета (для миграции, чтобы не получить timeout)
    const BATCH_SIZE = 50;
    let totalCreated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    
    // Обрабатываем файлы пакетами
    for (let i = 0; i < imageFiles.length; i += BATCH_SIZE) {
      const batchFiles = imageFiles.slice(i, i + BATCH_SIZE);
      
      console.log(`\n--- Обработка пакета ${i/BATCH_SIZE + 1} из ${Math.ceil(imageFiles.length/BATCH_SIZE)} ---`);
      console.log(`Обрабатываем ${batchFiles.length} файлов...`);
      
      const batchResult = await importBoredApesBatch(batchFiles, regulator, client);
      
      if (batchResult.success) {
        totalCreated += batchResult.created;
        totalSkipped += batchResult.skipped;
        totalErrors += batchResult.errors;
        
        console.log(`Пакет обработан: создано ${batchResult.created}, пропущено ${batchResult.skipped}, ошибок ${batchResult.errors}`);
        console.log(`Прогресс: ${Math.min(i + BATCH_SIZE, imageFiles.length)}/${imageFiles.length} (${Math.round((Math.min(i + BATCH_SIZE, imageFiles.length) / imageFiles.length) * 100)}%)`);
      } else {
        console.error(`Ошибка при обработке пакета: ${batchResult.error}`);
        totalErrors++;
      }
    }
    
    console.log(`\nИмпорт завершен. Всего создано: ${totalCreated}, пропущено: ${totalSkipped}, ошибок: ${totalErrors}`);
  } catch (error) {
    console.error('Непредвиденная ошибка:', error);
  } finally {
    // Освобождаем клиента
    if (client) {
      client.release();
    }
  }
}

// Запускаем импорт
runImprovedImport().catch(console.error);
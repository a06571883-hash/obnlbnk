/**
 * Скрипт для прямого импорта всех NFT из коллекции Bored Ape в маркетплейс
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
 * Импортирует все NFT из коллекции Bored Ape в маркетплейс
 * @returns {Promise<{success: boolean, created: number, skipped: number, errors: number, error?: Error}>}
 */
async function importBoredApesToMarketplace() {
  let client;
  try {
    const imageInfo = await countBoredApeImages();
    console.log(`Найдено изображений: ${imageInfo.total} (PNG: ${imageInfo.png}, AVIF: ${imageInfo.avif})`);
    
    if (imageInfo.total === 0) {
      return { success: false, created: 0, skipped: 0, errors: 0, error: new Error('Нет изображений для импорта') };
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
    
    // Проверяем, есть ли уже NFT в базе
    const existingNFTResult = await client.query(`
      SELECT COUNT(*) as count 
      FROM nfts
    `);
    
    const existingCount = parseInt(existingNFTResult.rows[0].count);
    console.log(`В базе уже есть ${existingCount} NFT из коллекции Bored Ape`);
    
    // Начинаем транзакцию
    await client.query('BEGIN');
    
    const nftDir = path.join(__dirname, 'bored_ape_nft');
    const files = fs.readdirSync(nftDir);
    
    let created = 0;
    let skipped = 0;
    let errors = 0;
    
    // Сортируем файлы, чтобы они обрабатывались последовательно
    const sortedFiles = files.sort((a, b) => {
      const numA = parseInt(a.match(/\\d+/)?.[0] || 0);
      const numB = parseInt(b.match(/\\d+/)?.[0] || 0);
      return numA - numB;
    });
    
    // Процесс импорта
    for (const file of sortedFiles) {
      if (!file.toLowerCase().endsWith('.png') && !file.toLowerCase().endsWith('.avif')) {
        continue;
      }
      
      // Извлекаем ID из имени файла вида bored_ape_123.png
      const match = file.match(/bored_ape_(\d+)/i);
      const id = match ? parseInt(match[1]) : 0;
      
      if (!id) {
        console.warn(`Пропускаем файл ${file}: невозможно извлечь ID`);
        skipped++;
        continue;
      }
      
      try {
        // Проверяем, нет ли уже этого NFT в базе
        const checkResult = await client.query(`
          SELECT id FROM nfts WHERE token_id = $1
        `, [id.toString()]);
        
        if (checkResult.rows.length > 0) {
          console.log(`NFT с token_id ${id} уже существует, пропускаем`);
          skipped++;
          continue;
        }
        
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
        
        // Вставляем NFT в базу с использованием правильной структуры таблицы
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
          `BAYC-${id}`
        ]);
        
        if (result.rows.length > 0) {
          console.log(`Создано NFT с ID ${result.rows[0].id}, token_id ${id}, цена $${price}`);
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
    console.log(`Импорт завершен. Создано: ${created}, пропущено: ${skipped}, ошибок: ${errors}`);
    
    return {
      success: true,
      created,
      skipped,
      errors
    };
  } catch (error) {
    // Если произошла ошибка, откатываем транзакцию
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error('Ошибка при импорте NFT:', error);
    return {
      success: false,
      created: 0,
      skipped: 0,
      errors: 1,
      error
    };
  } finally {
    // Освобождаем клиента
    if (client) {
      client.release();
    }
  }
}

// Запускаем импорт
async function runImport() {
    try {
        console.log('Начинаем импорт всех NFT в маркетплейс...');
        
        // Проверяем наличие изображений
        const imageInfo = await countBoredApeImages();
        console.log(`Найдено изображений: ${imageInfo.total} (PNG: ${imageInfo.png}, AVIF: ${imageInfo.avif})`);
        
        if (imageInfo.total === 0) {
            console.error('Ошибка: Нет изображений для импорта!');
            return;
        }
        
        // Запускаем импорт
        console.log('Запускаем процесс импорта...');
        const result = await importBoredApesToMarketplace();
        
        if (result.success) {
            console.log('Импорт успешно завершен!');
            console.log(`Создано: ${result.created}, пропущено: ${result.skipped}, ошибок: ${result.errors}`);
        } else {
            console.error('Ошибка при импорте:', result.error);
        }
    } catch (error) {
        console.error('Непредвиденная ошибка:', error);
    }
}

runImport().catch(console.error);
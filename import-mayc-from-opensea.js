/**
 * Скрипт для импорта коллекции Mutant Ape Yacht Club (MAYC) с OpenSea
 */

const { Client } = require('pg');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const https = require('https');
const { v4: uuidv4 } = require('uuid');

dotenv.config();

// Конфигурация
const CONFIG = {
  apiEndpoint: 'https://api.opensea.io/api/v1/assets',
  collection: 'mutant-ape-yacht-club',
  limit: 20, // Количество NFT за один запрос
  totalToImport: 100, // Общее количество NFT для импорта
  nftImageDirectory: path.join(__dirname, 'mutant_ape_official'), // Директория для сохранения изображений
  targetCollection: {
    id: 2, // ID коллекции Mutant Ape в нашей базе данных
    name: 'Mutant Ape Yacht Club',
    description: 'The Mutant Ape Yacht Club is a collection of up to 20,000 Mutant Apes that can only be created by exposing a Bored Ape to a vial of MUTANT SERUM or by minting a Mutant Ape in the public sale.'
  },
  owner: {
    id: 1 // ID владельца NFT (админ)
  }
};

// Создаем HTTP клиент с большим таймаутом
const httpsAgent = new https.Agent({ 
  keepAlive: true, 
  timeout: 60000 
});

/**
 * Создает директорию для хранения изображений NFT
 */
function createImageDirectory() {
  if (!fs.existsSync(CONFIG.nftImageDirectory)) {
    fs.mkdirSync(CONFIG.nftImageDirectory, { recursive: true });
    console.log(`Создана директория для изображений: ${CONFIG.nftImageDirectory}`);
  }
}

/**
 * Загружает изображение NFT и сохраняет его локально
 * @param {string} imageUrl URL изображения
 * @param {string} tokenId ID токена
 * @returns {Promise<string>} Путь к сохраненному изображению
 */
async function downloadNFTImage(imageUrl, tokenId) {
  try {
    // Генерируем имя файла на основе tokenId
    const fileExtension = imageUrl.split('.').pop().split('?')[0];
    const fileName = `mutant_ape_${tokenId}.${fileExtension || 'png'}`;
    const filePath = path.join(CONFIG.nftImageDirectory, fileName);
    
    // Если файл уже существует, просто возвращаем путь
    if (fs.existsSync(filePath)) {
      return `/mutant_ape_official/${fileName}`;
    }
    
    // Загружаем изображение
    const response = await axios({
      method: 'get',
      url: imageUrl,
      responseType: 'stream',
      httpsAgent,
      timeout: 30000
    });
    
    // Сохраняем в файл
    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);
    
    return new Promise((resolve, reject) => {
      writer.on('finish', () => resolve(`/mutant_ape_official/${fileName}`));
      writer.on('error', reject);
    });
  } catch (error) {
    console.error(`Ошибка загрузки изображения для tokenId ${tokenId}:`, error.message);
    return null;
  }
}

/**
 * Преобразует свойства NFT из формата OpenSea в наш формат
 * @param {Object} traits Свойства NFT из OpenSea
 * @returns {Object} Свойства NFT в нашем формате
 */
function convertTraits(traits) {
  // Базовые атрибуты для NFT, если не найдены свойства
  const defaultAttributes = {
    power: Math.floor(Math.random() * 80) + 20,
    agility: Math.floor(Math.random() * 80) + 20,
    wisdom: Math.floor(Math.random() * 80) + 20,
    luck: Math.floor(Math.random() * 80) + 20
  };
  
  if (!traits || !Array.isArray(traits) || traits.length === 0) {
    return defaultAttributes;
  }
  
  // Создаем объект с атрибутами из оригинальных свойств
  const attributes = {
    ...defaultAttributes
  };
  
  // Добавляем оригинальные свойства
  traits.forEach(trait => {
    const traitName = trait.trait_type.toLowerCase();
    const traitValue = trait.value;
    attributes[traitName] = traitValue;
  });
  
  return attributes;
}

/**
 * Определяет редкость NFT на основе его свойств
 * @param {Object} traits Свойства NFT из OpenSea
 * @returns {string} Редкость NFT (common, uncommon, rare, epic, legendary)
 */
function determineRarity(traits) {
  if (!traits || !Array.isArray(traits) || traits.length === 0) {
    return 'common';
  }
  
  // Ищем редкие свойства
  const rarityMap = {
    'Trippy Fur': 'legendary',
    'Mega Mutant': 'legendary',
    'M3': 'legendary',
    'M2': 'epic',
    'M1': 'rare',
    'Gold Fur': 'epic',
    'DMT': 'epic',
    'Mega Noise': 'rare',
    'Robot': 'rare'
  };
  
  // Проверяем есть ли редкие свойства
  for (const trait of traits) {
    const traitValue = String(trait.value);
    for (const [key, rarity] of Object.entries(rarityMap)) {
      if (traitValue.includes(key)) {
        return rarity;
      }
    }
  }
  
  // Определяем редкость по количеству свойств
  if (traits.length >= 7) return 'rare';
  if (traits.length >= 5) return 'uncommon';
  return 'common';
}

/**
 * Генерирует цену для NFT на основе его редкости
 * @param {string} rarity Редкость NFT
 * @returns {number} Цена NFT в долларах
 */
function generatePrice(rarity) {
  const priceMap = {
    'common': () => Math.floor(Math.random() * 50) + 30,
    'uncommon': () => Math.floor(Math.random() * 200) + 80,
    'rare': () => Math.floor(Math.random() * 500) + 300,
    'epic': () => Math.floor(Math.random() * 3000) + 1000,
    'legendary': () => Math.floor(Math.random() * 10000) + 10000
  };
  
  return priceMap[rarity] ? priceMap[rarity]() : 30;
}

/**
 * Получает NFT с OpenSea и сохраняет их в нашу базу данных
 */
async function importNFTFromOpenSea() {
  createImageDirectory();
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
  
  try {
    await client.connect();
    console.log('Подключение к базе данных установлено');
    
    // Получение NFT с OpenSea
    let totalImported = 0;
    let offset = 0;
    
    while (totalImported < CONFIG.totalToImport) {
      try {
        console.log(`Получение NFT с OpenSea (${offset}-${offset+CONFIG.limit})...`);
        
        // Запрос к API OpenSea
        const response = await axios({
          method: 'get',
          url: CONFIG.apiEndpoint,
          httpsAgent,
          params: {
            collection: CONFIG.collection,
            limit: CONFIG.limit,
            offset: offset
          },
          headers: {
            'Accept': 'application/json'
          },
          timeout: 30000
        });
        
        const assets = response.data.assets;
        
        if (!assets || assets.length === 0) {
          console.log('Больше NFT не найдено');
          break;
        }
        
        console.log(`Получено ${assets.length} NFT с OpenSea`);
        
        // Импортируем каждый NFT
        for (const asset of assets) {
          const tokenId = asset.token_id;
          const name = asset.name || `Mutant Ape #${tokenId}`;
          
          // Скачиваем изображение
          const imagePath = await downloadNFTImage(asset.image_url, tokenId);
          
          if (!imagePath) {
            console.log(`Пропускаем NFT #${tokenId}: не удалось загрузить изображение`);
            continue;
          }
          
          // Определяем редкость и цену
          const rarity = determineRarity(asset.traits);
          const price = generatePrice(rarity);
          
          // Преобразуем свойства
          const attributes = convertTraits(asset.traits);
          
          // Добавляем NFT в базу данных
          const insertQuery = `
            INSERT INTO nft (
              collection_id,
              owner_id,
              name,
              description,
              image_path,
              rarity,
              token_id,
              attributes,
              price,
              for_sale,
              minted_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING id
          `;
          
          const values = [
            CONFIG.targetCollection.id,
            CONFIG.owner.id,
            name,
            asset.description || `Mutant Ape Yacht Club NFT #${tokenId}. Редкость: ${rarity}. Уникальный цифровой актив на блокчейне.`,
            imagePath,
            rarity,
            tokenId,
            JSON.stringify(attributes),
            price.toString(),
            true, // Выставляем на продажу
            new Date()
          ];
          
          const result = await client.query(insertQuery, values);
          
          console.log(`✅ Добавлен Mutant Ape #${tokenId} (ID: ${result.rows[0].id}, цена: $${price})`);
          
          totalImported++;
          
          if (totalImported >= CONFIG.totalToImport) {
            break;
          }
        }
        
        offset += CONFIG.limit;
        
        // Задержка между запросами, чтобы избежать ограничений API
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error('Ошибка при получении данных с OpenSea:', error.message);
        // Увеличиваем задержку при ошибке
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    
    console.log(`✅ Импорт завершен. Добавлено ${totalImported} NFT Mutant Ape Yacht Club`);
    
    return { success: true, imported: totalImported };
  } catch (error) {
    console.error('Ошибка при импорте NFT:', error);
    return { success: false, error: error.message };
  } finally {
    await client.end();
    console.log('Соединение с базой данных закрыто');
  }
}

// Запускаем скрипт импорта
importNFTFromOpenSea()
  .then(result => {
    if (result.success) {
      console.log(`✨ Успешно импортировано ${result.imported} NFT MAYC с OpenSea`);
    } else {
      console.error('❌ Ошибка импорта:', result.error);
    }
  })
  .catch(err => {
    console.error('❌ Критическая ошибка:', err);
  });
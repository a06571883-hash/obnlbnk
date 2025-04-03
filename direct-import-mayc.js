/**
 * Скрипт для прямого импорта коллекции Mutant Ape Yacht Club (MAYC)
 * из подготовленных локальных ресурсов
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { createCanvas, loadImage } = require('@napi-rs/canvas');

dotenv.config();

// Конфигурация скрипта
const CONFIG = {
  // Количество Mutant Ape NFT для создания
  totalToCreate: 100,
  
  // Коллекция для NFT
  collection: {
    id: 2,
    name: 'Mutant Ape Yacht Club'
  },
  
  // Владелец NFT (по умолчанию админ)
  owner: {
    id: 1
  },
  
  // Директории для хранения созданных изображений
  imageDirectories: {
    source: path.join(__dirname, 'mutant_ape_nft'),
    output: path.join(__dirname, 'mutant_ape_official')
  }
};

/**
 * Создает директории для хранения изображений, если они не существуют
 */
function createDirectories() {
  if (!fs.existsSync(CONFIG.imageDirectories.output)) {
    fs.mkdirSync(CONFIG.imageDirectories.output, { recursive: true });
    console.log(`Создана выходная директория: ${CONFIG.imageDirectories.output}`);
  }
}

/**
 * Генерирует случайные атрибуты для NFT
 * @returns {Object} Атрибуты NFT
 */
function generateAttributes() {
  return {
    power: Math.floor(Math.random() * 80) + 20,
    agility: Math.floor(Math.random() * 80) + 20,
    wisdom: Math.floor(Math.random() * 80) + 20,
    luck: Math.floor(Math.random() * 80) + 20
  };
}

/**
 * Определяет редкость NFT на основе случайного распределения
 * @returns {string} Редкость NFT (common, uncommon, rare, epic, legendary)
 */
function determineRarity() {
  const rand = Math.random() * 100;
  
  if (rand <= 1) return 'legendary';   // 1%
  if (rand <= 5) return 'epic';        // 4%
  if (rand <= 15) return 'rare';       // 10%
  if (rand <= 40) return 'uncommon';   // 25%
  return 'common';                     // 60%
}

/**
 * Генерирует цену для NFT на основе его редкости
 * @param {string} rarity Редкость NFT
 * @returns {number} Цена NFT в долларах
 */
function generatePrice(rarity) {
  const basePrices = {
    'common': 30,
    'uncommon': 80,
    'rare': 300,
    'epic': 1000,
    'legendary': 10000
  };
  
  const variance = {
    'common': 50,
    'uncommon': 200,
    'rare': 500,
    'epic': 3000,
    'legendary': 10000
  };
  
  const basePrice = basePrices[rarity] || 30;
  const maxVariance = variance[rarity] || 50;
  
  return basePrice + Math.floor(Math.random() * maxVariance);
}

/**
 * Генерирует описание для NFT на основе его редкости
 * @param {number} tokenId ID токена NFT
 * @param {string} rarity Редкость NFT
 * @returns {string} Описание NFT
 */
function generateDescription(tokenId, rarity) {
  const descriptions = {
    'common': `Mutant Ape #${tokenId} из коллекции Mutant Ape Yacht Club. Обычная редкость.`,
    'uncommon': `Mutant Ape #${tokenId} из коллекции Mutant Ape Yacht Club. Необычная редкость с уникальными чертами.`,
    'rare': `Mutant Ape #${tokenId} из коллекции Mutant Ape Yacht Club. Редкий экземпляр с особыми свойствами.`,
    'epic': `Mutant Ape #${tokenId} из коллекции Mutant Ape Yacht Club. Эпический экземпляр, обладающий исключительными характеристиками.`,
    'legendary': `Mutant Ape #${tokenId} из коллекции Mutant Ape Yacht Club. Легендарный экземпляр, один из самых редких в коллекции.`
  };
  
  return descriptions[rarity] || descriptions['common'];
}

/**
 * Создает новое изображение Mutant Ape
 * @param {number} index Индекс создаваемого NFT
 * @returns {Promise<string>} Путь к созданному изображению
 */
async function createMutantApeImage(index) {
  try {
    // Ищем существующее изображение из нашей коллекции Mutant Ape
    const sourceDir = CONFIG.imageDirectories.source;
    
    // Проверяем, существует ли директория
    if (!fs.existsSync(sourceDir)) {
      throw new Error(`Директория источника изображений не найдена: ${sourceDir}`);
    }
    
    // Получаем список файлов
    const files = fs.readdirSync(sourceDir)
      .filter(file => file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg'));
    
    if (files.length === 0) {
      throw new Error('Не найдено изображений в директории источника');
    }
    
    // Выбираем случайное изображение
    const randomImageIndex = Math.floor(Math.random() * files.length);
    const sourceImage = path.join(sourceDir, files[randomImageIndex]);
    
    // Создаем новое имя файла для вывода
    const outputFileName = `mutant_ape_official_${index}.png`;
    const outputFilePath = path.join(CONFIG.imageDirectories.output, outputFileName);
    
    // Загружаем и обрабатываем изображение
    const image = await loadImage(sourceImage);
    
    // Создаем холст с тем же размером
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');
    
    // Рисуем исходное изображение
    ctx.drawImage(image, 0, 0);
    
    // Сохраняем изображение
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(outputFilePath, buffer);
    
    return `/mutant_ape_official/${outputFileName}`;
  } catch (error) {
    console.error('Ошибка при создании изображения:', error.message);
    // Возвращаем путь к заглушке, если не удалось создать изображение
    return `/mutant_ape_official/placeholder.png`;
  }
}

/**
 * Запускает процесс импорта Mutant Ape NFT
 */
async function importMutantApeNFT() {
  createDirectories();
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
  
  try {
    await client.connect();
    console.log('Подключение к базе данных установлено');
    
    let importedCount = 0;
    
    // Создаем placeholder изображение, если оно еще не существует
    const placeholderPath = path.join(CONFIG.imageDirectories.output, 'placeholder.png');
    if (!fs.existsSync(placeholderPath)) {
      const canvas = createCanvas(500, 500);
      const ctx = canvas.getContext('2d');
      
      // Заполняем фон
      ctx.fillStyle = '#3d3d3d';
      ctx.fillRect(0, 0, 500, 500);
      
      // Добавляем текст
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 30px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Mutant Ape', 250, 200);
      ctx.fillText('Yacht Club', 250, 250);
      ctx.font = '20px Arial';
      ctx.fillText('Placeholder Image', 250, 300);
      
      const buffer = canvas.toBuffer('image/png');
      fs.writeFileSync(placeholderPath, buffer);
      console.log('Создано изображение-заглушка');
    }
    
    // Импортируем NFT
    for (let i = 1; i <= CONFIG.totalToCreate; i++) {
      // Генерируем tokenId (начиная с 10000, чтобы избежать конфликтов)
      const tokenId = 10000 + i;
      
      // Определяем редкость и цену
      const rarity = determineRarity();
      const price = generatePrice(rarity);
      
      // Генерируем атрибуты
      const attributes = generateAttributes();
      
      // Создаем изображение
      const imagePath = await createMutantApeImage(i);
      
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
        CONFIG.collection.id,
        CONFIG.owner.id,
        `Mutant Ape #${tokenId}`,
        generateDescription(tokenId, rarity),
        imagePath,
        rarity,
        tokenId.toString(),
        JSON.stringify(attributes),
        price.toString(),
        true,
        new Date()
      ];
      
      const result = await client.query(insertQuery, values);
      const nftId = result.rows[0].id;
      
      console.log(`✅ Создан Mutant Ape #${tokenId} (ID: ${nftId}, редкость: ${rarity}, цена: $${price})`);
      
      importedCount++;
      
      // Задержка для предотвращения перегрузки БД
      if (i % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 500));
        console.log(`Прогресс: ${i}/${CONFIG.totalToCreate} NFT создано`);
      }
    }
    
    console.log(`\n✨ Успех! Создано ${importedCount} Mutant Ape NFT`);
    
    return { success: true, count: importedCount };
  } catch (error) {
    console.error('Ошибка при импорте NFT:', error);
    return { success: false, error: error.message };
  } finally {
    await client.end();
    console.log('Соединение с базой данных закрыто');
  }
}

// Запускаем импорт
importMutantApeNFT()
  .then(result => {
    if (result.success) {
      console.log(`🎉 Операция завершена. Импортировано ${result.count} NFT Mutant Ape Yacht Club.`);
    } else {
      console.error(`❌ Ошибка при импорте: ${result.error}`);
    }
  })
  .catch(err => {
    console.error('❌ Критическая ошибка:', err);
  });
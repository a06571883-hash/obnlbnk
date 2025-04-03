/**
 * Скрипт для прямого импорта небольшой партии коллекции Mutant Ape Yacht Club (MAYC)
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
  totalToCreate: 20,
  
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
    
    // Копируем файл напрямую
    fs.copyFileSync(sourceImage, outputFilePath);
    
    // Возвращаем относительный путь для хранения в БД
    return `/mutant_ape_official/${outputFileName}`;
  } catch (error) {
    console.error(`Ошибка при создании изображения для индекса ${index}:`, error);
    
    // Создаем изображение-заглушку, если произошла ошибка
    const canvas = createCanvas(300, 300);
    const ctx = canvas.getContext('2d');
    
    // Заливаем фон
    ctx.fillStyle = '#333333';
    ctx.fillRect(0, 0, 300, 300);
    
    // Добавляем текст
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Mutant Ape', 150, 130);
    ctx.fillText(`#${10000 + index}`, 150, 160);
    
    // Создаем имя файла для заглушки
    const fallbackFileName = `mutant_ape_fallback_${index}.png`;
    const fallbackFilePath = path.join(CONFIG.imageDirectories.output, fallbackFileName);
    
    // Сохраняем изображение-заглушку
    fs.writeFileSync(fallbackFilePath, canvas.toBuffer('image/png'));
    console.log('Создано изображение-заглушка');
    
    // Возвращаем относительный путь к заглушке
    return `/mutant_ape_official/${fallbackFileName}`;
  }
}

/**
 * Запускает процесс импорта Mutant Ape NFT
 */
async function importMutantApeNFT() {
  // Подключаемся к базе данных
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
    await client.connect();
    console.log('Подключение к базе данных установлено');
    
    // Создаем директории, если они не существуют
    createDirectories();
    
    // Счетчик импортированных NFT
    let importedCount = 0;
    
    // Создаем NFT в указанном количестве
    for (let i = 1; i <= CONFIG.totalToCreate; i++) {
      // Генерируем ID токена (начиная с 10000)
      const tokenId = 10000 + i;
      
      // Определяем редкость
      const rarity = determineRarity();
      
      // Генерируем цену на основе редкости
      const price = generatePrice(rarity);
      
      // Генерируем атрибуты
      const attributes = generateAttributes();
      
      // Создаем изображение
      const imagePath = await createMutantApeImage(i);
      
      // Добавляем NFT в базу данных
      const insertQuery = `
        INSERT INTO nft (
          collection_name,
          owner_id,
          name,
          description,
          image_url,
          token_id,
          price,
          for_sale,
          creator_id,
          regulator_id,
          created_at,
          attributes,
          rarity
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING id
      `;
      
      const values = [
        CONFIG.collection.name,
        CONFIG.owner.id,
        `Mutant Ape #${tokenId}`,
        generateDescription(tokenId, rarity),
        imagePath,
        tokenId.toString(),
        price.toString(),
        true,
        CONFIG.owner.id, // creator_id
        1, // regulator_id
        new Date(),
        JSON.stringify(attributes),
        rarity
      ];
      
      const result = await client.query(insertQuery, values);
      const nftId = result.rows[0].id;
      
      console.log(`✅ Создан Mutant Ape #${tokenId} (ID: ${nftId}, редкость: ${rarity}, цена: $${price})`);
      
      importedCount++;
      
      // Задержка для предотвращения перегрузки БД
      if (i % 5 === 0) {
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
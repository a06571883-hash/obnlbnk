/**
 * Скрипт для обновления путей к изображениям NFT в базе данных
 * в соответствии с существующими файлами
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Загрузка переменных окружения
dotenv.config();

// Создание пула подключений к PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Проверяет наличие файла Bored Ape и возвращает правильный путь
 */
function checkBoredApePath(number) {
  // Проверяем пути в разных директориях в указанном порядке
  const possiblePaths = [
    `./bored_ape_nft/bored_ape_${number}.png`,
    `./new_bored_ape_nft/bored_ape_${number}.png`,
    `./nft_assets/bored_ape/bored_ape_${number}.png`,
    `./bayc_official_nft/bored_ape_${number}.png`
  ];

  for (const filePath of possiblePaths) {
    if (fs.existsSync(filePath)) {
      // Возвращаем путь без ./ в начале для использования в базе данных
      return '/' + filePath.substring(2);
    }
  }

  // Если не найден файл с точным номером, возвращаем первый существующий
  for (let i = 1; i <= 773; i++) {
    const fallbackPath = `./bored_ape_nft/bored_ape_${i}.png`;
    if (fs.existsSync(fallbackPath)) {
      return '/' + fallbackPath.substring(2);
    }
  }

  // Если ничего не найдено, возвращаем фиксированный путь к первому изображению
  return '/bored_ape_nft/bored_ape_1.png';
}

/**
 * Проверяет наличие файла Mutant Ape и возвращает правильный путь
 */
function checkMutantApePath(number) {
  // Проверяем PNG сначала
  const possiblePngPaths = [
    `./mutant_ape_nft/mutant_ape_${number}.png`,
    `./new_bored_ape_nft/mutant_ape_${number}.png`,
    `./nft_assets/mutant_ape/mutant_ape_${number}.png`
  ];

  for (const filePath of possiblePngPaths) {
    if (fs.existsSync(filePath)) {
      return '/' + filePath.substring(2);
    }
  }

  // Затем проверяем SVG
  const possibleSvgPaths = [
    `./mutant_ape_nft/mutant_ape_${number}.svg`,
    `./nft_assets/mutant_ape/mutant_ape_${number}.svg`
  ];

  for (const filePath of possibleSvgPaths) {
    if (fs.existsSync(filePath)) {
      return '/' + filePath.substring(2);
    }
  }

  // Если не найден файл с точным номером, используем первый существующий SVG
  for (let i = 10001; i <= 11000; i++) {
    const fallbackPath = `./mutant_ape_nft/mutant_ape_${i}.svg`;
    if (fs.existsSync(fallbackPath)) {
      return '/' + fallbackPath.substring(2);
    }
  }

  // Последний вариант - вернуть фиксированный путь к первому изображению
  return '/mutant_ape_nft/mutant_ape_10001.svg';
}

/**
 * Обновляет пути к изображениям в базе данных с проверкой существования файлов
 */
async function updateNftImagePaths() {
  console.log('Обновление путей к изображениям NFT в базе данных...');
  
  // Получаем данные о коллекциях
  const collections = await pool.query(`
    SELECT id, name FROM collections ORDER BY id
  `);
  
  console.log('Найдены коллекции:');
  collections.rows.forEach(c => console.log(`- ID: ${c.id}, Название: ${c.name}`));
  
  // Обработка каждой коллекции
  for (const collection of collections.rows) {
    console.log(`\nОбработка коллекции: ${collection.name} (ID: ${collection.id})`);
    
    // Получаем все NFT из коллекции
    const nfts = await pool.query(`
      SELECT id, token_id FROM nfts WHERE collection_id = $1
    `, [collection.id]);
    
    console.log(`Найдено ${nfts.rows.length} NFT в коллекции ${collection.name}`);
    
    // Батчами обновляем пути к изображениям
    const batchSize = 500;
    let processedCount = 0;
    
    for (let i = 0; i < nfts.rows.length; i += batchSize) {
      const batch = nfts.rows.slice(i, i + batchSize);
      
      for (const nft of batch) {
        let imagePath;
        
        if (collection.id === 1) { // Bored Ape Yacht Club
          // Для Bored Ape используем модуль от числа имеющихся изображений
          const imageNumber = (Number(nft.token_id) % 773) + 1;
          imagePath = checkBoredApePath(imageNumber);
        } else if (collection.id === 2) { // Mutant Ape Yacht Club
          // Для Mutant Ape используем номера от 10001 с модулем
          const imageNumber = (Number(nft.token_id) % 1000) + 10001;
          imagePath = checkMutantApePath(imageNumber);
        } else {
          continue; // Пропускаем другие коллекции
        }
        
        // Обновляем путь к изображению в базе данных
        await pool.query(`
          UPDATE nfts 
          SET 
            image_path = $1, 
            original_image_path = $1
          WHERE id = $2
        `, [imagePath, nft.id]);
        
        processedCount++;
        
        if (processedCount % 100 === 0) {
          console.log(`Обработано ${processedCount} из ${nfts.rows.length} NFT...`);
        }
      }
    }
    
    console.log(`Завершена обработка коллекции ${collection.name}, обновлено ${processedCount} NFT`);
  }
  
  console.log('\nОбновление путей к изображениям NFT завершено!');
}

/**
 * Перемешивает порядок отображения NFT
 */
async function randomizeNftOrder() {
  console.log('\nПеремешивание порядка отображения NFT...');
  
  await pool.query(`
    UPDATE nfts 
    SET sort_order = (RANDOM() * 20000)::INTEGER
  `);
  
  console.log('Порядок отображения NFT успешно перемешан');
}

/**
 * Основная функция
 */
async function main() {
  try {
    console.log('Запуск скрипта для обновления путей к изображениям NFT...');
    
    // Обновляем пути к изображениям
    await updateNftImagePaths();
    
    // Перемешиваем порядок отображения
    await randomizeNftOrder();
    
    console.log('\nСкрипт успешно завершен!');
  } catch (error) {
    console.error('Ошибка выполнения скрипта:', error);
  } finally {
    // Закрываем соединение с базой данных
    await pool.end();
  }
}

// Запускаем скрипт
main();
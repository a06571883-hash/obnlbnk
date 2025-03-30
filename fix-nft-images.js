/**
 * Скрипт для исправления путей к изображениям NFT
 * Заменяет пути к SVG-изображениям на пути к реальным изображениям BAYC и MAYC
 */
import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const { Pool } = pg;
const { config } = dotenv;

// Загружаем переменные окружения
config();

// Директории с изображениями
const BORED_APE_DIR = './bored_ape_nft';
const BAYC_OFFICIAL_DIR = './bayc_official_nft';
const NEW_BORED_APES_DIR = './new_bored_apes';

// Подключаемся к базе данных PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Получает список всех доступных изображений NFT
 * @returns {Object} Объект со списками изображений по типам
 */
function getNFTImagePaths() {
  const images = {
    boredApe: [],
    baycOfficial: [],
    newBoredApes: []
  };

  // Получаем изображения из bored_ape_nft
  if (fs.existsSync(BORED_APE_DIR)) {
    const files = fs.readdirSync(BORED_APE_DIR);
    images.boredApe = files
      .filter(file => file.endsWith('.png') || file.endsWith('.avif'))
      .map(file => `/bored_ape_nft/${file}`);
  }

  // Получаем изображения из bayc_official_nft
  if (fs.existsSync(BAYC_OFFICIAL_DIR)) {
    const files = fs.readdirSync(BAYC_OFFICIAL_DIR);
    images.baycOfficial = files
      .filter(file => file.endsWith('.png') || file.endsWith('.avif'))
      .map(file => `/bayc_official_nft/${file}`);
  }

  // Получаем изображения из new_bored_apes
  if (fs.existsSync(NEW_BORED_APES_DIR)) {
    const files = fs.readdirSync(NEW_BORED_APES_DIR);
    images.newBoredApes = files
      .filter(file => file.endsWith('.png') || file.endsWith('.avif'))
      .map(file => `/new_bored_apes/${file}`);
  }

  return images;
}

/**
 * Исправляет пути к изображениям в базе данных
 * @param {number} startId - ID, с которого начинать обновление (для пакетной обработки)
 * @param {number} batchSize - Размер пакета для обновления
 */
async function fixNFTImagePaths(startId = 0, batchSize = 500) {
  const client = await pool.connect();
  try {
    console.log('Получаем доступные изображения...');
    const images = getNFTImagePaths();
    
    console.log(`Найдено изображений:
- Bored Ape: ${images.boredApe.length}
- BAYC Official: ${images.baycOfficial.length}
- New Bored Apes: ${images.newBoredApes.length}`);

    // Если нет доступных изображений, выходим
    if (images.boredApe.length === 0 && images.baycOfficial.length === 0 && images.newBoredApes.length === 0) {
      console.error('Не найдены доступные изображения NFT. Скрипт остановлен.');
      return;
    }

    // Получаем общее количество NFT для определения прогресса
    const totalCountResult = await client.query('SELECT COUNT(*) FROM nfts');
    const totalCount = parseInt(totalCountResult.rows[0].count);
    console.log(`Всего NFT в базе данных: ${totalCount}`);

    // Получаем пакет NFT из базы данных
    console.log(`Получаем пакет NFT начиная с ID ${startId}, размер пакета: ${batchSize}...`);
    const nftsResult = await client.query(
      'SELECT id, name, token_id, image_path FROM nfts WHERE id >= $1 ORDER BY id LIMIT $2',
      [startId, batchSize]
    );
    const nfts = nftsResult.rows;
    console.log(`Получено ${nfts.length} NFT для обработки`);

    if (nfts.length === 0) {
      console.log('Нет NFT для обработки в этом пакете. Возможно, все NFT уже обработаны.');
      return totalCount; // Возвращаем общее количество для расчета следующего пакета
    }

    // Регулярные выражения для определения типа NFT
    const boredApeRegex = /bored.*ape|ape.*yacht|bayc/i;
    const mutantApeRegex = /mutant.*ape|mayc/i;
    
    // Выполняем пакетное обновление в транзакции
    await client.query('BEGIN');
    let updatedCount = 0;
    let failedCount = 0;
    
    for (const nft of nfts) {
      try {
        let newImagePath = null;
        
        // Определяем тип NFT по имени
        const isBored = boredApeRegex.test(nft.name.toLowerCase());
        const isMutant = mutantApeRegex.test(nft.name.toLowerCase());
        
        // Получаем ID токена из строки, если он содержится в имени или token_id
        let tokenIdMatch = (nft.name.match(/#(\d+)/) || nft.token_id.match(/(\d+)/));
        const tokenId = tokenIdMatch ? parseInt(tokenIdMatch[1]) : null;
        
        // Подбираем подходящее изображение
        if (isBored) {
          // Для Bored Ape сначала пробуем найти в официальной коллекции
          if (images.baycOfficial.length > 0) {
            // Если есть token_id, пробуем найти соответствующее изображение
            if (tokenId !== null) {
              const specificImage = images.baycOfficial.find(img => img.includes(`official_bored_ape_${tokenId}`));
              if (specificImage) {
                newImagePath = specificImage;
              }
            }
            
            // Если не нашли конкретное изображение, берем случайное
            if (!newImagePath) {
              const randomIndex = Math.floor(Math.random() * images.baycOfficial.length);
              newImagePath = images.baycOfficial[randomIndex];
            }
          } 
          // Если нет официальных, используем из других директорий
          else if (images.newBoredApes.length > 0) {
            const randomIndex = Math.floor(Math.random() * images.newBoredApes.length);
            newImagePath = images.newBoredApes[randomIndex];
          }
          else if (images.boredApe.length > 0) {
            const randomIndex = Math.floor(Math.random() * images.boredApe.length);
            newImagePath = images.boredApe[randomIndex];
          }
        } 
        else if (isMutant) {
          // Для Mutant Ape используем изображения из bored_ape_nft
          if (images.boredApe.length > 0) {
            const randomIndex = Math.floor(Math.random() * images.boredApe.length);
            newImagePath = images.boredApe[randomIndex];
          }
        } 
        // Для всех остальных NFT выбираем случайное изображение
        else {
          const allImages = [...images.boredApe, ...images.baycOfficial, ...images.newBoredApes];
          if (allImages.length > 0) {
            const randomIndex = Math.floor(Math.random() * allImages.length);
            newImagePath = allImages[randomIndex];
          }
        }
        
        // Если нашли подходящее изображение, обновляем запись в БД
        if (newImagePath) {
          await client.query(
            'UPDATE nfts SET image_path = $1 WHERE id = $2',
            [newImagePath, nft.id]
          );
          updatedCount++;
        } else {
          failedCount++;
        }
      } catch (error) {
        console.error(`Ошибка обновления пути для NFT ID ${nft.id}:`, error);
        failedCount++;
      }
    }
    
    // Завершаем транзакцию
    await client.query('COMMIT');
    
    const lastProcessedId = nfts.length > 0 ? nfts[nfts.length - 1].id : startId;
    console.log(`Пакет обработан: обновлено ${updatedCount}, не удалось обновить ${failedCount}`);
    console.log(`Последний обработанный ID: ${lastProcessedId}`);
    
    return totalCount; // Возвращаем общее количество для расчета следующего пакета
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Ошибка при исправлении путей изображений:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Функция для обработки всех NFT пакетами
 * @param {number} startId - ID, с которого начинать обработку
 * @param {number} batchSize - Размер пакета
 */
async function processAllNFTs(startId = 0, batchSize = 500) {
  let currentId = startId;
  let totalProcessed = 0;
  let totalCount = 0;
  
  try {
    console.log(`Начинаем пакетную обработку NFT. Начальный ID: ${startId}, размер пакета: ${batchSize}`);
    
    // Обрабатываем NFT пакетами до тех пор, пока не закончатся NFT
    while (true) {
      console.log(`\n--- Обработка пакета начиная с ID ${currentId} ---`);
      
      // Обрабатываем текущий пакет
      totalCount = await fixNFTImagePaths(currentId, batchSize);
      
      // Получаем следующий ID для обработки
      const nextId = currentId + batchSize;
      
      // Обновляем счетчик обработанных NFT
      totalProcessed += batchSize;
      
      // Выводим общий прогресс
      const progress = Math.min(100, (totalProcessed / totalCount) * 100).toFixed(2);
      console.log(`Прогресс: ${progress}% (обработано примерно ${totalProcessed} из ${totalCount})`);
      
      // Если мы обработали все NFT, выходим из цикла
      if (totalProcessed >= totalCount) {
        console.log('Все NFT обработаны!');
        break;
      }
      
      // Обновляем текущий ID для следующего пакета
      currentId = nextId;
      
      // Добавляем небольшую задержку между пакетами для снижения нагрузки
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log(`\nОбработка завершена! Всего обработано NFT: ${totalProcessed}`);
    return true;
  } catch (error) {
    console.error('Ошибка при пакетной обработке NFT:', error);
    return false;
  }
}

/**
 * Обрабатывает только один пакет NFT
 * @param {number} startId - ID, с которого начинать обработку
 * @param {number} batchSize - Размер пакета
 */
async function processSingleBatch(startId = 0, batchSize = 500) {
  try {
    console.log(`Обработка одного пакета. Начальный ID: ${startId}, размер пакета: ${batchSize}`);
    await fixNFTImagePaths(startId, batchSize);
    console.log('Пакет успешно обработан.');
    return true;
  } catch (error) {
    console.error('Ошибка при обработке пакета:', error);
    return false;
  }
}

/**
 * Основная функция
 */
async function main() {
  try {
    // Получаем аргументы командной строки
    const args = process.argv.slice(2);
    const startId = parseInt(args[0]) || 0;
    const batchSize = parseInt(args[1]) || 500;
    const singleBatch = args.includes('--single');
    
    console.log(`Параметры запуска: startId=${startId}, batchSize=${batchSize}, singleBatch=${singleBatch}`);
    
    // Запускаем обработку в зависимости от параметров
    if (singleBatch) {
      await processSingleBatch(startId, batchSize);
    } else {
      await processAllNFTs(startId, batchSize);
    }
    
    console.log('Скрипт успешно выполнен.');
  } catch (error) {
    console.error('Ошибка при выполнении скрипта:', error);
  } finally {
    await pool.end();
    console.log('Соединение с базой данных закрыто.');
  }
}

// Запускаем скрипт
main();
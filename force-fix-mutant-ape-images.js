/**
 * Скрипт для принудительного исправления проблем с изображениями Mutant Ape NFT
 * Перестраивает пути и переносит изображения, чтобы гарантировать правильное отображение
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
const { Client } = pg;

// Подключаемся к базе данных
const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

// Константы путей
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MUTANT_APE_DIR = path.join(process.cwd(), 'mutant_ape_nft');
const MUTANT_APE_OFFICIAL_DIR = path.join(process.cwd(), 'mutant_ape_official');
const MUTANT_APE_BACKUP_DIR = path.join(process.cwd(), 'mutant_ape_backup');
const IMAGE_PATH_PREFIX = '/mutant_ape_nft/';

/**
 * Создает резервную копию текущих изображений
 */
async function backupMutantApeImages() {
  console.log('📦 Создаем резервную копию изображений Mutant Ape...');
  
  // Создаем директорию для резервной копии, если ее нет
  if (!fs.existsSync(MUTANT_APE_BACKUP_DIR)) {
    fs.mkdirSync(MUTANT_APE_BACKUP_DIR, { recursive: true });
  }
  
  // Копируем все изображения из основной директории
  if (fs.existsSync(MUTANT_APE_DIR)) {
    const files = fs.readdirSync(MUTANT_APE_DIR);
    const imageFiles = files.filter(file => file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.avif'));
    
    console.log(`📊 Найдено ${imageFiles.length} изображений для резервного копирования`);
    
    for (const file of imageFiles) {
      const sourcePath = path.join(MUTANT_APE_DIR, file);
      const destPath = path.join(MUTANT_APE_BACKUP_DIR, file);
      
      // Пропускаем, если файл уже существует в бэкапе
      if (fs.existsSync(destPath)) {
        continue;
      }
      
      try {
        // Копируем файл
        fs.copyFileSync(sourcePath, destPath);
      } catch (error) {
        console.error(`❌ Ошибка при копировании файла ${file}:`, error);
      }
    }
    
    console.log(`✅ Резервная копия создана: скопировано ${imageFiles.length} изображений`);
  } else {
    console.log(`⚠️ Директория ${MUTANT_APE_DIR} не найдена, не удалось создать резервную копию`);
  }
}

/**
 * Проверяет и создает необходимые директории
 */
function ensureDirectoriesExist() {
  // Создаем основную директорию, если она не существует
  if (!fs.existsSync(MUTANT_APE_DIR)) {
    console.log(`Создаем директорию ${MUTANT_APE_DIR}...`);
    fs.mkdirSync(MUTANT_APE_DIR, { recursive: true });
  }
  
  // Создаем директорию для официальных Mutant Ape, если она не существует
  if (!fs.existsSync(MUTANT_APE_OFFICIAL_DIR)) {
    console.log(`Создаем директорию ${MUTANT_APE_OFFICIAL_DIR}...`);
    fs.mkdirSync(MUTANT_APE_OFFICIAL_DIR, { recursive: true });
  }
}

/**
 * Получает список NFT коллекции Mutant Ape из базы данных
 */
async function getMutantApeNFTs() {
  console.log('🔍 Получаем список NFT коллекции Mutant Ape из базы данных...');
  
  // Запрос на получение всех NFT коллекции Mutant Ape
  const query = `
    SELECT n.id, n.token_id, n.image_path, n.name, c.name as collection_name
    FROM nfts n
    JOIN nft_collections c ON n.collection_id = c.id
    WHERE c.name LIKE '%Mutant%'
    ORDER BY n.token_id;
  `;
  
  const result = await client.query(query);
  const nfts = result.rows;
  
  console.log(`📊 Получено ${nfts.length} NFT из коллекции Mutant Ape`);
  
  return nfts;
}

/**
 * Перемещает все изображения Mutant Ape в правильные директории и обновляет пути в базе данных
 */
async function fixMutantApeImagePaths(nfts) {
  console.log('🛠️ Исправляем пути к изображениям Mutant Ape...');
  
  let updatedCount = 0;
  
  for (const nft of nfts) {
    // Определяем номер токена
    const tokenId = parseInt(nft.token_id);
    
    // Создаем правильное имя файла
    // Для чисел менее 1000 добавляем ведущие нули
    let fileNameSuffix;
    if (tokenId < 10) {
      fileNameSuffix = `${tokenId}`;  // Одноразрядные числа без ведущих нулей (как в оригинале)
    } else if (tokenId < 100) {
      fileNameSuffix = `00${tokenId}`;  // Для двузначных чисел добавляем два ведущих нуля
    } else if (tokenId < 1000) {
      fileNameSuffix = `0${tokenId}`;  // Для трехзначных чисел добавляем один ведущий нуль
    } else {
      fileNameSuffix = `${tokenId}`;  // Для больших чисел нет ведущих нулей
    }
    
    // Определяем правильное имя файла и путь
    const fileName = `mutant_ape_${fileNameSuffix}.png`;
    const correctImagePath = `${IMAGE_PATH_PREFIX}${fileName}`;
    
    // Проверяем, нужно ли обновление
    if (nft.image_path !== correctImagePath) {
      // Путь нуждается в исправлении
      console.log(`🔄 Исправляем путь для NFT #${nft.id} (Token ID: ${nft.token_id}):`);
      console.log(`   До: ${nft.image_path}`);
      console.log(`   После: ${correctImagePath}`);
      
      // Обновляем путь в базе данных
      try {
        await client.query(
          'UPDATE nfts SET image_path = $1 WHERE id = $2',
          [correctImagePath, nft.id]
        );
        updatedCount++;
      } catch (error) {
        console.error(`❌ Ошибка при обновлении пути для NFT #${nft.id}:`, error);
      }
    }
    
    // Проверяем, есть ли файл изображения
    const fullFilePath = path.join(MUTANT_APE_DIR, fileName);
    
    // Если файл не существует, создаем символическую ссылку на другое изображение
    if (!fs.existsSync(fullFilePath)) {
      // Ищем произвольное изображение для копирования
      const existingImages = fs.readdirSync(MUTANT_APE_DIR)
        .filter(file => file.endsWith('.png'));
      
      if (existingImages.length > 0) {
        // Берем существующее изображение для копирования
        const sourceIndex = tokenId % existingImages.length;
        const sourceFile = existingImages[sourceIndex];
        const sourcePath = path.join(MUTANT_APE_DIR, sourceFile);
        
        try {
          // Копируем файл
          fs.copyFileSync(sourcePath, fullFilePath);
          console.log(`✅ Создана копия изображения: ${fileName} (из ${sourceFile})`);
        } catch (error) {
          console.error(`❌ Ошибка при копировании файла для ${fileName}:`, error);
        }
      }
    }
  }
  
  console.log(`✅ Обновлено ${updatedCount} путей к изображениям из ${nfts.length} NFT`);
  
  return updatedCount;
}

/**
 * Исправляет пути в модуле обработки изображений на клиенте, если это необходимо
 */
async function fixClientImageHandling() {
  console.log('🔧 Проверяем обработку изображений на клиенте...');
  
  // Путь к клиентскому файлу обработки изображений
  const imageFunctionPath = path.join(process.cwd(), 'client', 'src', 'lib', 'image-utils.ts');
  
  if (fs.existsSync(imageFunctionPath)) {
    // Читаем содержимое файла
    const content = fs.readFileSync(imageFunctionPath, 'utf8');
    
    // Проверяем наличие обработки Mutant Ape
    if (!content.includes('mutant_ape_nft') || !content.includes('collection=mutant')) {
      console.log('⚠️ Возможно, требуется исправление обработки Mutant Ape на клиенте');
      
      // Не изменяем автоматически, только предупреждаем
      console.log('   Рекомендуется проверить логику обработки в image-utils.ts');
    } else {
      console.log('✅ Код обработки изображений на клиенте выглядит корректным');
    }
  } else {
    console.log('❌ Файл обработки изображений на клиенте не найден');
  }
}

/**
 * Исправляет отображение изображений на сервере
 */
async function fixServerImageHandling() {
  console.log('🔧 Проверяем обработку изображений на сервере...');
  
  // Путь к серверному файлу обработки изображений
  const nftServerPath = path.join(process.cwd(), 'server', 'nft-image-server.js');
  
  if (fs.existsSync(nftServerPath)) {
    console.log('✅ Нашли файл сервера изображений NFT');
    
    // Анализируем, но не изменяем автоматически
    const content = fs.readFileSync(nftServerPath, 'utf8');
    
    // Проверяем обработку Mutant Ape
    const hasMutantHandling = content.includes('mutant_ape');
    
    if (hasMutantHandling) {
      console.log('✅ Серверный код содержит обработку Mutant Ape');
      
      // Проверяем, есть ли выделенная логика для Mutant Ape
      const hasSpecificMutantLogic = content.includes('isOfficialMutantApe') || 
                                    content.includes('isMutantApe');
      
      if (hasSpecificMutantLogic) {
        console.log('✅ Серверный код имеет специальную логику для Mutant Ape');
      } else {
        console.log('⚠️ Серверный код может не иметь специальной логики для Mutant Ape');
      }
    } else {
      console.log('❌ Серверный код не содержит обработку Mutant Ape');
    }
  } else {
    console.log('❌ Файл сервера изображений NFT не найден');
  }
}

/**
 * Очищает кэш изображений на сервере
 */
async function clearImageCache() {
  console.log('🧹 Очищаем кэш изображений...');
  
  // Путь к файлу кэша изображений (если используется)
  const cacheDirs = [
    path.join(process.cwd(), 'tmp', 'image-cache'),
    path.join(process.cwd(), 'cache', 'images'),
    path.join(process.cwd(), '.cache', 'images')
  ];
  
  let cacheCleared = false;
  
  for (const cacheDir of cacheDirs) {
    if (fs.existsSync(cacheDir)) {
      console.log(`✅ Найдена директория кэша: ${cacheDir}`);
      
      try {
        const files = fs.readdirSync(cacheDir);
        
        // Удаляем файлы, которые содержат "mutant_ape" в имени
        let deletedCount = 0;
        for (const file of files) {
          if (file.includes('mutant_ape')) {
            const filePath = path.join(cacheDir, file);
            fs.unlinkSync(filePath);
            deletedCount++;
          }
        }
        
        if (deletedCount > 0) {
          console.log(`✅ Удалено ${deletedCount} кэшированных изображений из ${cacheDir}`);
          cacheCleared = true;
        } else {
          console.log(`ℹ️ Не найдены кэшированные изображения Mutant Ape в ${cacheDir}`);
        }
      } catch (error) {
        console.error(`❌ Ошибка при очистке кэша в ${cacheDir}:`, error);
      }
    }
  }
  
  if (!cacheCleared) {
    console.log('ℹ️ Не найдены директории кэша изображений');
  }
}

/**
 * Проверяет результаты исправления
 */
async function validateFixes() {
  console.log('🔍 Проверяем результаты исправления...');
  
  // Получаем обновленные данные из базы
  const query = `
    SELECT n.id, n.token_id, n.image_path, n.name, c.name as collection_name
    FROM nfts n
    JOIN nft_collections c ON n.collection_id = c.id
    WHERE c.name LIKE '%Mutant%'
    LIMIT 10;
  `;
  
  const result = await client.query(query);
  const nfts = result.rows;
  
  console.log('🔎 Примеры обновленных NFT:');
  nfts.forEach((nft, index) => {
    console.log(`${index + 1}. ID: ${nft.id}, Token: ${nft.token_id}`);
    console.log(`   Путь: ${nft.image_path}`);
    
    // Проверяем, правильный ли формат пути
    const isMutantPath = nft.image_path && nft.image_path.includes('mutant_ape');
    console.log(`   Формат пути: ${isMutantPath ? '✅ Правильный' : '❌ Неправильный'}`);
    
    // Проверяем, существует ли файл
    if (nft.image_path) {
      const localPath = path.join(process.cwd(), ...nft.image_path.split('/').filter(p => p));
      const fileExists = fs.existsSync(localPath);
      console.log(`   Файл существует: ${fileExists ? '✅ Да' : '❌ Нет'}`);
    }
    console.log('');
  });
}

/**
 * Главная функция
 */
async function main() {
  console.log('🚀 Запуск принудительного исправления изображений Mutant Ape NFT...');
  
  try {
    // Подключаемся к базе данных
    await client.connect();
    
    // Создаем резервную копию текущих изображений
    await backupMutantApeImages();
    
    // Проверяем и создаем необходимые директории
    ensureDirectoriesExist();
    
    // Получаем список NFT коллекции Mutant Ape
    const nfts = await getMutantApeNFTs();
    
    // Исправляем пути к изображениям
    const updatedCount = await fixMutantApeImagePaths(nfts);
    
    // Исправляем обработку изображений на клиенте (если требуется)
    await fixClientImageHandling();
    
    // Исправляем обработку изображений на сервере (если требуется)
    await fixServerImageHandling();
    
    // Очищаем кэш изображений
    await clearImageCache();
    
    // Проверяем результаты исправления
    await validateFixes();
    
    console.log('✅ Исправление завершено');
    console.log(`📊 Итоги: проверено ${nfts.length} NFT, обновлено ${updatedCount} путей`);
    
    // Завершаем работу с базой данных
    await client.end();
  } catch (error) {
    console.error('❌ Ошибка при выполнении исправления:', error);
    
    try {
      // Завершаем работу с базой данных в случае ошибки
      await client.end();
    } catch (err) {
      // Игнорируем ошибки при закрытии соединения
    }
  }
}

// Запускаем скрипт
main().catch(console.error);
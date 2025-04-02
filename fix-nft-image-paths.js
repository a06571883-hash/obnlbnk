/**
 * Скрипт для исправления путей к изображениям NFT в базе данных
 * Гарантирует, что все пути указывают на существующие файлы
 */

import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Получаем текущую директорию
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Проверяем наличие переменной окружения с URL базы данных
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ Переменная окружения DATABASE_URL не найдена');
  process.exit(1);
}

// Создаем подключение к базе данных
const sql = neon(DATABASE_URL);

// Директории для работы
const MUTANT_APE_NFT_DIR = path.join(process.cwd(), 'mutant_ape_nft');
const BORED_APE_NFT_DIR = path.join(process.cwd(), 'bored_ape_nft');

/**
 * Получает информацию обо всех NFT из базы данных
 */
async function getAllNFTFromDB() {
  try {
    console.log('🔍 Получаем информацию о всех NFT из базы данных...');
    
    // Получаем коллекции
    const collections = await sql`
      SELECT id, name FROM nft_collections
    `;
    
    console.log(`📋 Найдено ${collections.length} коллекций NFT:`);
    for (const collection of collections) {
      console.log(`  - ${collection.name} (ID: ${collection.id})`);
    }
    
    // Получаем информацию о всех NFT
    const nfts = await sql`
      SELECT 
        n.id, 
        n.token_id, 
        n.name, 
        n.image_path, 
        c.name as collection_name
      FROM nfts n
      JOIN nft_collections c ON n.collection_id = c.id
    `;
    
    console.log(`📋 Найдено ${nfts.length} NFT в базе данных`);
    
    // Группируем NFT по коллекциям
    const nftsByCollection = {};
    
    for (const nft of nfts) {
      const collectionName = nft.collection_name;
      
      if (!nftsByCollection[collectionName]) {
        nftsByCollection[collectionName] = [];
      }
      
      nftsByCollection[collectionName].push(nft);
    }
    
    // Выводим статистику по каждой коллекции
    for (const [collectionName, collectionNfts] of Object.entries(nftsByCollection)) {
      console.log(`📊 Коллекция "${collectionName}": ${collectionNfts.length} NFT`);
    }
    
    return {
      collections,
      nfts,
      nftsByCollection
    };
  } catch (error) {
    console.error('❌ Ошибка при получении данных из базы:', error);
    return null;
  }
}

/**
 * Проверяет и исправляет пути к изображениям Bored Ape NFT
 */
async function fixBoredApeImagePaths(nfts) {
  console.log('🔍 Проверяем и исправляем пути к изображениям Bored Ape NFT...');
  
  let fixedCount = 0;
  const boredApeNfts = nfts.filter(nft => 
    nft.collection_name.toLowerCase().includes('bored') || 
    nft.collection_name.toLowerCase().includes('bayc')
  );
  
  console.log(`📋 Найдено ${boredApeNfts.length} Bored Ape NFT для проверки`);
  
  for (const nft of boredApeNfts) {
    const tokenId = nft.token_id;
    const currentPath = nft.image_path;
    
    // Проверяем существование файла
    const fullPath = path.join(process.cwd(), currentPath);
    const fileExists = fs.existsSync(fullPath);
    
    if (!fileExists) {
      console.log(`⚠️ Файл не найден: ${fullPath}`);
      
      // Генерируем новый путь
      const newPath = `/bored_ape_nft/bored_ape_${tokenId}.png`;
      const newFullPath = path.join(process.cwd(), newPath);
      
      // Проверяем существование файла по новому пути
      const newFileExists = fs.existsSync(newFullPath);
      
      if (newFileExists) {
        // Если файл существует по новому пути, обновляем путь в базе
        console.log(`🔄 Обновляем путь для Bored Ape #${tokenId}: ${currentPath} -> ${newPath}`);
        
        await sql`
          UPDATE nfts 
          SET image_path = ${newPath}
          WHERE id = ${nft.id}
        `;
        
        fixedCount++;
      } else {
        console.log(`❌ Файл также не найден по пути ${newFullPath}`);
      }
    }
  }
  
  console.log(`✅ Исправлено ${fixedCount} путей к изображениям Bored Ape из ${boredApeNfts.length}`);
  return fixedCount;
}

/**
 * Проверяет и исправляет пути к изображениям Mutant Ape NFT
 */
async function fixMutantApeImagePaths(nfts) {
  console.log('🔍 Проверяем и исправляем пути к изображениям Mutant Ape NFT...');
  
  let fixedCount = 0;
  const mutantApeNfts = nfts.filter(nft => 
    nft.collection_name.toLowerCase().includes('mutant') || 
    nft.collection_name.toLowerCase().includes('mayc')
  );
  
  console.log(`📋 Найдено ${mutantApeNfts.length} Mutant Ape NFT для проверки`);
  
  for (const nft of mutantApeNfts) {
    const tokenId = nft.token_id;
    const currentPath = nft.image_path;
    
    // Проверяем существование файла
    const fullPath = path.join(process.cwd(), currentPath);
    const fileExists = fs.existsSync(fullPath);
    
    if (!fileExists) {
      console.log(`⚠️ Файл не найден: ${fullPath}`);
      
      // Генерируем новый путь (проверяем разные варианты)
      const possiblePaths = [
        `/mutant_ape_nft/mutant_ape_${tokenId}.png`, // Основной путь
        `/nft_assets/mutant_ape/mutant_ape_${tokenId}.png`, // Альтернативный путь
        `/mutant_ape_official/mutant_ape_${tokenId}.png` // Путь для официальных изображений
      ];
      
      // Проверяем все возможные пути
      let foundPath = null;
      
      for (const newPath of possiblePaths) {
        const newFullPath = path.join(process.cwd(), newPath);
        if (fs.existsSync(newFullPath)) {
          foundPath = newPath;
          break;
        }
      }
      
      if (foundPath) {
        // Если найден подходящий путь, обновляем запись в базе
        console.log(`🔄 Обновляем путь для Mutant Ape #${tokenId}: ${currentPath} -> ${foundPath}`);
        
        await sql`
          UPDATE nfts 
          SET image_path = ${foundPath}
          WHERE id = ${nft.id}
        `;
        
        fixedCount++;
      } else {
        console.log(`❌ Не найдено подходящих файлов для Mutant Ape #${tokenId}`);
      }
    }
  }
  
  console.log(`✅ Исправлено ${fixedCount} путей к изображениям Mutant Ape из ${mutantApeNfts.length}`);
  return fixedCount;
}

/**
 * Основная функция скрипта
 */
async function main() {
  console.log('🚀 Начинаем проверку и исправление путей к изображениям NFT...');
  
  // Получаем данные из базы данных
  const dbData = await getAllNFTFromDB();
  
  if (!dbData) {
    console.error('❌ Не удалось получить данные из базы данных');
    process.exit(1);
  }
  
  // Исправляем пути к изображениям Bored Ape
  const fixedBoredApe = await fixBoredApeImagePaths(dbData.nfts);
  
  // Исправляем пути к изображениям Mutant Ape
  const fixedMutantApe = await fixMutantApeImagePaths(dbData.nfts);
  
  console.log('✅ Все операции успешно завершены');
  console.log(`📊 Итого исправлено путей: ${fixedBoredApe + fixedMutantApe}`);
}

// Запускаем основную функцию
main().catch(err => {
  console.error('❌ Ошибка при выполнении скрипта:', err);
  process.exit(1);
});
/**
 * Скрипт для проверки правильности отображения Mutant Ape NFT
 * и диагностики сервера изображений
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Пути к директориям NFT
const MUTANT_APE_DIR = path.join(process.cwd(), 'mutant_ape_nft');
const CACHE_DIR = path.join(process.cwd(), '.image_cache');

// Прочитать порт NFT-сервера из файла
function getNFTServerPort() {
  try {
    const portFilePath = path.join(process.cwd(), 'nft-server-port.txt');
    if (fs.existsSync(portFilePath)) {
      const port = fs.readFileSync(portFilePath, 'utf8').trim();
      return parseInt(port, 10);
    }
  } catch (error) {
    console.error('Ошибка при чтении порта NFT-сервера:', error);
  }
  return 8080; // Порт по умолчанию
}

// Проверить доступность NFT-сервера
async function checkNFTServerAvailability() {
  const nftServerPort = getNFTServerPort();
  console.log(`🔍 Проверяем NFT-сервер на порту ${nftServerPort}...`);
  
  try {
    const response = await axios.get(`http://localhost:${nftServerPort}/status`);
    console.log('✅ NFT-сервер доступен:', response.data);
    return nftServerPort;
  } catch (error) {
    console.log('❌ NFT-сервер недоступен, проверяем альтернативный порт...');
    
    try {
      const altPort = nftServerPort === 8080 ? 8081 : 8080;
      const altResponse = await axios.get(`http://localhost:${altPort}/status`);
      console.log(`✅ NFT-сервер доступен на альтернативном порту ${altPort}:`, altResponse.data);
      return altPort;
    } catch (altError) {
      console.error('❌ NFT-сервер недоступен на обоих портах:', altError.message);
      return null;
    }
  }
}

// Получить список изображений Mutant Ape
function getMutantApeImages() {
  console.log('🔍 Получаем список изображений Mutant Ape...');
  
  if (!fs.existsSync(MUTANT_APE_DIR)) {
    console.error(`❌ Директория ${MUTANT_APE_DIR} не существует`);
    return [];
  }
  
  const files = fs.readdirSync(MUTANT_APE_DIR)
    .filter(file => file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.avif'));
  
  console.log(`✅ Найдено ${files.length} изображений Mutant Ape`);
  return files;
}

// Проверить доступность изображений через NFT-сервер
async function checkImagesAvailability(port, files) {
  if (!port || files.length === 0) {
    console.error('❌ Невозможно проверить доступность изображений');
    return;
  }
  
  console.log('🔍 Проверяем доступность изображений через NFT-сервер...');
  
  const sampleSize = Math.min(10, files.length);
  const samples = files.slice(0, sampleSize);
  
  console.log(`🔍 Выборка из ${sampleSize} изображений для проверки:`);
  
  for (let i = 0; i < samples.length; i++) {
    const file = samples[i];
    const imageUrl = `http://localhost:${port}/mutant_ape_nft/${file}`;
    
    try {
      console.log(`   Проверка ${i+1}/${sampleSize}: ${file}`);
      const response = await axios.head(imageUrl);
      
      if (response.status === 200) {
        console.log(`   ✅ [${i+1}/${sampleSize}] Изображение доступно: ${file}`);
      } else {
        console.log(`   ❌ [${i+1}/${sampleSize}] Некорректный ответ от сервера (${response.status}): ${file}`);
      }
    } catch (error) {
      console.error(`   ❌ [${i+1}/${sampleSize}] Ошибка доступа к изображению ${file}:`, error.message);
    }
  }
}

// Проверить API для получения NFT
async function checkNFTAPI() {
  console.log('🔍 Проверяем API для получения NFT...');
  
  try {
    const response = await axios.get('http://localhost:5000/api/nft/collections');
    console.log('✅ API коллекций NFT доступно:', response.data.length, 'коллекций');
    
    // Проверка Mutant Ape коллекции
    const mutantApeCollection = response.data.find(c => 
      c.name.toLowerCase().includes('mutant') && c.name.toLowerCase().includes('ape'));
    
    if (mutantApeCollection) {
      console.log('✅ Найдена коллекция Mutant Ape:', mutantApeCollection.name, `(ID: ${mutantApeCollection.id})`);
      
      // Проверить несколько NFT из этой коллекции
      try {
        const nftResponse = await axios.get(`http://localhost:5000/api/nft/collection/${mutantApeCollection.id}`);
        const nfts = nftResponse.data;
        
        if (nfts && nfts.length > 0) {
          console.log(`✅ Получено ${nfts.length} NFT из коллекции Mutant Ape`);
          
          // Проверить пути к изображениям
          console.log('📊 Анализ путей к изображениям NFT:');
          const imagePaths = {};
          
          nfts.slice(0, 5).forEach((nft, index) => {
            console.log(`   NFT #${index+1}:`, nft.name);
            console.log(`   - ID: ${nft.id}, TokenID: ${nft.token_id}`);
            console.log(`   - Путь к изображению: ${nft.image_url}`);
            
            const pathPrefix = nft.image_url.split('/').slice(0, -1).join('/');
            imagePaths[pathPrefix] = (imagePaths[pathPrefix] || 0) + 1;
          });
          
          console.log('📊 Статистика префиксов путей:');
          Object.entries(imagePaths).forEach(([prefix, count]) => {
            console.log(`   ${prefix}: ${count} NFT`);
          });
        } else {
          console.log('❌ Не удалось получить NFT из коллекции Mutant Ape');
        }
      } catch (nftError) {
        console.error('❌ Ошибка при получении NFT из коллекции Mutant Ape:', nftError.message);
      }
    } else {
      console.log('❌ Коллекция Mutant Ape не найдена');
    }
  } catch (error) {
    console.error('❌ Ошибка при доступе к API NFT:', error.message);
  }
}

// Проверить кэш изображений
function checkImageCache() {
  console.log('🔍 Проверяем кэш изображений...');
  
  if (!fs.existsSync(CACHE_DIR)) {
    console.log('❌ Директория кэша изображений не существует');
    return;
  }
  
  const indexPath = path.join(CACHE_DIR, 'index.json');
  
  if (fs.existsSync(indexPath)) {
    try {
      const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
      console.log('✅ Индекс кэша изображений:');
      console.log(`   Последнее обновление: ${index.lastUpdated}`);
      console.log('   Статистика:');
      console.log(`   - Mutant Ape: ${index.stats.mutantApe} изображений`);
      console.log(`   - Bored Ape: ${index.stats.boredApe} изображений`);
      console.log(`   - Mutant Ape Official: ${index.stats.mutantApeOfficial} изображений`);
    } catch (error) {
      console.error('❌ Ошибка при чтении индекса кэша:', error);
    }
  } else {
    console.log('❌ Индекс кэша изображений не найден');
  }
  
  // Проверка нескольких файлов метаданных
  const cacheFiles = fs.readdirSync(CACHE_DIR)
    .filter(file => file.endsWith('.json') && file !== 'index.json');
  
  if (cacheFiles.length > 0) {
    console.log(`✅ Найдено ${cacheFiles.length} файлов метаданных в кэше`);
    
    const sampleSize = Math.min(5, cacheFiles.length);
    console.log(`🔍 Проверка ${sampleSize} случайных файлов метаданных:`);
    
    // Выбираем случайные файлы для проверки
    const samples = cacheFiles
      .sort(() => 0.5 - Math.random())
      .slice(0, sampleSize);
    
    samples.forEach((file, index) => {
      try {
        const metadata = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, file), 'utf8'));
        console.log(`   ✅ [${index+1}/${sampleSize}] ${file}:`);
        console.log(`      Путь: ${metadata.path}`);
        console.log(`      Тип: ${metadata.type}`);
        console.log(`      Последнее индексирование: ${metadata.lastIndexed}`);
      } catch (error) {
        console.error(`   ❌ [${index+1}/${sampleSize}] Ошибка при чтении ${file}:`, error);
      }
    });
  } else {
    console.log('❌ Файлы метаданных не найдены в кэше');
  }
}

// Главная функция
async function main() {
  console.log('🚀 Запуск проверки отображения Mutant Ape NFT...');
  
  // Проверить NFT-сервер
  const nftServerPort = await checkNFTServerAvailability();
  
  // Получить список изображений
  const mutantApeImages = getMutantApeImages();
  
  // Проверить доступность изображений через NFT-сервер
  await checkImagesAvailability(nftServerPort, mutantApeImages);
  
  // Проверить API для получения NFT
  await checkNFTAPI();
  
  // Проверить кэш изображений
  checkImageCache();
  
  console.log('✅ Проверка завершена');
}

main().catch(console.error);
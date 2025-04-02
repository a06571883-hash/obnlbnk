/**
 * Скрипт для полного переиндексирования кэша изображений
 * и обеспечения правильного отображения Mutant Ape NFT
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import child_process from 'child_process';
import crypto from 'crypto';

// Константы путей
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MUTANT_APE_DIR = path.join(process.cwd(), 'mutant_ape_nft');
const BORED_APE_DIR = path.join(process.cwd(), 'bored_ape_nft');
const MUTANT_APE_OFFICIAL_DIR = path.join(process.cwd(), 'mutant_ape_official');

// Создаем временную директорию для кэша
const CACHE_DIR = path.join(process.cwd(), '.image_cache');

/**
 * Генерирует хэш файла для проверки целостности
 */
function generateFileHash(filePath) {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
  } catch (error) {
    console.error(`❌ Ошибка при генерации хэша для ${filePath}:`, error);
    return '';
  }
}

/**
 * Создает кэш для каждого изображения
 */
function createImageCache() {
  console.log('🔄 Создаем кэш изображений...');
  
  // Создаем директорию кэша, если она не существует
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
  
  // Кэшируем изображения Mutant Ape
  if (fs.existsSync(MUTANT_APE_DIR)) {
    const files = fs.readdirSync(MUTANT_APE_DIR)
      .filter(file => file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.avif'));
    
    console.log(`📊 Найдено ${files.length} изображений Mutant Ape для кэширования`);
    
    // Создаем файлы метаданных для каждого изображения
    files.forEach((file, index) => {
      const filePath = path.join(MUTANT_APE_DIR, file);
      const fileHash = generateFileHash(filePath);
      const stats = fs.statSync(filePath);
      
      // Метаданные каждого изображения
      const metadata = {
        path: `/mutant_ape_nft/${file}`,
        hash: fileHash,
        size: stats.size,
        type: 'mutant',
        lastIndexed: new Date().toISOString()
      };
      
      // Создаем файл метаданных в кэше
      const cacheFileName = file.replace(/\.[^/.]+$/, '') + '.json';
      const cacheFilePath = path.join(CACHE_DIR, cacheFileName);
      
      fs.writeFileSync(cacheFilePath, JSON.stringify(metadata, null, 2));
      
      // Прогресс
      if (index % 50 === 0) {
        console.log(`   🔄 Обработано ${index} из ${files.length} изображений...`);
      }
    });
    
    console.log(`✅ Кэширование Mutant Ape завершено: ${files.length} изображений`);
  }
  
  // Кэшируем изображения Bored Ape
  if (fs.existsSync(BORED_APE_DIR)) {
    const files = fs.readdirSync(BORED_APE_DIR)
      .filter(file => file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.avif'));
    
    console.log(`📊 Найдено ${files.length} изображений Bored Ape для кэширования`);
    
    // Создаем файлы метаданных для каждого изображения (сокращенно)
    console.log(`🔄 Индексирование Bored Ape изображений...`);
    const cacheManifestPath = path.join(CACHE_DIR, 'bored_ape_manifest.json');
    
    // Создаем упрощенный манифест для Bored Ape (без отдельных файлов)
    const manifest = {
      count: files.length,
      type: 'bored',
      lastIndexed: new Date().toISOString(),
      basePath: '/bored_ape_nft/'
    };
    
    fs.writeFileSync(cacheManifestPath, JSON.stringify(manifest, null, 2));
    console.log(`✅ Создан манифест для ${files.length} изображений Bored Ape`);
  }
  
  // Создаем индексный файл кэша
  const indexPath = path.join(CACHE_DIR, 'index.json');
  const index = {
    lastUpdated: new Date().toISOString(),
    stats: {
      mutantApe: fs.existsSync(MUTANT_APE_DIR) ? fs.readdirSync(MUTANT_APE_DIR).filter(f => f.endsWith('.png')).length : 0,
      boredApe: fs.existsSync(BORED_APE_DIR) ? fs.readdirSync(BORED_APE_DIR).filter(f => f.endsWith('.png')).length : 0,
      mutantApeOfficial: fs.existsSync(MUTANT_APE_OFFICIAL_DIR) ? fs.readdirSync(MUTANT_APE_OFFICIAL_DIR).filter(f => f.endsWith('.png')).length : 0
    }
  };
  
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
  console.log('✅ Создан индексный файл кэша');
}

/**
 * Перезапускает сервер для применения изменений
 */
function restartServer() {
  console.log('🔄 Перезапускаем сервер для применения изменений...');
  
  try {
    // Создаем сигнальный файл для перезапуска
    const signalPath = path.join(process.cwd(), '.restart_signal');
    fs.writeFileSync(signalPath, new Date().toISOString());
    console.log('✅ Создан сигнальный файл для перезапуска сервера');
  } catch (error) {
    console.error('❌ Ошибка при создании сигнального файла:', error);
  }
}

/**
 * Очищает временные файлы и кэш браузера
 */
function clearTempFiles() {
  console.log('🧹 Очищаем временные файлы...');
  
  // Список потенциальных директорий кэша
  const tempDirs = [
    path.join(process.cwd(), 'tmp'),
    path.join(process.cwd(), '.cache')
  ];
  
  for (const dir of tempDirs) {
    if (fs.existsSync(dir)) {
      try {
        console.log(`🔍 Проверяем директорию ${dir}...`);
        
        // Удаляем файлы .cache-нотификаций для обхода кэша браузера
        const cacheFiles = [];
        
        function scanDir(directory) {
          const items = fs.readdirSync(directory);
          
          for (const item of items) {
            const itemPath = path.join(directory, item);
            const stats = fs.statSync(itemPath);
            
            if (stats.isDirectory()) {
              scanDir(itemPath);
            } else if (stats.isFile() && item.endsWith('.cache')) {
              cacheFiles.push(itemPath);
            }
          }
        }
        
        scanDir(dir);
        
        if (cacheFiles.length > 0) {
          console.log(`🧹 Удаляем ${cacheFiles.length} файлов кэша из ${dir}...`);
          
          for (const file of cacheFiles) {
            fs.unlinkSync(file);
          }
          
          console.log(`✅ Кэш-файлы удалены из ${dir}`);
        } else {
          console.log(`✅ Кэш-файлы не найдены в ${dir}`);
        }
      } catch (error) {
        console.error(`❌ Ошибка при очистке директории ${dir}:`, error);
      }
    }
  }
}

/**
 * Главная функция
 */
async function main() {
  console.log('🚀 Запускаем полное переиндексирование изображений NFT...');
  
  try {
    // Создаем кэш изображений
    createImageCache();
    
    // Очищаем временные файлы и кэш
    clearTempFiles();
    
    // Перезапускаем сервер
    restartServer();
    
    console.log('✅ Переиндексирование завершено успешно');
  } catch (error) {
    console.error('❌ Ошибка при переиндексировании:', error);
  }
}

// Запускаем скрипт
main().catch(console.error);
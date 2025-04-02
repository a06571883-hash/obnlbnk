/**
 * Простой сервер для обслуживания NFT изображений
 */
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import net from 'node:net';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Создаем Express приложение
const app = express();

// Настройка CORS 
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Базовые пути для NFT изображений
const nftPaths = {
  '/bayc_official': path.join(process.cwd(), 'bayc_official_nft'),
  '/bored_ape_nft': path.join(process.cwd(), 'bored_ape_nft'),
  '/public/assets/nft': path.join(process.cwd(), 'public', 'assets', 'nft'),
  '/assets/nft': path.join(process.cwd(), 'public', 'assets', 'nft'),  // Прямой доступ к assets
  '/mutant_ape_nft': path.join(process.cwd(), 'mutant_ape_nft'),
  '/mutant_ape_official': path.join(process.cwd(), 'mutant_ape_official'),  // Новые официальные Mutant Ape с OpenSea
  '/new_bored_ape_nft': path.join(process.cwd(), 'new_bored_ape_nft'),
  '/new_bored_apes': path.join(process.cwd(), 'new_bored_apes'),
  '/nft_assets': path.join(process.cwd(), 'nft_assets'),
  '/nft_assets/mutant_ape': path.join(process.cwd(), 'nft_assets', 'mutant_ape') // Дополнительный путь для Mutant Ape в nft_assets
};

// Функция для поиска правильных изображений на основе запрашиваемого пути
function findActualImagePath(requestedPath) {
  // Извлекаем имя файла из пути
  const filename = path.basename(requestedPath);
  
  // Проверяем наличие параметров запроса в пути
  let queryParams = {};
  if (requestedPath.includes('?')) {
    const [basePath, queryString] = requestedPath.split('?');
    const params = new URLSearchParams(queryString);
    params.forEach((value, key) => {
      queryParams[key] = value;
    });
    requestedPath = basePath; // Удаляем параметры из пути
  }
  
  const isBoredApe = requestedPath.includes('bored_ape');
  const isMutantApe = requestedPath.includes('mutant_ape');
  
  // Определяем, является ли это официальным Mutant Ape, учитывая параметр collection
  let isOfficialMutantApe = requestedPath.includes('mutant_ape_official');
  
  // Определяем, является ли это Mutant Ape из nft_assets
  const isNftAssetsMutantApe = requestedPath.includes('nft_assets/mutant_ape');
  
  // Если параметр collection указан, он имеет приоритет
  if (queryParams.collection === 'official') {
    isOfficialMutantApe = true;
    console.log(`[NFT Server] Overriding to OFFICIAL Mutant Ape collection via query parameter`);
  } else if (queryParams.collection === 'regular') {
    isOfficialMutantApe = false;
    console.log(`[NFT Server] Overriding to REGULAR Mutant Ape collection via query parameter`);
  }
  
  // Детальное логирование входящего запроса
  console.log(`[NFT Server] Finding image for: ${requestedPath} (filename: ${filename})`);
  console.log(`[NFT Server] isBoredApe: ${isBoredApe}, isMutantApe: ${isMutantApe}, isOfficialMutantApe: ${isOfficialMutantApe}, isNftAssetsMutantApe: ${isNftAssetsMutantApe}, collectionParam: ${queryParams.collection || 'none'}`);
  
  // Корневая директория для поиска изображения
  let searchDir;
  
  if (isBoredApe) {
    searchDir = path.join(process.cwd(), 'bored_ape_nft');
    // Получаем номер обезьяны из запрашиваемого пути
    const match = filename.match(/bored_ape_(\d+)\.png/);
    if (match && match[1]) {
      const number = parseInt(match[1]);
      
      // Ищем подходящее по номеру изображение
      const exactPath = path.join(searchDir, `bored_ape_${number}.png`);
      
      // Сначала пробуем найти точное соответствие
      if (fs.existsSync(exactPath)) {
        return exactPath;
      }
      
      // Если точное соответствие не найдено, используем число по модулю из нашего доступного пула
      // Используем остаток от деления на количество доступных файлов в общем пуле
      if (realNFTImages.boredApe.files.length > 0) {
        const index = number % realNFTImages.boredApe.files.length;
        return realNFTImages.boredApe.files[index];
      }
    }
  } else if (isMutantApe || isNftAssetsMutantApe) {
    // Проверяем, является ли это запросом к официальной коллекции
    const isOfficialCollection = requestedPath.includes('mutant_ape_official');
    
    // Проверяем, является ли это запросом к nft_assets/mutant_ape
    const isNftAssetsPath = requestedPath.includes('nft_assets/mutant_ape');
    
    // Если запрос идет к nft_assets/mutant_ape, проверяем эту директорию первой
    if (isNftAssetsPath) {
      // Используем путь к директории nft_assets/mutant_ape
      searchDir = path.join(process.cwd(), 'nft_assets', 'mutant_ape');
      console.log(`[NFT Server] This is NFT_ASSETS Mutant Ape request for ${requestedPath}`);
      
      // Ищем точное совпадение
      const exactPath = path.join(searchDir, filename);
      console.log(`[NFT Server] Checking nft_assets mutant ape path for ${filename}: ${exactPath}`);
      
      if (fs.existsSync(exactPath)) {
        console.log(`[NFT Server] Found nft_assets mutant ape image: ${exactPath}`);
        return exactPath;
      }
      
      // Если не нашли, продолжим поиск в других директориях
    } else if (isOfficialCollection) {
      // Используем путь к официальной коллекции
      searchDir = path.join(process.cwd(), 'mutant_ape_official');
      console.log(`[NFT Server] This is OFFICIAL Mutant Ape request for ${requestedPath}`);
      
      // Если это официальная коллекция, сначала ищем точное совпадение в ней
      const exactPath = path.join(searchDir, filename);
      console.log(`[NFT Server] Checking official Mutant Ape path for ${filename}: ${exactPath}`);
      
      if (fs.existsSync(exactPath)) {
        console.log(`[NFT Server] Found official Mutant Ape image: ${exactPath}`);
        return exactPath;
      }
      
      // Если не нашли файл в официальной директории, проверяем файлы в пуле официальных
      if (realNFTImages.mutantApeOfficial.files.length > 0) {
        // Извлекаем номер из имени файла
        const match = filename.match(/mutant_ape_(\d+)\.png/);
        if (match && match[1]) {
          const number = parseInt(match[1]);
          const index = number % realNFTImages.mutantApeOfficial.files.length;
          console.log(`[NFT Server] Using official Mutant Ape pool for ${filename}: ${realNFTImages.mutantApeOfficial.files[index]}`);
          return realNFTImages.mutantApeOfficial.files[index];
        }
      }
      
      // Никогда не используем изображения из обычного пула для официальных запросов
      console.log(`[NFT Server] No matching official Mutant Ape images found for ${filename}`);
      return null;
    } else {
      // Если это не официальная коллекция, используем основную директорию Mutant Ape
      searchDir = path.join(process.cwd(), 'mutant_ape_nft');
      console.log(`[NFT Server] This is REGULAR Mutant Ape request for ${requestedPath}`);
    }
    
    // Получаем номер обезьяны из запрашиваемого пути
    const match = filename.match(/mutant_ape_(\d+)\.png/);
    if (match && match[1]) {
      const number = parseInt(match[1]);
      
      // Сначала пробуем найти точное соответствие по имени PNG файла
      const exactPath = path.join(searchDir, `mutant_ape_${number}.png`);
      console.log(`[NFT Server] Checking exact path for ${filename}: ${exactPath}`);
      
      if (fs.existsSync(exactPath)) {
        console.log(`[NFT Server] Direct match found for ${filename}: ${exactPath}`);
        return exactPath;
      }
      
      // Для обычной коллекции Mutant Ape (не официальной)
      if (!isOfficialCollection) {
        // Получаем список всех PNG файлов в директории и используем номер по модулю
        try {
          const pngFiles = fs.readdirSync(searchDir)
            .filter(file => file.endsWith('.png') && file.includes('mutant_ape_'))
            .map(file => path.join(searchDir, file));
            
          if (pngFiles.length > 0) {
            const index = number % pngFiles.length;
            const selectedFile = pngFiles[index];
            console.log(`[NFT Server] Using modulo mapping for ${filename}: ${selectedFile} (index ${index} of ${pngFiles.length})`);
            return selectedFile;
          }
        } catch (err) {
          console.error(`[NFT Server] Error reading mutant_ape_nft directory:`, err);
        }
        
        // Используем только пул обычных Mutant Ape для обычной коллекции
        if (realNFTImages.mutantApe.files.length > 0) {
          const index = number % realNFTImages.mutantApe.files.length;
          console.log(`[NFT Server] Using Mutant Ape pool for ${filename}: ${realNFTImages.mutantApe.files[index]}`);
          return realNFTImages.mutantApe.files[index];
        }
      }
      
      // Если нет файлов в пуле Mutant Ape, используем общий пул
      if (realNFTImages.common.files.length > 0) {
        const index = number % realNFTImages.common.files.length;
        console.log(`[NFT Server] Using common pool for ${filename}: ${realNFTImages.common.files[index]}`);
        return realNFTImages.common.files[index];
      }
    }
  }
  
  // Если не нашли соответствия, возвращаем null
  console.log(`[NFT Server] No matching image found for ${requestedPath}`);
  return null;
}

// Реальные изображения для замены отсутствующих
const realNFTImages = {
  boredApe: {
    dir: path.join(process.cwd(), 'bored_ape_nft'),
    files: []
  },
  mutantApe: {
    dir: path.join(process.cwd(), 'mutant_ape_nft'),
    files: []
  },
  mutantApeOfficial: {
    dir: path.join(process.cwd(), 'mutant_ape_official'),
    files: []
  },
  common: {
    dir: path.join(process.cwd(), 'public', 'assets', 'nft', 'real'),
    files: []
  }
};

// Дополнительная структура для nft_assets/mutant_ape
realNFTImages.nftAssetsMutantApe = {
  dir: path.join(process.cwd(), 'nft_assets', 'mutant_ape'),
  files: []
};

// Загружаем списки реальных изображений
function loadRealImages() {
  try {
    // Загружаем изображения Bored Ape из директории
    const boredApeDir = path.join(process.cwd(), 'bored_ape_nft');
    if (fs.existsSync(boredApeDir)) {
      const files = fs.readdirSync(boredApeDir)
        .filter(file => (file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.avif')) && 
                         !file.endsWith('.svg') && 
                         (file.includes('bored_ape_') || !file.includes('mutant_ape_')));
      
      // Только реальные изображения, не SVG
      const realFiles = [];
      for (const file of files) {
        const fullPath = path.join(boredApeDir, file);
        try {
          const stats = fs.statSync(fullPath);
          // Изображение должно быть больше 1KB, чтобы исключить SVG-плейсхолдеры
          if (stats.size > 1024) {
            realFiles.push(fullPath);
          }
        } catch (err) {
          // Пропускаем в случае ошибки
          console.error(`[NFT Server] Error checking file ${fullPath}:`, err);
        }
      }
      
      realNFTImages.boredApe.files = realFiles;
      console.log(`[NFT Server] Loaded ${realNFTImages.boredApe.files.length} Bored Ape images`);
    }
    
    // Загружаем изображения Mutant Ape из директории
    const mutantApeDir = path.join(process.cwd(), 'mutant_ape_nft');
    if (fs.existsSync(mutantApeDir)) {
      // Принудительно удаляем любые SVG файлы, если они остались
      try {
        const svgFiles = fs.readdirSync(mutantApeDir)
          .filter(file => file.endsWith('.svg'));
        
        if (svgFiles.length > 0) {
          console.log(`[NFT Server] Found ${svgFiles.length} SVG files to remove`);
          for (const svgFile of svgFiles) {
            try {
              const svgPath = path.join(mutantApeDir, svgFile);
              fs.unlinkSync(svgPath);
              console.log(`[NFT Server] Removed SVG file: ${svgFile}`);
            } catch (err) {
              console.error(`[NFT Server] Error removing SVG file: ${svgFile}`, err);
            }
          }
        }
      } catch (err) {
        console.error(`[NFT Server] Error while cleaning SVG files:`, err);
      }
      
      // Список всех PNG файлов без дополнительных проверок
      const files = fs.readdirSync(mutantApeDir)
        .filter(file => file.endsWith('.png') && file.includes('mutant_ape_'));
      
      console.log(`[NFT Server] Found ${files.length} Mutant Ape PNG images`);
      
      // Добавляем все PNG файлы напрямую
      const realFiles = files.map(file => path.join(mutantApeDir, file));
      
      realNFTImages.mutantApe.files = realFiles;
      console.log(`[NFT Server] Loaded ${realNFTImages.mutantApe.files.length} Mutant Ape images`);
    }
    
    // Загружаем ОФИЦИАЛЬНЫЕ изображения Mutant Ape из директории
    const mutantApeOfficialDir = path.join(process.cwd(), 'mutant_ape_official');
    if (fs.existsSync(mutantApeOfficialDir)) {
      // Список всех PNG файлов
      let files = [];
      try {
        files = fs.readdirSync(mutantApeOfficialDir)
          .filter(file => file.endsWith('.png') && file.includes('mutant_ape_'));
          
        console.log(`[NFT Server] Found ${files.length} Official Mutant Ape PNG images`);
        
        // Добавляем все PNG файлы напрямую
        const realFiles = files.map(file => path.join(mutantApeOfficialDir, file));
        
        realNFTImages.mutantApeOfficial.files = realFiles;
        console.log(`[NFT Server] Loaded ${realNFTImages.mutantApeOfficial.files.length} Official Mutant Ape images`);
        
        // НЕ добавляем официальные изображения в общий пул Mutant Ape
        // Каждая коллекция должна использовать только свои изображения
        console.log(`[NFT Server] Keeping official Mutant Apes separate from regular collection: ${realNFTImages.mutantApeOfficial.files.length} official / ${realNFTImages.mutantApe.files.length} regular`);
      } catch (err) {
        console.error(`[NFT Server] Error loading Official Mutant Ape images:`, err);
      }
    }
    
    // Загружаем общие изображения из директории public/assets/nft/real
    const commonDir = path.join(process.cwd(), 'public', 'assets', 'nft', 'real');
    if (fs.existsSync(commonDir)) {
      const files = fs.readdirSync(commonDir)
        .filter(file => (file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.avif')) && 
                         !file.endsWith('.svg'));
      
      // Только реальные изображения, не SVG
      const realFiles = [];
      for (const file of files) {
        const fullPath = path.join(commonDir, file);
        try {
          const stats = fs.statSync(fullPath);
          // Изображение должно быть больше 1KB, чтобы исключить SVG-плейсхолдеры
          if (stats.size > 1024) {
            realFiles.push(fullPath);
          }
        } catch (err) {
          // Пропускаем в случае ошибки
          console.error(`[NFT Server] Error checking file ${fullPath}:`, err);
        }
      }
      
      realNFTImages.common.files = realFiles;
      console.log(`[NFT Server] Loaded ${realNFTImages.common.files.length} common NFT images`);
    }
    
    // Дополнительно загружаем изображения из распакованного архива
    const tempExtractDir = path.join(process.cwd(), 'temp_extract');
    if (fs.existsSync(tempExtractDir)) {
      const files = fs.readdirSync(tempExtractDir)
        .filter(file => (file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.avif')) && 
                         !file.endsWith('.svg'));
      
      // Только реальные изображения, не SVG
      const realFiles = [];
      for (const file of files) {
        const fullPath = path.join(tempExtractDir, file);
        try {
          const stats = fs.statSync(fullPath);
          // Изображение должно быть больше 1KB, чтобы исключить SVG-плейсхолдеры
          if (stats.size > 1024) {
            realFiles.push(fullPath);
          }
        } catch (err) {
          // Пропускаем в случае ошибки
          console.error(`[NFT Server] Error checking file ${fullPath}:`, err);
        }
      }
      
      // Добавляем в пул общих изображений
      realNFTImages.common.files = [...realNFTImages.common.files, ...realFiles];
      console.log(`[NFT Server] Added ${realFiles.length} images from temp_extract directory`);
    }
    
    // Загружаем изображения из nft_assets/mutant_ape
    const nftAssetsMutantApeDir = path.join(process.cwd(), 'nft_assets', 'mutant_ape');
    if (fs.existsSync(nftAssetsMutantApeDir)) {
      try {
        const files = fs.readdirSync(nftAssetsMutantApeDir)
          .filter(file => (file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.avif')) && 
                           file.includes('mutant_ape_'));
        
        console.log(`[NFT Server] Found ${files.length} NFT assets Mutant Ape images`);
        
        // Добавляем все файлы напрямую
        const realFiles = files.map(file => path.join(nftAssetsMutantApeDir, file));
        
        realNFTImages.nftAssetsMutantApe.files = realFiles;
        console.log(`[NFT Server] Loaded ${realNFTImages.nftAssetsMutantApe.files.length} NFT assets Mutant Ape images`);
      } catch (err) {
        console.error(`[NFT Server] Error loading NFT assets Mutant Ape images:`, err);
      }
    }
    
    // Если нет изображений BAYC или Mutant Ape, используем общий пул
    if (realNFTImages.boredApe.files.length === 0 && realNFTImages.common.files.length > 0) {
      realNFTImages.boredApe.files = [...realNFTImages.common.files];
      console.log(`[NFT Server] No Bored Ape images found, using ${realNFTImages.boredApe.files.length} common images as fallback`);
    }
    
    if (realNFTImages.mutantApe.files.length === 0 && realNFTImages.common.files.length > 0) {
      realNFTImages.mutantApe.files = [...realNFTImages.common.files];
      console.log(`[NFT Server] No Mutant Ape images found, using ${realNFTImages.mutantApe.files.length} common images as fallback`);
    }
    
    // Проверяем, есть ли изображения в директории nft_assets/mutant_ape
    if (realNFTImages.nftAssetsMutantApe.files.length === 0) {
      // Если нет, используем обычные изображения Mutant Ape
      if (realNFTImages.mutantApe.files.length > 0) {
        realNFTImages.nftAssetsMutantApe.files = [...realNFTImages.mutantApe.files];
        console.log(`[NFT Server] No NFT assets Mutant Ape images found, using ${realNFTImages.nftAssetsMutantApe.files.length} regular Mutant Ape images as fallback`);
      } else if (realNFTImages.common.files.length > 0) {
        // Или общий пул, если нет обычных Mutant Ape
        realNFTImages.nftAssetsMutantApe.files = [...realNFTImages.common.files];
        console.log(`[NFT Server] No NFT assets or regular Mutant Ape images found, using ${realNFTImages.nftAssetsMutantApe.files.length} common images as fallback`);
      }
    }
    
  } catch (error) {
    console.error('[NFT Server] Error loading real images:', error);
  }
}

// Загружаем изображения при запуске
loadRealImages();

// Функция для определения типа файла по имени
function getContentType(filePath) {
  if (filePath.endsWith('.png')) {
    return 'image/png';
  } else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
    return 'image/jpeg';
  } else if (filePath.endsWith('.avif')) {
    return 'image/avif';
  } else if (filePath.endsWith('.svg')) {
    return 'image/svg+xml';
  } else if (filePath.endsWith('.gif')) {
    return 'image/gif';
  }
  return 'application/octet-stream';
}

// Функция для отправки реального случайного изображения вместо отсутствующего
function sendRealNftImage(res, type, originalPath) {
  // Извлекаем параметр collection из URL, если он существует
  let collectionParam = '';
  if (originalPath.includes('?')) {
    const queryString = originalPath.split('?')[1];
    const params = new URLSearchParams(queryString);
    collectionParam = params.get('collection') || '';
    console.log(`[MUTANT DEBUG] Извлечен параметр collection=${collectionParam} из пути ${originalPath}`);
  }
  
  // Принудительно указываем тип для Mutant Ape в зависимости от параметра collection
  if (collectionParam === 'official' && (type.includes('mutant') || originalPath.includes('mutant'))) {
    type = 'mutant_ape_official';
    console.log(`[MUTANT DEBUG] Принудительно устанавливаем тип ${type} из-за параметра collection=official`);
  } else if ((collectionParam === 'regular' || collectionParam === 'mutant') && (type.includes('mutant') || originalPath.includes('mutant'))) {
    type = 'mutant_ape';
    console.log(`[MUTANT DEBUG] Принудительно устанавливаем тип ${type} из-за параметра collection=${collectionParam}`);
  }
  
  // Определяем, относится ли запрос к официальным Mutant Ape,
  // учитывая как тип пути, так и параметр collection
  let isOfficialMutantApe = originalPath.includes('mutant_ape_official') || type === 'mutant_ape_official';
  
  // Если параметр collection указан, он имеет приоритет
  if (collectionParam === 'official') {
    isOfficialMutantApe = true;
    console.log(`[MUTANT DEBUG] Приоритет отдан коллекции 'official' из параметра`);
  } else if (collectionParam === 'regular' || collectionParam === 'mutant') {
    isOfficialMutantApe = false;
    console.log(`[MUTANT DEBUG] Приоритет отдан коллекции '${collectionParam}' из параметра`);
  }
  
  // Добавляем расширенное логирование
  console.log(`[MUTANT DEBUG] sendRealNftImage: тип=${type}, путь=${originalPath}, коллекция=${collectionParam}, isOfficialMutantApe=${isOfficialMutantApe}`);
  
  // Выбираем соответствующую коллекцию изображений
  let collection;
  
  if (isOfficialMutantApe) {
    // Для официальных Mutant Ape используем ТОЛЬКО пул официальных изображений
    collection = realNFTImages.mutantApeOfficial;
    console.log(`[NFT Server] Using official Mutant Ape pool for ${originalPath} (${collection.files.length} images)`);
    
    // Вывести первые 3 элемента пула для отладки
    if (collection.files.length > 0) {
      const sampleFiles = collection.files.slice(0, 3);
      console.log(`[MUTANT DEBUG] Примеры официальных Mutant Ape изображений:`);
      sampleFiles.forEach((file, index) => {
        console.log(`[MUTANT DEBUG] ${index + 1}. ${path.basename(file)}`);
      });
    }
    
    // Если нет официальных изображений, выбираем изображение из обычного пула Mutant Ape
    if (collection.files.length === 0) {
      collection = realNFTImages.mutantApe;
      console.log(`[NFT Server] No official images found, using regular Mutant Ape pool as fallback (${collection.files.length} images)`);
    }
  } else if (type === 'bored_ape') {
    collection = realNFTImages.boredApe;
  } else if (type === 'mutant_ape') {
    // Для обычных Mutant Ape используем ТОЛЬКО основной пул Mutant Ape (НЕ официальный)
    collection = realNFTImages.mutantApe;
    console.log(`[NFT Server] Using regular Mutant Ape pool for ${originalPath} (${collection.files.length} images)`);
    
    // Вывести первые 3 элемента пула для отладки
    if (collection.files.length > 0) {
      const sampleFiles = collection.files.slice(0, 3);
      console.log(`[MUTANT DEBUG] Примеры обычных Mutant Ape изображений:`);
      sampleFiles.forEach((file, index) => {
        console.log(`[MUTANT DEBUG] ${index + 1}. ${path.basename(file)}`);
      });
    }
  } else {
    collection = realNFTImages.common;
  }
  
  // Если в выбранной коллекции есть изображения
  if (collection.files.length > 0) {
    // Выбираем случайное изображение из коллекции
    const randomIndex = Math.floor(Math.random() * collection.files.length);
    const realImagePath = collection.files[randomIndex];
    
    if (fs.existsSync(realImagePath)) {
      const contentType = getContentType(realImagePath);
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400'); // кеширование на 1 день
      fs.createReadStream(realImagePath).pipe(res);
      console.log(`[NFT Server] Sending real NFT image for ${originalPath}: ${realImagePath}`);
      return;
    }
  }
  
  // Если коллекция пуста, пробуем другие источники в порядке приоритета
  
  // Пытаемся извлечь номер обезьяны из запрашиваемого пути
  let specificApeNumber = null;
  const match = originalPath.match(/mutant_ape_(\d+)\.png$/);
  if (match && match[1]) {
    specificApeNumber = parseInt(match[1]);
    console.log(`[MUTANT DEBUG] Извлечен номер обезьяны из пути: ${specificApeNumber}`);
    
    // Для каждого пула выбираем изображение с наиболее похожим номером
    // чтобы одна и та же обезьяна всегда получала одно и то же изображение
    if (isOfficialMutantApe && realNFTImages.mutantApeOfficial.files.length > 0) {
      const targetIndex = specificApeNumber % realNFTImages.mutantApeOfficial.files.length;
      const targetPath = realNFTImages.mutantApeOfficial.files[targetIndex];
      
      console.log(`[MUTANT DEBUG] Для официальной обезьяны #${specificApeNumber} выбрано изображение #${targetIndex}: ${targetPath}`);
      
      if (fs.existsSync(targetPath)) {
        const contentType = getContentType(targetPath);
        // Устанавливаем заголовок отключения кеширования
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        fs.createReadStream(targetPath).pipe(res);
        console.log(`[NFT Server] Отправляем консистентное изображение Official Mutant Ape ${specificApeNumber}: ${targetPath}`);
        return;
      }
    } else if (!isOfficialMutantApe && realNFTImages.mutantApe.files.length > 0) {
      const targetIndex = specificApeNumber % realNFTImages.mutantApe.files.length;
      const targetPath = realNFTImages.mutantApe.files[targetIndex];
      
      console.log(`[MUTANT DEBUG] Для обычной обезьяны #${specificApeNumber} выбрано изображение #${targetIndex}: ${targetPath}`);
      
      if (fs.existsSync(targetPath)) {
        const contentType = getContentType(targetPath);
        // Устанавливаем заголовок отключения кеширования
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        fs.createReadStream(targetPath).pipe(res);
        console.log(`[NFT Server] Отправляем консистентное изображение Regular Mutant Ape ${specificApeNumber}: ${targetPath}`);
        return;
      }
    }
  }
  
  // Сначала проверяем мутантов (если они не были выбраны изначально)
  if (!isOfficialMutantApe && type !== 'mutant_ape' && realNFTImages.mutantApe.files.length > 0) {
    const randomIndex = Math.floor(Math.random() * realNFTImages.mutantApe.files.length);
    const mutantImagePath = realNFTImages.mutantApe.files[randomIndex];
    
    if (fs.existsSync(mutantImagePath)) {
      const contentType = getContentType(mutantImagePath);
      // Устанавливаем заголовок отключения кеширования
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      fs.createReadStream(mutantImagePath).pipe(res);
      console.log(`[NFT Server] Sending mutant ape image as fallback for ${originalPath}: ${mutantImagePath}`);
      return;
    }
  }
  
  // Если нет специальных изображений или они не существуют, используем изображения из общего пула
  if (realNFTImages.common.files.length > 0) {
    const randomIndex = Math.floor(Math.random() * realNFTImages.common.files.length);
    const commonImagePath = realNFTImages.common.files[randomIndex];
    
    if (fs.existsSync(commonImagePath)) {
      const contentType = getContentType(commonImagePath);
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400'); // кеширование на 1 день
      fs.createReadStream(commonImagePath).pipe(res);
      console.log(`[NFT Server] Sending common NFT image for ${originalPath}: ${commonImagePath}`);
      return;
    }
  }
  
  console.error(`[NFT Server] No real images available for ${originalPath}`);
  res.status(404).send('Not Found');
}

// Настраиваем статические маршруты для каждой директории с NFT
Object.keys(nftPaths).forEach(route => {
  const directoryPath = nftPaths[route];
  
  console.log(`Configuring NFT image route: ${route} -> ${directoryPath}`);
  
  // Обработчик для каждого маршрута вместо простого express.static
  app.get(`${route}/:filename`, (req, res) => {
    const filename = req.params.filename;
    const requestPath = `${route}/${filename}`;
    const fullPath = path.join(directoryPath, filename);
    
    console.log(`[NFT Image Server] [DEBUG] Request for NFT image: ${route}/${filename} -> ${fullPath}`);
    
    // Проверяем параметр collection для определения типа коллекции
    const collectionType = req.query.collection || '';
    
    // Добавляем расширенное логирование для Mutant Ape коллекций
    if (route.includes('mutant_ape')) {
      // Определяем тип коллекции на основе маршрута и параметра collection
      let isMutantOfficial = route.includes('mutant_ape_official');
      
      // Если параметр collection указан, он имеет приоритет
      if (collectionType === 'official') {
        isMutantOfficial = true;
        console.log(`[MUTANT DEBUG] Коллекция переопределена через параметр query: official`);
      } else if (collectionType === 'regular') {
        isMutantOfficial = false;
        console.log(`[MUTANT DEBUG] Коллекция переопределена через параметр query: regular`);
      }
      
      console.log(`[MUTANT DEBUG] Запрос ${isMutantOfficial ? 'ОФИЦИАЛЬНОГО' : 'ОБЫЧНОГО'} Mutant Ape: ${filename}, collectionType=${collectionType}`);
      
      // Проверяем наличие РЕАЛЬНОГО файла в соответствующей директории
      if (fs.existsSync(fullPath)) {
        console.log(`[MUTANT DEBUG] ФАЙЛ СУЩЕСТВУЕТ: ${fullPath}`);
      } else {
        console.log(`[MUTANT DEBUG] ФАЙЛ НЕ СУЩЕСТВУЕТ: ${fullPath}`);
        
        // Проверяем, сколько у нас изображений в соответствующей коллекции
        const collectionImages = isMutantOfficial 
          ? realNFTImages.mutantApeOfficial.files 
          : realNFTImages.mutantApe.files;
        
        console.log(`[MUTANT DEBUG] Доступно изображений в коллекции ${isMutantOfficial ? 'OFFICIAL' : 'REGULAR'}: ${collectionImages.length}`);
        
        // Выводим путь к первым 3 доступным изображениям коллекции для отладки
        if (collectionImages.length > 0) {
          const sampleFiles = collectionImages.slice(0, 3);
          sampleFiles.forEach((file, index) => {
            console.log(`[MUTANT DEBUG] Пример файла #${index+1}: ${path.basename(file)} (${file})`);
          });
        }
      }
    }
    
    // Пробуем найти правильное изображение
    const actualImagePath = findActualImagePath(requestPath);
    if (actualImagePath && fs.existsSync(actualImagePath)) {
      console.log(`[NFT Server] Found mapping for ${requestPath} -> ${actualImagePath}`);
      
      // Дополнительное логирование для Mutant Ape
      if (route.includes('mutant_ape')) {
        console.log(`[MUTANT DEBUG] УСПЕШНОЕ СОПОСТАВЛЕНИЕ для ${requestPath} -> ${actualImagePath}`);
        
        // Проверяем, совпадают ли коллекции (официальная / обычная)
        if (route.includes('mutant_ape_official') && !actualImagePath.includes('mutant_ape_official')) {
          console.log(`[MUTANT DEBUG] ВНИМАНИЕ! Запрошен официальный Mutant Ape, но найден обычный: ${actualImagePath}`);
        }
        if (!route.includes('mutant_ape_official') && actualImagePath.includes('mutant_ape_official')) {
          console.log(`[MUTANT DEBUG] ВНИМАНИЕ! Запрошен обычный Mutant Ape, но найден официальный: ${actualImagePath}`);
        }
      }
      
      const contentType = getContentType(actualImagePath);
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400'); // кеширование на 1 день
      fs.createReadStream(actualImagePath).pipe(res);
      return;
    }
    
    // Проверяем существование файла
    if (fs.existsSync(fullPath)) {
      // Файл существует, отправляем его с правильным Content-Type
      const contentType = getContentType(fullPath);
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400'); // кеширование на 1 день
      fs.createReadStream(fullPath).pipe(res);
    } else {
      // Файл не существует, определяем тип запасного изображения
      let fallbackType = 'common';
      
      if (route.includes('bored_ape') || route.includes('bayc')) {
        fallbackType = 'bored_ape';
      } else if (route.includes('mutant_ape')) {
        // Специфицируем тип для Mutant Ape с учетом официальной/неофициальной коллекции
        fallbackType = route.includes('mutant_ape_official') ? 'mutant_ape_official' : 'mutant_ape';
        console.log(`[MUTANT DEBUG] Используем запасной тип для отсутствующего изображения: ${fallbackType}`);
        
        // Проверяем наличие параметра collection в запросе
        const reqUrl = req.url || '';
        if (reqUrl.includes('collection=')) {
          const param = reqUrl.includes('collection=official') ? 'official' : 
                        reqUrl.includes('collection=regular') ? 'regular' : 
                        reqUrl.includes('collection=mutant') ? 'mutant' : '';
          
          if (param === 'official') {
            fallbackType = 'mutant_ape_official';
            console.log(`[MUTANT DEBUG] Переопределяем тип на official из параметра URL: ${reqUrl}`);
          } else if (param === 'regular' || param === 'mutant') {
            fallbackType = 'mutant_ape';
            console.log(`[MUTANT DEBUG] Переопределяем тип на ${param} из параметра URL: ${reqUrl}`);
          }
        }
      }
      
      // Отправляем реальное изображение вместо отсутствующего
      sendRealNftImage(res, fallbackType, `${route}/${filename}`);
    }
  });
  
  // Дополнительный обработчик для вложенных путей (для fallback директории)
  if (route.includes('assets/nft') || route.includes('public/assets/nft')) {
    app.get(`${route}/:subdir/:filename`, (req, res) => {
      const { subdir, filename } = req.params;
      const fullPath = path.join(directoryPath, subdir, filename);
      
      console.log(`[NFT Image Server] [DEBUG] Request for nested NFT image: ${route}/${subdir}/${filename} -> ${fullPath}`);
      
      // Проверяем существование файла
      if (fs.existsSync(fullPath)) {
        // Файл существует, отправляем его с правильным Content-Type
        const contentType = getContentType(fullPath);
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=86400'); // кеширование на 1 день
        fs.createReadStream(fullPath).pipe(res);
      } else {
        // Отправляем 404 для файлов в поддиректориях, не используя запасные изображения
        console.log(`[NFT Server] Nested file not found: ${fullPath}`);
        res.status(404).send('Not Found');
      }
    });
  }
});

// Добавляем специальный обработчик для API проверки изображений
app.get('/image-check', (req, res) => {
  const { path: imagePath } = req.query;
  
  if (!imagePath) {
    return res.status(400).json({
      success: false,
      message: 'Не указан путь к изображению'
    });
  }
  
  // Убираем начальный слэш если есть
  const cleanPath = imagePath.toString().startsWith('/') 
    ? imagePath.toString().substring(1) 
    : imagePath.toString();
  
  // Получаем базовый путь и имя файла
  const basePath = cleanPath.split('/').slice(0, -1).join('/');
  const filename = cleanPath.split('/').pop();
  
  console.log(`[Image Check] Checking existence of: ${cleanPath}`);
  console.log(`[Image Check] Base path: ${basePath}, Filename: ${filename}`);
  
  // Проверяем все возможные директории
  let found = false;
  let foundPath = null;
  
  // Сначала ищем точное соответствие
  for (const [route, dirPath] of Object.entries(nftPaths)) {
    const routeNoSlash = route.startsWith('/') ? route.substring(1) : route;
    
    if (cleanPath.startsWith(routeNoSlash)) {
      // Находим относительный путь в пределах директории
      const relativePath = cleanPath.substring(routeNoSlash.length);
      const absolutePath = path.join(dirPath, relativePath);
      
      console.log(`[Image Check] Checking in ${dirPath}: ${absolutePath}`);
      
      if (fs.existsSync(absolutePath)) {
        found = true;
        foundPath = absolutePath;
        break;
      }
    }
  }
  
  // Если изображение не найдено но содержит mutant_ape, ищем альтернативу
  if (!found && cleanPath.includes('mutant_ape')) {
    // Сначала проверяем официальные изображения Mutant Ape
    const officialMutantDir = nftPaths['/mutant_ape_official'];
    
    if (fs.existsSync(officialMutantDir)) {
      try {
        const officialFiles = fs.readdirSync(officialMutantDir)
          .filter(file => file.endsWith('.png') && file.includes('mutant_ape_'));
        
        if (officialFiles.length > 0) {
          // Берем первое изображение из списка официальных для примера
          foundPath = path.join(officialMutantDir, officialFiles[0]);
          console.log(`[Image Check] Using official mutant ape image: ${foundPath}`);
          found = true;
        }
      } catch (err) {
        console.error(`[Image Check] Error reading official Mutant Ape directory:`, err);
      }
    }
    
    // Если официальных нет, используем обычные
    if (!found) {
      const mutantDir = nftPaths['/mutant_ape_nft'];
      
      try {
        const files = fs.readdirSync(mutantDir)
          .filter(file => file.endsWith('.png') && file.includes('mutant_ape_'));
        
        if (files.length > 0) {
          // Берем первое изображение из списка для примера
          foundPath = path.join(mutantDir, files[0]);
          console.log(`[Image Check] Using alternative mutant ape image: ${foundPath}`);
          found = true;
        }
      } catch (err) {
        console.error(`[Image Check] Error reading Mutant Ape directory:`, err);
      }
    }
  }
  
  res.json({
    success: true,
    exists: found,
    originalPath: imagePath,
    cleanPath,
    foundPath,
    suggestion: found ? null : 'Изображение не найдено. Попробуйте использовать /mutant_ape_official/mutant_ape_0001.png или /mutant_ape_nft/mutant_ape_0048.png'
  });
});

// Общий обработчик для всех остальных маршрутов
app.get('*', (req, res) => {
  console.log(`[NFT Server] 404 Not Found: ${req.url}`);
  res.status(404).send('Not Found');
});

// Дополнительное логирование для статистики изображений перед запуском сервера
console.log('==== NFT ИЗОБРАЖЕНИЯ СТАТИСТИКА ====');
console.log(`Bored Ape: ${realNFTImages.boredApe.files.length} изображений`);
console.log(`Mutant Ape (обычная коллекция): ${realNFTImages.mutantApe.files.length} изображений`);
console.log(`Mutant Ape (официальная коллекция): ${realNFTImages.mutantApeOfficial.files.length} изображений`);
console.log(`Общий пул: ${realNFTImages.common.files.length} изображений`);

// Если есть официальные Mutant Ape, выводим подробнее о первых 5 изображениях
if (realNFTImages.mutantApeOfficial.files.length > 0) {
  console.log('\n==== ОФИЦИАЛЬНЫЕ MUTANT APE (первые 5) ====');
  const sampleFiles = realNFTImages.mutantApeOfficial.files.slice(0, 5);
  sampleFiles.forEach((file, index) => {
    const filename = path.basename(file);
    console.log(`${index + 1}. ${filename} (${file})`);
  });
}

// Функция для проверки доступности порта
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`[NFT Image Server] Port ${port} is already in use, checking another port`);
        resolve(false);
      } else {
        console.error(`[NFT Image Server] Error checking port ${port}:`, err);
        resolve(false);
      }
    });
    
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    
    server.listen(port, '0.0.0.0');
  });
}

// Асинхронная функция для запуска сервера на свободном порту
async function startServer() {
  let PORT = 8080; // Начинаем с порта 8080
  const MAX_PORT = 8090; // Максимальный порт для проверки
  
  // Проверяем порты до тех пор, пока не найдем свободный
  while (PORT <= MAX_PORT) {
    if (await isPortAvailable(PORT)) {
      // Найден свободный порт, запускаем сервер
      app.listen(PORT, '0.0.0.0', () => {
        console.log(`NFT image server running on port ${PORT} (0.0.0.0)`);
        console.log(`Server address: http://0.0.0.0:${PORT}`);
        console.log(`Configured paths:`);
        for (const [route, path] of Object.entries(nftPaths)) {
          console.log(`  ${route} -> ${path}`);
        }
        
        // Экспортируем текущий порт для возможности использования в других частях приложения
        global.nftServerPort = PORT;
        
        // Создаем файл с информацией о порте для других процессов
        try {
          fs.writeFileSync(path.join(process.cwd(), 'nft-server-port.txt'), PORT.toString());
          console.log(`[NFT Image Server] Port information saved to nft-server-port.txt: ${PORT}`);
        } catch (err) {
          console.error('[NFT Image Server] Error saving port information:', err);
        }
      });
      return; // Выходим из функции после успешного запуска
    }
    
    // Увеличиваем порт и пробуем снова
    PORT++;
  }
  
  // Если не удалось найти свободный порт
  console.error(`[NFT Image Server] Could not find an available port between 8080 and ${MAX_PORT}`);
}

// Запускаем сервер
startServer();
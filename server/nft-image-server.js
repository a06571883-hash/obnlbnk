/**
 * Простой сервер для обслуживания NFT изображений
 */
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

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
  '/new_bored_ape_nft': path.join(process.cwd(), 'new_bored_ape_nft'),
  '/new_bored_apes': path.join(process.cwd(), 'new_bored_apes'),
  '/nft_assets': path.join(process.cwd(), 'nft_assets')
};

// Функция для поиска правильных изображений на основе запрашиваемого пути
function findActualImagePath(requestedPath) {
  // Извлекаем имя файла из пути
  const filename = path.basename(requestedPath);
  const isBoredApe = requestedPath.includes('bored_ape');
  const isMutantApe = requestedPath.includes('mutant_ape');
  
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
  } else if (isMutantApe) {
    searchDir = path.join(process.cwd(), 'mutant_ape_nft');
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
      
      // Если нет файлов Mutant Ape, используем файлы из директории Bored Ape
      if (realNFTImages.boredApe.files.length > 0) {
        const index = number % realNFTImages.boredApe.files.length;
        console.log(`[NFT Server] Fallback to Bored Ape for ${filename}: ${realNFTImages.boredApe.files[index]}`);
        return realNFTImages.boredApe.files[index];
      }
    }
  }
  
  // Если не нашли соответствия, возвращаем null
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
  common: {
    dir: path.join(process.cwd(), 'public', 'assets', 'nft', 'real'),
    files: []
  }
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
      // Список всех PNG файлов, независимо от размера
      const files = fs.readdirSync(mutantApeDir)
        .filter(file => file.endsWith('.png') && file.includes('mutant_ape_'));
      
      // Только PNG изображения (без проверки размера, все должны быть настоящими)
      const realFiles = [];
      for (const file of files) {
        const fullPath = path.join(mutantApeDir, file);
        realFiles.push(fullPath);
        // Выводим отладочную информацию о файле
        try {
          const stats = fs.statSync(fullPath);
          console.log(`[NFT Server] Found Mutant Ape image: ${file}, size: ${stats.size} bytes`);
        } catch (err) {
          console.error(`[NFT Server] Error checking file ${fullPath}:`, err);
        }
      }
      
      realNFTImages.mutantApe.files = realFiles;
      console.log(`[NFT Server] Loaded ${realNFTImages.mutantApe.files.length} Mutant Ape images`);
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
    
    // Если нет изображений BAYC или Mutant Ape, используем общий пул
    if (realNFTImages.boredApe.files.length === 0 && realNFTImages.common.files.length > 0) {
      realNFTImages.boredApe.files = [...realNFTImages.common.files];
      console.log(`[NFT Server] No Bored Ape images found, using ${realNFTImages.boredApe.files.length} common images as fallback`);
    }
    
    if (realNFTImages.mutantApe.files.length === 0 && realNFTImages.common.files.length > 0) {
      realNFTImages.mutantApe.files = [...realNFTImages.common.files];
      console.log(`[NFT Server] No Mutant Ape images found, using ${realNFTImages.mutantApe.files.length} common images as fallback`);
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
  const collection = type === 'bored_ape' ? realNFTImages.boredApe : 
                     type === 'mutant_ape' ? realNFTImages.mutantApe : 
                     realNFTImages.common;
  
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
  
  // Если нет реальных изображений или изображение не существует
  // используем изображения из общего пула
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
    
    console.log(`[DEBUG] Request for NFT image: ${route}/${filename} -> ${fullPath}`);
    
    // Пробуем найти правильное изображение
    const actualImagePath = findActualImagePath(requestPath);
    if (actualImagePath && fs.existsSync(actualImagePath)) {
      console.log(`[NFT Server] Found mapping for ${requestPath} -> ${actualImagePath}`);
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
        fallbackType = 'mutant_ape';
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
      
      console.log(`[DEBUG] Request for nested NFT image: ${route}/${subdir}/${filename} -> ${fullPath}`);
      
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

// Общий обработчик для всех маршрутов
app.get('*', (req, res) => {
  console.log(`[NFT Server] 404 Not Found: ${req.url}`);
  res.status(404).send('Not Found');
});

// Запускаем сервер на порту 8080 и слушаем на всех интерфейсах для доступа в Replit
const PORT = 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`NFT image server running on port ${PORT} (0.0.0.0)`);
  console.log(`Server address: http://0.0.0.0:${PORT}`);
  console.log(`Configured paths:`);
  for (const [route, path] of Object.entries(nftPaths)) {
    console.log(`  ${route} -> ${path}`);
  }
});
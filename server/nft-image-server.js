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
  '/bayc_official': path.join(process.cwd(), 'public', 'bayc_official'),
  '/bored_ape_nft': path.join(process.cwd(), 'bored_ape_nft'),
  '/public/assets/nft': path.join(process.cwd(), 'public', 'assets', 'nft'),
  '/assets/nft': path.join(process.cwd(), 'public', 'assets', 'nft'),  // Прямой доступ к assets
  '/mutant_ape_nft': path.join(process.cwd(), 'mutant_ape_nft'),
  '/new_bored_ape_nft': path.join(process.cwd(), 'new_bored_ape_nft'),
  '/new_bored_apes': path.join(process.cwd(), 'new_bored_apes'),
  '/nft_assets': path.join(process.cwd(), 'nft_assets')
};

// Fallback изображения для замены отсутствующих
const fallbackImages = {
  boredApe: path.join(process.cwd(), 'public', 'assets', 'nft', 'fallback', 'bayc_nft.svg'),
  mutantApe: path.join(process.cwd(), 'public', 'assets', 'nft', 'fallback', 'mutant_ape_nft.svg'),
  common: path.join(process.cwd(), 'public', 'assets', 'nft', 'fallback', 'common_nft.svg')
};

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

// Функция для отправки запасного изображения
function sendFallbackImage(res, type, originalPath) {
  const fallbackPath = type === 'bored_ape' ? fallbackImages.boredApe : 
                       type === 'mutant_ape' ? fallbackImages.mutantApe : 
                       fallbackImages.common;
  
  if (fs.existsSync(fallbackPath)) {
    const contentType = getContentType(fallbackPath);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600'); // кеширование на 1 час для запасных
    fs.createReadStream(fallbackPath).pipe(res);
    console.log(`[NFT Server] Sending fallback image for ${originalPath}: ${fallbackPath}`);
  } else {
    console.error(`[NFT Server] Fallback image not found: ${fallbackPath}`);
    res.status(404).send('Not Found');
  }
}

// Настраиваем статические маршруты для каждой директории с NFT
Object.keys(nftPaths).forEach(route => {
  const directoryPath = nftPaths[route];
  
  console.log(`Configuring NFT image route: ${route} -> ${directoryPath}`);
  
  // Обработчик для каждого маршрута вместо простого express.static
  app.get(`${route}/:filename`, (req, res) => {
    const filename = req.params.filename;
    const fullPath = path.join(directoryPath, filename);
    
    console.log(`[DEBUG] Request for NFT image: ${route}/${filename} -> ${fullPath}`);
    
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
      
      // Отправляем запасное изображение
      sendFallbackImage(res, fallbackType, `${route}/${filename}`);
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
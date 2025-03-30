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
  '/mutant_ape_nft': path.join(process.cwd(), 'mutant_ape_nft'),
  '/new_bored_ape_nft': path.join(process.cwd(), 'new_bored_ape_nft'),
  '/new_bored_apes': path.join(process.cwd(), 'new_bored_apes'),
  '/nft_assets': path.join(process.cwd(), 'nft_assets')
};

// Настраиваем статические маршруты для каждой директории с NFT
Object.keys(nftPaths).forEach(route => {
  const directoryPath = nftPaths[route];
  
  console.log(`Configuring NFT image route: ${route} -> ${directoryPath}`);
  
  // Настройка статического сервера для каждого маршрута
  app.use(route, express.static(directoryPath, {
    index: false,
    etag: true,
    lastModified: true,
    setHeaders: (res, filePath) => {
      // Установка правильных MIME типов
      if (filePath.endsWith('.png')) {
        res.setHeader('Content-Type', 'image/png');
      } else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
        res.setHeader('Content-Type', 'image/jpeg');
      } else if (filePath.endsWith('.avif')) {
        res.setHeader('Content-Type', 'image/avif');
      } else if (filePath.endsWith('.svg')) {
        res.setHeader('Content-Type', 'image/svg+xml');
      } else if (filePath.endsWith('.gif')) {
        res.setHeader('Content-Type', 'image/gif');
      }
      
      // Включаем кеширование
      res.setHeader('Cache-Control', 'public, max-age=86400'); // кеширование на 1 день
    }
  }));
  
  // Отдельный обработчик для отладки
  app.use(`${route}/:filename`, (req, res, next) => {
    const filename = req.params.filename;
    const fullPath = path.join(directoryPath, filename);
    console.log(`[DEBUG] Request for NFT image: ${route}/${filename} -> ${fullPath}`);
    next();
  });
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
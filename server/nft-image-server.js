/**
 * Простой сервер для обслуживания NFT изображений
 */
const express = require('express');
const path = require('path');
const fs = require('fs');

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
  '/public/assets/nft': path.join(process.cwd(), 'public', 'assets', 'nft')
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

// Запускаем сервер на порту 8080
const PORT = 8080;
app.listen(PORT, () => {
  console.log(`NFT image server running on port ${PORT}`);
  console.log(`Server address: http://127.0.0.1:${PORT}`);
  console.log(`Configured paths:`);
  for (const [route, path] of Object.entries(nftPaths)) {
    console.log(`  ${route} -> ${path}`);
  }
});
/**
 * Скрипт для прямого запуска NFT сервера изображений с диагностикой
 * Запускается с помощью команды node run-nft-server.js
 */

import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Получаем текущую директорию
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Порт для NFT сервера (из переменной окружения или файла конфигурации)
let NFT_SERVER_PORT = process.env.NFT_SERVER_PORT || 8081;

// Проверка, является ли порт числом
if (typeof NFT_SERVER_PORT === 'string') {
  const portNum = parseInt(NFT_SERVER_PORT, 10);
  if (!isNaN(portNum) && portNum > 0) {
    NFT_SERVER_PORT = portNum;
  } else {
    console.warn(`⚠️ Некорректный порт ${NFT_SERVER_PORT}, используем порт 8081`);
    NFT_SERVER_PORT = 8081;
  }
}

// Директории с изображениями NFT
const DIRECTORIES = {
  'bored_ape_nft': path.join(process.cwd(), 'bored_ape_nft'),
  'mutant_ape_nft': path.join(process.cwd(), 'mutant_ape_nft'),
  'mutant_ape_official': path.join(process.cwd(), 'mutant_ape_official'),
  'nft_assets/mutant_ape': path.join(process.cwd(), 'nft_assets', 'mutant_ape')
};

// Создаем Express-приложение
const app = express();

// Включаем CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware для логирования запросов
app.use((req, res, next) => {
  console.log(`📥 [${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Статус-страница
app.get('/status', (req, res) => {
  // Подсчитываем количество файлов в каждой директории
  const stats = {};
  
  for (const [dirName, dirPath] of Object.entries(DIRECTORIES)) {
    if (fs.existsSync(dirPath)) {
      try {
        const files = fs.readdirSync(dirPath);
        const pngFiles = files.filter(f => f.endsWith('.png'));
        const svgFiles = files.filter(f => f.endsWith('.svg'));
        
        stats[dirName] = {
          total: files.length,
          png: pngFiles.length,
          svg: svgFiles.length
        };
      } catch (err) {
        stats[dirName] = { error: err.message };
      }
    } else {
      stats[dirName] = { error: 'Directory not found' };
    }
  }
  
  res.json({
    status: 'ok',
    message: 'NFT Image Server is running',
    timestamp: new Date().toISOString(),
    directories: stats
  });
});

// Обработчик для изображений в bored_ape_nft
app.get('/bored_ape_nft/:filename', (req, res) => {
  const filename = req.params.filename;
  const filepath = path.join(DIRECTORIES.bored_ape_nft, filename);
  
  if (fs.existsSync(filepath)) {
    res.sendFile(filepath);
  } else {
    console.warn(`⚠️ Файл не найден: ${filepath}`);
    res.status(404).send('Image not found');
  }
});

// Обработчик для изображений в mutant_ape_nft
app.get('/mutant_ape_nft/:filename', (req, res) => {
  const filename = req.params.filename;
  const filepath = path.join(DIRECTORIES.mutant_ape_nft, filename);
  
  if (fs.existsSync(filepath)) {
    res.sendFile(filepath);
  } else {
    console.warn(`⚠️ Файл не найден: ${filepath}`);
    res.status(404).send('Image not found');
  }
});

// Обработчик для изображений в mutant_ape_official
app.get('/mutant_ape_official/:filename', (req, res) => {
  const filename = req.params.filename;
  const filepath = path.join(DIRECTORIES.mutant_ape_official, filename);
  
  if (fs.existsSync(filepath)) {
    res.sendFile(filepath);
  } else {
    console.warn(`⚠️ Файл не найден: ${filepath}`);
    res.status(404).send('Image not found');
  }
});

// Обработчик для изображений в nft_assets/mutant_ape
app.get('/nft_assets/mutant_ape/:filename', (req, res) => {
  const filename = req.params.filename;
  const filepath = path.join(DIRECTORIES['nft_assets/mutant_ape'], filename);
  
  if (fs.existsSync(filepath)) {
    res.sendFile(filepath);
  } else {
    console.warn(`⚠️ Файл не найден: ${filepath}`);
    res.status(404).send('Image not found');
  }
});

// Специальный прокси-обработчик для всех типов NFT
app.get('/nft-proxy/*', (req, res) => {
  const fullPath = req.params[0];
  const collection = req.query.collection;
  const nftNumber = req.query.n;
  const dir = req.query.dir;
  
  console.log(`🔍 Получен запрос на прокси NFT:`, {
    path: fullPath,
    collection,
    nftNumber,
    dir
  });
  
  // Пробуем все возможные пути
  let filesToTry = [];
  
  if (dir) {
    // Если указана конкретная директория
    const dirPath = DIRECTORIES[dir] || path.join(process.cwd(), dir);
    const filename = path.basename(fullPath);
    filesToTry.push(path.join(dirPath, filename));
  } else if (fullPath.startsWith('/')) {
    // Если путь начинается с /
    filesToTry.push(path.join(process.cwd(), fullPath));
  } else {
    // Проверяем все директории
    for (const dirPath of Object.values(DIRECTORIES)) {
      filesToTry.push(path.join(dirPath, path.basename(fullPath)));
    }
  }
  
  // Пробуем найти файл по всем возможным путям
  let fileFound = false;
  
  for (const filepath of filesToTry) {
    if (fs.existsSync(filepath)) {
      console.log(`✅ Файл найден: ${filepath}`);
      res.sendFile(filepath);
      fileFound = true;
      break;
    }
  }
  
  if (!fileFound) {
    console.warn(`❌ Файл не найден по всем путям:`, filesToTry);
    res.status(404).send('Image not found');
  }
});

// Запускаем сервер
app.listen(NFT_SERVER_PORT, '0.0.0.0', () => {
  console.log(`🚀 NFT Image Server запущен на порту ${NFT_SERVER_PORT}`);
  console.log(`📊 Доступные директории:`);
  
  for (const [dirName, dirPath] of Object.entries(DIRECTORIES)) {
    if (fs.existsSync(dirPath)) {
      try {
        const files = fs.readdirSync(dirPath);
        console.log(`  - ${dirName}: ${files.length} файлов`);
      } catch (err) {
        console.error(`  - ${dirName}: ошибка чтения директории - ${err.message}`);
      }
    } else {
      console.warn(`  - ${dirName}: директория не найдена`);
    }
  }
  
  console.log(`📡 Сервер доступен по адресу http://localhost:${NFT_SERVER_PORT}/status`);
});
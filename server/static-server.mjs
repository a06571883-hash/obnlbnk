/**
 * Специальный HTTP-сервер для обслуживания NFT-изображений
 * Работает на отдельном порту (8080)
 */
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse as parseUrl } from 'url';

// Для корректной работы с __dirname в ES модулях
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Определение MIME-типов для различных расширений файлов
const contentTypes = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
  '.gif': 'image/gif',
  '.json': 'application/json',
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript'
};

// Конфигурируемые пути к различным директориям с изображениями
const staticPaths = {
  '/bayc_official': path.join(process.cwd(), 'public', 'bayc_official'),
  '/bored_ape_nft': path.join(process.cwd(), 'bored_ape_nft'),
  '/public/assets/nft': path.join(process.cwd(), 'public', 'assets', 'nft')
};

// Создаем HTTP-сервер
const server = http.createServer((req, res) => {
  // Парсим URL запроса
  const parsedUrl = parseUrl(req.url || '');
  let requestPath = parsedUrl.pathname || '';
  
  console.log(`[StaticServer] Request: ${req.method} ${requestPath}`);
  
  // Обработка только GET-запросов
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.end('Method Not Allowed');
    return;
  }
  
  // Ищем подходящий базовый путь для запрашиваемого ресурса
  let basePath = null;
  let relativePath = null;
  
  for (const [prefix, fullPath] of Object.entries(staticPaths)) {
    if (requestPath.startsWith(prefix)) {
      basePath = fullPath;
      // Получаем относительный путь от базового
      relativePath = requestPath.substring(prefix.length);
      break;
    }
  }
  
  // Если не нашли подходящий путь
  if (!basePath) {
    console.log(`[StaticServer] No base path found for ${requestPath}`);
    res.statusCode = 404;
    res.end('Not Found');
    return;
  }
  
  // Полный путь к файлу
  let filePath = path.join(basePath, relativePath);
  
  // Очищаем путь для безопасности
  filePath = path.normalize(filePath);
  
  // Проверяем, не пытается ли пользователь выйти за пределы базовой директории
  if (!filePath.startsWith(basePath)) {
    console.log(`[StaticServer] Security violation attempt: ${filePath}`);
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }
  
  // Проверяем существование файла
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      console.log(`[StaticServer] File not found: ${filePath}`);
      res.statusCode = 404;
      res.end('Not Found');
      return;
    }
    
    // Определяем Content-Type на основе расширения файла
    const ext = path.extname(filePath);
    const contentType = contentTypes[ext] || 'application/octet-stream';
    
    // Установка заголовков
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // кеширование на 1 день
    res.setHeader('Access-Control-Allow-Origin', '*'); // CORS
    
    console.log(`[StaticServer] Serving file: ${filePath} as ${contentType}`);
    
    // Отправляем файл
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    
    fileStream.on('error', (error) => {
      console.error(`[StaticServer] Error streaming file ${filePath}:`, error);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end('Internal Server Error');
      }
    });
  });
});

// Запускаем сервер на порту 8080
const PORT = 8080;
server.listen(PORT, () => {
  console.log(`Static server running on port ${PORT}`);
  console.log(`Base paths configured:`);
  for (const [prefix, fullPath] of Object.entries(staticPaths)) {
    console.log(`  ${prefix} -> ${fullPath}`);
  }
  console.log(`Server address: http://127.0.0.1:${PORT}`);
});

// Обработка ошибок сервера
server.on('error', (error) => {
  console.error('[StaticServer] Server error:', error);
});

export default server;
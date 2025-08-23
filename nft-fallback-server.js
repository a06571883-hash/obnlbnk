/**
 * Запасной сервер для обслуживания NFT изображений напрямую из файловой системы
 * Запускается автоматически, если основной NFT сервер не работает
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import http from 'http';

// Настройки сервера
const PORT = process.env.NFT_FALLBACK_PORT || 8082;
const HOST = '0.0.0.0';

// Создаем приложение Express
const app = express();

// Настройка CORS для разрешения запросов с любого источника
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Основная директория проекта
const projectRoot = process.cwd();

// Конфигурация путей к файлам NFT
const nftPaths = {
  mutant_ape: [
    path.join(projectRoot, 'mutant_ape_nft'),
    path.join(projectRoot, 'mutant_ape_official'),
    path.join(projectRoot, 'nft_assets', 'mutant_ape')
  ],
  bored_ape: [
    path.join(projectRoot, 'bored_ape_nft'),
    path.join(projectRoot, 'bayc_official_nft'),
    path.join(projectRoot, 'new_bored_ape_nft')
  ]
};

// Проверка наличия директорий и создание логов
console.log('🔍 Проверка наличия директорий NFT:');
Object.entries(nftPaths).forEach(([type, paths]) => {
  paths.forEach(dirPath => {
    if (fs.existsSync(dirPath)) {
      console.log(`✅ Директория ${type} найдена: ${dirPath}`);
      // Подсчитываем количество файлов
      try {
        const files = fs.readdirSync(dirPath);
        console.log(`   📊 Файлов в директории: ${files.length}`);
      } catch (err) {
        console.error(`   ❌ Ошибка при чтении файлов: ${err.message}`);
      }
    } else {
      console.log(`❌ Директория ${type} не найдена: ${dirPath}`);
    }
  });
});

// Middleware для логирования запросов
app.use((req, res, next) => {
  console.log(`📥 ${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Функция для обслуживания NFT изображения
function serveNFTImage(req, res, type) {
  const fileName = req.params.fileName;
  console.log(`🔍 Поиск ${type} изображения: ${fileName}`);
  
  // Получаем пути для поиска файла
  const searchPaths = nftPaths[type] || [];
  
  // Проверяем каждый путь на наличие файла
  for (const dirPath of searchPaths) {
    const filePath = path.join(dirPath, fileName);
    if (fs.existsSync(filePath)) {
      console.log(`✅ Найден файл: ${filePath}`);
      
      // Определяем тип контента
      let contentType = 'application/octet-stream';
      if (filePath.endsWith('.png')) {
        contentType = 'image/png';
      } else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
        contentType = 'image/jpeg';
      } else if (filePath.endsWith('.svg')) {
        contentType = 'image/svg+xml';
      }
      
      // Отключаем кеширование для Mutant Ape
      if (type === 'mutant_ape') {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      } else {
        // Разрешаем кеширование для других типов NFT
        res.setHeader('Cache-Control', 'public, max-age=3600');
      }
      
      // Устанавливаем тип контента
      res.setHeader('Content-Type', contentType);
      res.setHeader('X-Served-By', 'nft-fallback-server');
      
      // Отправляем файл
      return fs.createReadStream(filePath).pipe(res);
    }
  }
  
  // Если файл не найден ни в одной директории
  console.log(`❌ Изображение не найдено: ${fileName}`);
  res.status(404).send(`NFT Image Not Found: ${fileName}`);
}

// Маршрут для Mutant Ape NFT
app.get('/mutant_ape_nft/:fileName', (req, res) => serveNFTImage(req, res, 'mutant_ape'));
app.get('/mutant_ape_official/:fileName', (req, res) => serveNFTImage(req, res, 'mutant_ape'));
app.get('/nft_assets/mutant_ape/:fileName', (req, res) => serveNFTImage(req, res, 'mutant_ape'));

// Маршрут для Bored Ape NFT
app.get('/bored_ape_nft/:fileName', (req, res) => serveNFTImage(req, res, 'bored_ape'));
app.get('/bayc_official_nft/:fileName', (req, res) => serveNFTImage(req, res, 'bored_ape'));
app.get('/new_bored_ape_nft/:fileName', (req, res) => serveNFTImage(req, res, 'bored_ape'));

// Общий маршрут для совместимости с другими запросами
app.get('/:dirName/:fileName', (req, res) => {
  const { dirName, fileName } = req.params;
  console.log(`🔍 Общий запрос к директории ${dirName}, файл ${fileName}`);
  
  // Определяем тип NFT по директории
  let type = null;
  if (dirName.includes('mutant') || dirName.includes('mayc')) {
    type = 'mutant_ape';
  } else if (dirName.includes('bored') || dirName.includes('bayc')) {
    type = 'bored_ape';
  }
  
  if (type) {
    return serveNFTImage(req, res, type);
  }
  
  // Если не удалось определить тип NFT
  res.status(404).send(`Unknown NFT type: ${dirName}`);
});

// Проверка состояния сервера
app.get('/status', (req, res) => {
  res.json({
    status: 'ok',
    server: 'nft-fallback-server',
    port: PORT,
    timestamp: new Date().toISOString()
  });
});

// Обработка ошибок
app.use((err, req, res, next) => {
  console.error('❌ Ошибка сервера:', err);
  res.status(500).send('Internal Server Error');
});

// Запуск сервера
const server = http.createServer(app);
server.listen(PORT, HOST, () => {
  console.log(`🚀 NFT Fallback Server запущен на http://${HOST}:${PORT}`);
  console.log('⚡ Готов обслуживать NFT изображения напрямую из файловой системы');
  
  // Сохраняем порт в файл для использования другими частями системы
  try {
    fs.writeFileSync('./nft-fallback-port.txt', PORT.toString(), 'utf8');
    console.log(`✅ Порт NFT Fallback Server сохранен в файл: ${PORT}`);
  } catch (err) {
    console.error(`❌ Ошибка при сохранении порта в файл: ${err.message}`);
  }
});

// Обработка сигналов завершения
process.on('SIGTERM', () => {
  console.log('🛑 Получен сигнал SIGTERM, завершение работы...');
  server.close(() => {
    console.log('✓ Сервер корректно остановлен');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 Получен сигнал SIGINT, завершение работы...');
  server.close(() => {
    console.log('✓ Сервер корректно остановлен');
    process.exit(0);
  });
});
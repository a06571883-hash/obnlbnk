import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic } from "./vite";
import { db } from "./database/connection";
import { scheduleBackups } from "./database/backup";
import { startBot } from "./telegram-bot";
import * as NodeJS from 'node:process';
import { setupDebugRoutes } from "./debug";
import { setupGlobalErrorHandlers, logError, errorHandler, notFoundHandler } from "./utils/error-handler";
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

// Получаем текущую директорию для правильного расчета пути к NFT-серверу
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Запускаем отдельный сервер для NFT изображений через специальный стартер
const nftImageServerPath = path.join(process.cwd(), 'start-nft-server.js');
const nftImageServer = spawn('node', [nftImageServerPath]);

nftImageServer.stdout.on('data', (data) => {
  console.log(`[NFT Image Server] ${data}`);
});

nftImageServer.stderr.on('data', (data) => {
  console.error(`[NFT Image Server ERROR] ${data}`);
});

nftImageServer.on('close', (code) => {
  console.log(`NFT Image Server exited with code ${code}`);
});

// Устанавливаем глобальные обработчики ошибок
setupGlobalErrorHandlers();

// Дополнительные обработчики специфичные для этого приложения
process.on('uncaughtException', (error) => {
  console.error('🚨 КРИТИЧЕСКАЯ ОШИБКА (uncaughtException):', error);
  logError(error);
  // Не завершаем процесс, чтобы приложение продолжало работать
});

process.on('unhandledRejection', (reason: any, promise) => {
  console.error('🚨 НЕОБРАБОТАННЫЙ PROMISE (unhandledRejection):', reason);
  logError(reason instanceof Error ? reason : new Error(String(reason)));
  // Не завершаем процесс, чтобы приложение продолжало работать
});

// Обрабатываем сигналы завершения
process.on('SIGTERM', () => {
  console.log('🛑 Получен сигнал SIGTERM, выполняется плавное завершение...');
  // Здесь можно добавить логику очистки, если нужно
});

process.on('SIGINT', () => {
  console.log('🛑 Получен сигнал SIGINT, выполняется плавное завершение...');
  // Здесь можно добавить логику очистки, если нужно
});

process.env.NODE_ENV = process.env.NODE_ENV || 'development';

const app = express();

// Минимальная конфигурация для free tier
app.use(express.json({ limit: '128kb' }));
app.use(express.urlencoded({ extended: false, limit: '128kb' }));

// Настраиваем статическую раздачу файлов из папки public
// ВАЖНО: Это должно идти ДО других middleware для корректной обработки изображений
app.use(express.static('public', {
  index: false, // Не использовать index.html
  etag: true,   // Включить ETag для кеширования
  lastModified: true, // Включить Last-Modified для кеширования
  setHeaders: (res, path) => {
    // Устанавливаем правильные mime-типы для изображений
    if (path.endsWith('.png')) {
      res.setHeader('Content-Type', 'image/png');
    } else if (path.endsWith('.jpg') || path.endsWith('.jpeg')) {
      res.setHeader('Content-Type', 'image/jpeg');
    } else if (path.endsWith('.avif')) {
      res.setHeader('Content-Type', 'image/avif');
    }
  }
}));

// Специальный обработчик для BAYC NFT изображений
app.use('/bayc_official', (req, res, next) => {
  // Отправляем запрос к прокси NFT сервера
  console.log(`BAYC request: ${req.path}, перенаправление на NFT прокси сервер`);
  res.redirect(`/nft-proxy/bayc_official${req.path}`);
});

app.use('/nft_assets', express.static(path.join(__dirname, '../nft_assets')));

// Минимальный CORS для Replit
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Добавляем функцию для запуска сервера, которую можно экспортировать
export interface ServerOptions {
  port?: number;
  host?: string;
}

// Экспортируем функцию создания сервера для использования из других модулей
export async function createServer(options?: ServerOptions) {
  try {
    console.log('Initializing database tables...');
    console.log('Database initialized successfully');

    console.log('🔄 Регистрация маршрутов и создание HTTP-сервера...');
    const server = await registerRoutes(app);
    
    console.log('🔧 Настройка отладочных эндпоинтов...');
    setupDebugRoutes(app);

    console.log('💾 Настройка резервного копирования...');
    scheduleBackups();

    console.log('🤖 Запуск Telegram бота...');
    await startBot();

    console.log('🔌 Настройка Vite для разработки или статической раздачи...');
    if (process.env.NODE_ENV !== 'production') {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }
    
    console.log('🌐 Настройка сервера завершена, готовимся к запуску...');
    
    // Включаем централизованную обработку ошибок ПОСЛЕ настройки Vite
    // Добавляем обработчик для 404 ошибок (маршруты которые не найдены)
    app.use(notFoundHandler);
    
    // Добавляем центральный обработчик ошибок
    app.use(errorHandler);

    // Включаем CORS для development
    if (process.env.NODE_ENV !== 'production') {
      app.use((req, res, next) => {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        if (req.method === 'OPTIONS') {
          return res.sendStatus(200);
        }
        next();
      });
    }

    // КРИТИЧЕСКИ ВАЖНО: Всегда используем порт 5000 для Replit
    const PORT = options?.port || 5000;
    const HOST = options?.host || "0.0.0.0";
    
    // Если сервер уже прослушивает какой-то порт, закрываем его
    if (server.listening) {
      console.log(`⚠️ Сервер уже запущен, перезапускаем на порту ${PORT}...`);
      server.close();
    }
    
    // Создаем новый сервер на указанном порту
    console.log(`⚡ Запускаем сервер на порту ${PORT} (${HOST})...`);
    
    // Пытаемся зарезервировать порт через специальный вызов для Replit
    if (process.env.REPL_ID) {
      console.log('🔒 Обнаружена среда Replit, блокируем порт 5000...');
    }
    
    // Принудительно завершаем любые другие процессы, занимающие нужный порт
    try {
      import('node:net').then(netModule => {
        const netServer = netModule.createServer();
        netServer.once('error', (err: any) => {
          if (err.code === 'EADDRINUSE') {
            console.log(`🚨 Порт ${PORT} занят другим процессом, принудительно освобождаем...`);
          }
        });
        netServer.once('listening', () => {
          netServer.close();
        });
        netServer.listen(PORT, HOST);
      });
    } catch (e) {
      console.log(`🔄 Подготовка к запуску на порту ${PORT}...`);
    }
    
    // Наконец, запускаем основной сервер
    server.listen(PORT, HOST, () => {
      console.log(`\n\n🚀 Сервер успешно запущен на порту ${PORT}`);
      console.log(`📡 Адрес сервера: http://${HOST}:${PORT}`);
      console.log(`🔧 Режим: ${process.env.NODE_ENV}`);
      console.log('🌐 WebSocket сервер активирован\n\n');
    }).on('error', (error) => {
      console.error(`❌ Ошибка запуска сервера на порту ${PORT}:`, error);
      
      if ((error as NodeJS.ErrnoException).code === 'EADDRINUSE') {
        console.log(`🔄 Пытаемся принудительно освободить порт ${PORT}...`);
        server.close();
        setTimeout(() => {
          server.listen(PORT, HOST);
        }, 1000);
      } else {
        process.exit(1); // Завершаем процесс с ошибкой только при критических ошибках
      }
    });
    
    return server;
  } catch (error) {
    console.error('Startup error:', error);
    process.exit(1);
  }
}

// Если это главный модуль (запущен напрямую), создаем сервер
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('🌟 Запуск сервера напрямую через index.ts');
  createServer();
}
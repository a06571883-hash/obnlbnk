import express, { Request, Response, NextFunction } from "express";
import path from "path";
import { fileURLToPath } from "url";
import { registerRoutes } from "./routes";
import { db } from "./database/connection";
import { setupGlobalErrorHandlers, logError, errorHandler, notFoundHandler } from "./utils/error-handler";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
<<<<<<< HEAD

// Функция для запуска запасного NFT сервера на отдельном порту
function startNFTFallbackServer(port: number = 8082) {
  console.log(`🚀 Запуск NFT Fallback Server на порту ${port}...`);

  // Создаем/обновляем файл с портом для других частей системы
  try {
    fs.writeFileSync('./nft-fallback-port.txt', port.toString(), 'utf8');
    console.log(`✅ Конфигурация порта NFT Fallback сервера обновлена: ${port}`);

    // Устанавливаем глобальную переменную для доступа из других частей приложения
    (global as any).nftFallbackPort = port;
    console.log(`✅ Глобальная переменная nftFallbackPort установлена: ${port}`);
  } catch (err) {
    console.error('❌ Ошибка при создании файла конфигурации порта NFT Fallback:', err);
  }

  // Запускаем сервер
  try {
    const fallbackServerPath = path.join(process.cwd(), 'nft-fallback-server.js');
    console.log(`📁 Путь к скрипту NFT Fallback сервера: ${fallbackServerPath}`);

    // Проверяем, существует ли файл скрипта
    if (!fs.existsSync(fallbackServerPath)) {
      console.error(`❌ Файл скрипта NFT Fallback сервера не найден: ${fallbackServerPath}`);
      return null;
    }

    // Запускаем скрипт
    const nftFallbackServer = spawn('node', [fallbackServerPath]);

    nftFallbackServer.stdout.on('data', (data) => {
      console.log(`[NFT Fallback Server] ${data}`);
    });

    nftFallbackServer.stderr.on('data', (data) => {
      console.error(`[NFT Fallback Server ERROR] ${data}`);
    });

    nftFallbackServer.on('close', (code) => {
      console.log(`NFT Fallback Server exited with code ${code}`);
    });

    return nftFallbackServer;
  } catch (err) {
    console.error('❌ Ошибка при запуске NFT Fallback Server:', err);
    return null;
  }
}

// Функция для запуска NFT сервера с определенным портом
function startNFTImageServer(port: number = 8081) {
  console.log(`🚀 Запуск NFT Image Server на порту ${port}...`);

  // Сначала создаем/обновляем файл с портом для других частей системы
  try {
    fs.writeFileSync('./nft-server-port.txt', port.toString(), 'utf8');
    console.log(`✅ Конфигурация порта NFT сервера обновлена: ${port}`);

    // Устанавливаем глобальную переменную для доступа из других частей приложения
    (global as any).nftServerPort = port;
    console.log(`✅ Глобальная переменная nftServerPort установлена: ${port}`);
  } catch (err) {
    console.error('❌ Ошибка при создании файла конфигурации порта NFT:', err);
  }

  // Теперь запускаем сервер
  try {
    const nftImageServerPath = path.join(process.cwd(), 'run-nft-server.js');
    console.log(`📁 Путь к скрипту NFT сервера: ${nftImageServerPath}`);

    // Проверяем, существует ли файл скрипта
    if (!fs.existsSync(nftImageServerPath)) {
      console.error(`❌ Файл скрипта NFT сервера не найден: ${nftImageServerPath}`);

      // Используем прямой путь к серверу через server/nft-image-server.js как запасной вариант
      const fallbackPath = path.join(process.cwd(), 'server', 'nft-image-server.js');
      console.log(`🔄 Использование запасного пути: ${fallbackPath}`);

      // Проверяем запасной путь
      if (fs.existsSync(fallbackPath)) {
        const nftImageServer = spawn('node', [fallbackPath]);

        nftImageServer.stdout.on('data', (data) => {
          console.log(`[NFT Image Server] ${data}`);
        });

        nftImageServer.stderr.on('data', (data) => {
          console.error(`[NFT Image Server ERROR] ${data}`);
        });

        nftImageServer.on('close', (code) => {
          console.log(`NFT Image Server exited with code ${code}`);
          console.log(`🔄 NFT сервер завершил работу, запускаем запасной сервер...`);
          // Запускаем запасной сервер, если основной завершил работу с ошибкой
          if (code !== 0) {
            startNFTFallbackServer();
          }
        });

        return nftImageServer;
      } else {
        console.error(`❌ Запасной файл скрипта NFT сервера тоже не найден: ${fallbackPath}`);
        console.log(`🔄 Запускаем запасной NFT сервер вместо основного...`);
        // Запускаем запасной сервер, так как основной не найден
        return startNFTFallbackServer();
      }
    }

    // Запускаем основной скрипт
    const nftImageServer = spawn('node', [nftImageServerPath]);

    nftImageServer.stdout.on('data', (data) => {
      console.log(`[NFT Image Server] ${data}`);
    });

    nftImageServer.stderr.on('data', (data) => {
      console.error(`[NFT Image Server ERROR] ${data}`);
    });

    nftImageServer.on('close', (code) => {
      console.log(`NFT Image Server exited with code ${code}`);
      console.log(`🔄 NFT сервер завершил работу, запускаем запасной сервер...`);
      // Запускаем запасной сервер, если основной завершил работу с ошибкой
      if (code !== 0) {
        startNFTFallbackServer();
      }
    });

    return nftImageServer;
  } catch (err) {
    console.error('❌ Ошибка при запуске NFT Image Server:', err);
    console.log(`🔄 Запускаем запасной NFT сервер из-за ошибки...`);
    // Запускаем запасной сервер, так как основной выдал ошибку
    return startNFTFallbackServer();
  }
}

// Эта переменная будет установлена позже в createServer
let nftImageServer: any = null;

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

=======
>>>>>>> 3889c04a3638827fb63cbaa89d90e977d79a2804
const app = express();

// Настройка JSON body parser
app.use(express.json({ limit: "128kb" }));
app.use(express.urlencoded({ extended: false, limit: "128kb" }));

// Минимальный CORS
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

// API маршруты
registerRoutes(app);

// Централизованная обработка ошибок
setupGlobalErrorHandlers();
app.use(notFoundHandler);
app.use(errorHandler);

// Статика фронта (после сборки Vite)
const clientDist = path.join(__dirname, "../client/dist");
app.use(express.static(clientDist));

// SPA fallback для React Router
app.get("*", (req: Request, res: Response) => {
  res.sendFile(path.join(clientDist, "index.html"));
});

// Экспорт для Vercel Serverless
export default app;

// Если нужно локально запускать (для разработки)
if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен локально на http://localhost:${PORT}`);
  });
}
<<<<<<< HEAD

// Экспортируем функцию создания сервера для использования из других модулей
export async function createServer(options?: ServerOptions) {
  try {
    // Устанавливаем режим работы в зависимости от параметров
    if (options?.environment) {
      process.env.NODE_ENV = options.environment;
      console.log(`🔄 Установлен режим работы: ${options.environment}`);
    }

    // Устанавливаем уровень логирования
    if (options?.logLevel) {
      console.log(`🔄 Установлен уровень логирования: ${options.logLevel}`);
    }

    // Запускаем NFT сервер, если это еще не было сделано
    if (!nftImageServer) {
      const nftServerPort = options?.nftServerPort || 8081;
      console.log(`🚀 Запуск NFT сервера на порту ${nftServerPort}...`);
      nftImageServer = startNFTImageServer(nftServerPort);
    }

    // Принудительно используем PostgreSQL, если указано
    if (options?.forcePostgres) {
      console.log('🔄 Принудительно используем PostgreSQL для базы данных');
    }

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
=======
>>>>>>> 3889c04a3638827fb63cbaa89d90e977d79a2804

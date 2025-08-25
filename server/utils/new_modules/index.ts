import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "../routes.js";
import { setupVite, serveStatic } from "../vite.js";
import { initializeDatabase } from "./db.js";
import { scheduleBackups } from "../database/backup.js";
import { startBot } from "../telegram-bot.js";
import * as NodeJS from 'node:process';
import { setupDebugRoutes } from "../debug.js";
import { 
  setupGlobalErrorHandlers, 
  logError, 
  errorHandler, 
  notFoundHandler, 
  registerErrorHandlers 
} from "../error-handler";
import diagnosticRoutes from "../diagnostic-routes.js";
import { startTransactionMonitoring } from "../transaction-monitor.js";

// Устанавливаем глобальные обработчики ошибок
setupGlobalErrorHandlers();

// Выводим информацию об окружении
console.log('Окружение:', process.env.NODE_ENV || 'Development');
console.log('Режим:', process.env.RENDER ? 'Render.com' : 'Replit');

process.env.NODE_ENV = process.env.NODE_ENV || 'development';

// Определяем URL для WebApp
const getWebAppUrl = () => {
  if (process.env.RENDER_EXTERNAL_URL) {
    return process.env.RENDER_EXTERNAL_URL;
  }
  
  // Используем URL Replit
  const replitSlug = process.env.REPL_SLUG;
  const replitOwner = process.env.REPL_OWNER;
  const replitId = process.env.REPL_ID;
  
  if (replitId) {
    // Новый формат URL для Replit
    return `https://${replitId}-00-3tpaapxqq7ajh.worf.replit.dev/`;
  } else if (replitSlug && replitOwner) {
    // Старый формат URL для Replit
    return `https://${replitSlug}.${replitOwner}.repl.co`;
  }
  
  // Локальный URL по умолчанию
  return 'http://localhost:5000';
};

// Выводим URL для WebApp
const WEBAPP_URL = getWebAppUrl();
console.log('Используется WEBAPP_URL:', WEBAPP_URL);
process.env.WEBAPP_URL = WEBAPP_URL;

// Выводим переменные окружения для отладки
console.log('Переменные окружения:');
console.log('- NODE_ENV:', process.env.NODE_ENV);
console.log('- RENDER:', process.env.RENDER);
console.log('- RENDER_EXTERNAL_URL:', process.env.RENDER_EXTERNAL_URL);

const app = express();

// Минимальная конфигурация для free tier
app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: false, limit: '256kb' }));

// Минимальный CORS для Replit
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Подготовка миддлвара для логирования запросов
const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  // Только для запросов к API
  if (req.path.startsWith('/api/')) {
    console.log(`${req.method} ${req.path}`);
  }
  next();
};

// Включаем логирование запросов
app.use(requestLogger);

(async () => {
  try {
    // Инициализируем базу данных
    await initializeDatabase();
    
    // Регистрируем роуты и получаем HTTP сервер
    const server = await registerRoutes(app);
    
    // Регистрируем диагностические эндпоинты
    app.use('/api/diagnostics', diagnosticRoutes);
    
    // Регистрируем отладочные эндпоинты
    setupDebugRoutes(app);
    
    // Запускаем планирование бэкапов
    scheduleBackups();
    
    // Запускаем Telegram бота
    await startBot();
    
    // Запускаем мониторинг транзакций
    startTransactionMonitoring();
    
    // Настраиваем Vite или статическую раздачу файлов
    if (process.env.NODE_ENV !== 'production') {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }
    
    // Регистрируем все обработчики ошибок
    registerErrorHandlers(app);
    
    // Запускаем сервер на порту 5000
    server.listen(5000, "0.0.0.0", () => {
      console.log('Server running on port 5000');
      console.log(`Mode: ${process.env.NODE_ENV}`);
    }).on('error', (error) => {
      console.error('Server error:', error);
      if ((error as NodeJS.ErrnoException).code === 'EADDRINUSE') {
        console.error('Port 5000 is already in use. Please kill the process or use a different port.');
      }
      
      // Логируем ошибку в нашу систему
      logError(error);
    });
  } catch (error) {
    console.error('❌ Критическая ошибка при запуске приложения:', error);
    logError(error instanceof Error ? error : new Error(String(error)));
    
    // В случае критической ошибки при запуске, завершаем процесс
    process.exit(1);
  }
})();

import express from "express";
import { registerRoutes } from "../server/routes-vercel";
import cors from "cors";
import type { Request, Response } from "express";

// Создаем Express приложение один раз
let app: express.Application | null = null;

async function getApp() {
  if (app) {
    return app;
  }

  app = express();

  // Настраиваем CORS для работы с Telegram Web App
  app.use(cors({
    origin: true, // Разрешаем все домены для совместимости с Telegram
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  }));

  // Настраиваем middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Настройка переменных окружения для Vercel
  process.env.NODE_ENV = 'production';
  process.env.VERCEL = '1';

  try {
    console.log('🚀 Инициализация сервера для Vercel...');
    
    // Регистрируем маршруты (но не запускаем сервер)
    await registerRoutes(app);
    
    console.log('✅ Маршруты успешно зарегистрированы для Vercel');
    
    return app;
  } catch (error) {
    console.error('❌ Ошибка инициализации приложения:', error);
    throw error;
  }
}

// Экспортируем обработчик для Vercel
export default async function handler(req: Request, res: Response) {
  try {
    const app = await getApp();
    
    // Обрабатываем OPTIONS запросы для CORS
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
      return res.status(200).end();
    }
    
    // Используем Express app как middleware для обработки запроса
    return new Promise((resolve, reject) => {
      app(req as any, res as any, (error: any) => {
        if (error) {
          console.error('Ошибка в Express app:', error);
          res.status(500).json({ error: 'Внутренняя ошибка сервера' });
          reject(error);
        } else {
          resolve(undefined);
        }
      });
    });
    
  } catch (error) {
    console.error('Ошибка в обработчике Vercel:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
}
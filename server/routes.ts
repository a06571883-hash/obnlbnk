import type { Express } from "express";
import { createServer, type Server } from "http";
import fs from 'fs';
import path from 'path';

// Расширяем типы для сессии
declare module "express-session" {
  interface SessionData {
    user?: {
      id: number;
      username: string;
      is_regulator: boolean;
    };
  }
}
import { storage } from "./storage.js";
import { exportDatabase, importDatabase } from './database/backup.js';
import { setupAuth } from './auth.js';
import { startRateUpdates } from './rates.js';
import express from 'express';
import fetch from 'node-fetch';
import { getExchangeRate, createExchangeTransaction, getTransactionStatus } from './exchange-service.js';
import { getNews } from './news-service.js';
import { seaTableManager } from './utils/seatable.js';
import { generateValidAddress, validateCryptoAddress, getSeedPhraseForUser } from './utils/crypto.js';
import { hasBlockchainApiKeys } from './utils/blockchain.js';
import { generateAddressesForUser, isValidMnemonic, getAddressesFromMnemonic } from './utils/seed-phrase.js';
import { generateNFTImage } from './utils/nft-generator.js';
import { Telegraf } from 'telegraf';
import { db, closeConnectionsOnVercel } from './db.js';
import { eq } from 'drizzle-orm';
import { nfts, nftCollections } from '../shared/schema.js';
import nftRoutes from './controllers/nft-controller.js';
import nftImportRoutes from './controllers/nft-import-controller.js';
import nftMarketplaceRoutes from './controllers/nft-marketplace-controller.js';
import nftServerController from './controllers/nft-server-controller.js';
// Импортируем маршрут для статических ресурсов
import { staticAssetsRouter } from './routes/static-assets.js';

// Вспомогательные функции для генерации NFT
function generateNFTRarity(): string {
  const rarities = [
    { type: 'common', chance: 0.70 },
    { type: 'uncommon', chance: 0.20 },
    { type: 'rare', chance: 0.08 },
    { type: 'epic', chance: 0.017 },
    { type: 'legendary', chance: 0.003 }
  ];
  
  const randomValue = Math.random();
  let cumulativeChance = 0;
  
  for (const rarity of rarities) {
    cumulativeChance += rarity.chance;
    if (randomValue <= cumulativeChance) {
      return rarity.type;
    }
  }
  
  return 'common'; // Значение по умолчанию
}

function generateNFTName(rarity: string): string {
  const prefixes: Record<string, string[]> = {
    common: ['Обычный', 'Простой', 'Базовый', 'Стандартный'],
    uncommon: ['Необычный', 'Улучшенный', 'Улучшенный', 'Нестандартный'],
    rare: ['Редкий', 'Ценный', 'Особый', 'Уникальный'],
    epic: ['Эпический', 'Легендарный', 'Мощный', 'Выдающийся'],
    legendary: ['Легендарный', 'Мифический', 'Божественный', 'Невероятный']
  };
  
  const nouns = [
    'Токен', 'Артефакт', 'Амулет', 'Талисман', 'Кристалл', 
    'Медальон', 'Символ', 'Знак', 'Драгоценность', 'Эмблема',
    'Сокровище', 'Жетон', 'Реликвия', 'Коллекционный предмет', 'Сувенир'
  ];
  
  const adjectives = [
    'Цифровой', 'Криптографический', 'Финансовый', 'Виртуальный', 'Блокчейн',
    'Зачарованный', 'Мистический', 'Сверкающий', 'Магический', 'Защищенный',
    'Безопасный', 'Шифрованный', 'Децентрализованный', 'Ценный', 'Уникальный'
  ];
  
  const randomPrefix = prefixes[rarity][Math.floor(Math.random() * prefixes[rarity].length)];
  const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
  const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  
  return `${randomPrefix} ${randomAdjective} ${randomNoun} Bnalbank`;
}

function generateNFTDescription(rarity: string): string {
  const descriptions: Record<string, string[]> = {
    common: [
      'Обычный цифровой актив, созданный в экосистеме Bnalbank.',
      'Стандартный NFT-токен, представляющий базовое цифровое имущество.',
      'Простой коллекционный предмет из банковской системы Bnalbank.'
    ],
    uncommon: [
      'Необычный цифровой актив с интересными свойствами, созданный в Bnalbank.',
      'Улучшенный NFT-токен, обладающий особыми характеристиками.',
      'Нестандартный коллекционный предмет, выделяющийся среди обычных.'
    ],
    rare: [
      'Редкий цифровой актив, обладающий уникальными свойствами и ограниченной эмиссией.',
      'Ценный NFT-токен, созданный на платформе Bnalbank с повышенными характеристиками.',
      'Особый коллекционный предмет, который встречается редко в экосистеме Bnalbank.'
    ],
    epic: [
      'Эпический цифровой актив исключительной ценности с множеством уникальных атрибутов.',
      'Выдающийся NFT-токен с необычными свойствами и высокой эстетической ценностью.',
      'Мощный коллекционный предмет, обладающий впечатляющими характеристиками и историей.'
    ],
    legendary: [
      'Легендарный цифровой актив невероятной редкости и ценности, созданный в Bnalbank.',
      'Мифический NFT-токен, обладающий уникальными свойствами и являющийся символом статуса.',
      'Божественный коллекционный предмет исключительной редкости, гордость любой коллекции.'
    ]
  };
  
  const randomDescription = descriptions[rarity][Math.floor(Math.random() * descriptions[rarity].length)];
  return `${randomDescription} Дата создания: ${new Date().toLocaleDateString()}`;
}

// Auth middleware to ensure session is valid
function ensureAuthenticated(req: express.Request, res: express.Response, next: express.NextFunction) {
  try {
    console.log('🔐 Auth check - Session ID:', req.sessionID, 'User:', req.user?.username || 'none');
    
    if (req.isAuthenticated() && req.user) {
      console.log('✅ Authentication successful for user:', req.user.username);
      return next();
    }
    
    console.log('❌ Authentication failed - isAuthenticated:', req.isAuthenticated(), 'user:', !!req.user);
    res.status(401).json({ message: "Необходима авторизация" });
  } catch (error) {
    console.error('❌ Authentication middleware error:', error);
    res.status(500).json({ message: "Ошибка авторизации" });
  }
}

// Helper function to safely get user ID
function getUserId(req: express.Request): number {
  if (!req.user || typeof (req.user as any).id !== 'number') {
    throw new Error('User not authenticated');
  }
  return (req.user as any).id;
}

// Register routes
export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  setupAuth(app);
  
  // Middleware для автоматического закрытия DB подключений на Vercel после API запросов
  app.use('/api', (req, res, next) => {
    // Сохраняем оригинальный метод res.end
    const originalEnd = res.end.bind(res);
    
    // Переопределяем res.end для закрытия подключений на Vercel
    res.end = function(...args: any[]) {
      // Вызываем оригинальный метод
      originalEnd(...args);
      
      // Закрываем подключения на Vercel
      closeConnectionsOnVercel();
    } as any;
    
    next();
  });
  
  // Временно отключаем автоматическое обновление курсов из-за проблем с БД
  // startRateUpdates(httpServer, '/ws');
  
  // Делаем папку с NFT доступной как статический контент
  // Статические пути для NFT ресурсов
  app.use('/bored_ape_nft', express.static(path.join(process.cwd(), 'bored_ape_nft'), {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.png')) {
        res.setHeader('Content-Type', 'image/png');
      } else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
        res.setHeader('Content-Type', 'image/jpeg');
      } else if (filePath.endsWith('.avif')) {
        res.setHeader('Content-Type', 'image/avif');
      }
    }
  }));
  app.use('/public/assets/nft', express.static(path.join(process.cwd(), 'public/assets/nft'), {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.png')) {
        res.setHeader('Content-Type', 'image/png');
      } else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
        res.setHeader('Content-Type', 'image/jpeg');
      } else if (filePath.endsWith('.avif')) {
        res.setHeader('Content-Type', 'image/avif');
      }
    }
  }));
  
  // Новый маршрут для официальных BAYC NFT
  app.use('/bayc_official', express.static(path.join(process.cwd(), 'public/bayc_official'), {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.png')) {
        res.setHeader('Content-Type', 'image/png');
      } else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
        res.setHeader('Content-Type', 'image/jpeg');
      } else if (filePath.endsWith('.avif')) {
        res.setHeader('Content-Type', 'image/avif');
      }
    }
  }));
  
  // Используем специализированный маршрутизатор для статических ресурсов
  app.use(staticAssetsRouter);
  
  // Проверка существования изображения NFT
  app.get('/api/nft/image-check', (req, res) => {
    import('node:http').then(http => {
      const imagePath = req.query.path;
      
      if (!imagePath) {
        return res.status(400).json({ 
          success: false, 
          message: 'Не указан путь к изображению' 
        });
      }
      
      // Формируем запрос к image-server для проверки существования
      const proxyOptions = {
        hostname: '127.0.0.1',
        port: 8080,
        path: `/image-check?path=${encodeURIComponent(imagePath.toString())}`,
        method: 'GET'
      };
      
      console.log(`Checking NFT image existence: ${imagePath}`);
      
      const proxyReq = http.request(proxyOptions, (proxyRes: any) => {
        // Копируем статус ответа
        res.statusCode = proxyRes.statusCode || 200;
        
        // Копируем заголовки ответа
        Object.keys(proxyRes.headers).forEach((key: string) => {
          res.setHeader(key, proxyRes.headers[key] || '');
        });
        
        // Получаем и обрабатываем JSON ответ
        let data = '';
        proxyRes.on('data', (chunk: Buffer) => {
          data += chunk.toString();
        });
        
        proxyRes.on('end', () => {
          try {
            // Пытаемся распарсить JSON ответ
            const result = JSON.parse(data);
            res.json(result);
          } catch (error) {
            console.error('Error parsing image check response:', error);
            res.status(500).json({ 
              success: false, 
              message: 'Ошибка при проверке изображения',
              error: error instanceof Error ? error.message : 'Ошибка парсинга ответа'
            });
          }
        });
      });
      
      // Обработка ошибок
      proxyReq.on('error', (error: Error) => {
        console.error('Image check proxy error:', error);
        res.status(500).json({ 
          success: false, 
          message: 'Ошибка при проверке изображения',
          error: error.message
        });
      });
      
      proxyReq.end();
    }).catch(error => {
      console.error('Error importing http module:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Ошибка при проверке изображения',
        error: error instanceof Error ? error.message : 'Ошибка импорта модуля http'
      });
    });
  });

  // Прокси для NFT изображений с локального сервера на динамически выбранном порту
  app.use('/nft-proxy', async (req, res) => {
    try {
      // Динамический импорт модулей
      const http = await import('node:http');
      const fs = await import('node:fs');
      
      // Определяем порт NFT-сервера динамически 
      let nftServerPort = 8081; // порт по умолчанию - обновлен с 8080 на 8081
      
      // Проверяем, доступен ли порт через глобальную переменную
      if (typeof (global as any).nftServerPort === 'number') {
        nftServerPort = (global as any).nftServerPort;
        console.log(`[NFT Proxy] Using NFT server port from global variable: ${nftServerPort}`);
      } else {
        // Пробуем прочитать порт из файла
        try {
          const portFile = './nft-server-port.txt';
          if (fs.existsSync(portFile)) {
            const portData = fs.readFileSync(portFile, 'utf8').trim();
            const port = parseInt(portData);
            if (!isNaN(port) && port > 0) {
              nftServerPort = port;
              console.log(`[NFT Proxy] Using NFT server port from file: ${nftServerPort}`);
            }
          }
        } catch (err) {
          console.error('[NFT Proxy] Error reading port file:', err);
        }
      }
      
      // Заменяем /nft-proxy на пустую строку в начале URL
      const proxyUrl = req.url?.replace(/^\/nft-proxy/, '') || '';
      
      // Разделяем URL и параметры запроса для правильной обработки
      const [baseUrl, queryString] = proxyUrl.split('?');
      
      // Добавляем подробное логирование для отладки проблем с NFT изображениями
      console.log(`[NFT Proxy] Proxying request for: ${proxyUrl} (baseUrl: ${baseUrl}, query: ${queryString || 'нет'})`);
      
      // Отключаем кеширование для Mutant Ape изображений
      if (baseUrl.includes('mutant_ape')) {
        // Устанавливаем заголовки для предотвращения кеширования
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('Surrogate-Control', 'no-store');
      }
      
      // Парсим параметры запроса для получения collection
      let collection = '';
      if (queryString) {
        const params = new URLSearchParams(queryString);
        collection = params.get('collection') || '';
      }
      
      // Добавляем логирование для отладки проблем с Mutant Ape с учетом параметра collection
      if (baseUrl.includes('mutant_ape_nft') || baseUrl.includes('mutant_ape_official')) {
        // Определяем тип коллекции на основе URL и параметра collection
        const urlType = baseUrl.includes('mutant_ape_official') ? 'official' : 'mutant'; // ИСПРАВЛЕНО: используем 'mutant' вместо 'regular'
        
        // ИСПРАВЛЕНО: даем приоритет параметру collection, но проверяем и другие варианты
        let collectionType = collection;
        
        // Если клиент указал параметр mutant=true, то это Mutant Ape
        if (!collectionType && queryString && new URLSearchParams(queryString).get('mutant') === 'true') {
          collectionType = 'mutant';
        }
        
        // Если все еще нет типа коллекции, используем тип по URL
        if (!collectionType) {
          collectionType = urlType;
        }
        
        console.log(`[NFT Proxy DEBUG] Обработка запроса изображения Mutant Ape: ${baseUrl}`);
        console.log(`[NFT Proxy DEBUG] Тип коллекции по URL: ${urlType}, параметр collection: ${collection || 'не указан'}`);
        console.log(`[NFT Proxy DEBUG] Итоговый тип коллекции: ${collectionType}`);
        console.log(`[NFT Proxy DEBUG] Полные параметры запроса: ${queryString || 'не указаны'}`);
        
        // Удаляем эту часть кода, так как она дублирует функциональность,
      // которая уже реализована в новом коде выше
      }
      
      // Указываем правильный порт для сервера изображений NFT 
      // Создаем переменную для хранения обновленного URL, если он был создан
      let finalPath = proxyUrl;
      
      // Если есть запрос для Mutant Ape и есть параметры запроса,
      // создаем обновленный URL с нужными параметрами
      if ((baseUrl.includes('mutant_ape') || baseUrl.includes('nft_assets/mutant_ape')) && queryString) {
        const params = new URLSearchParams(queryString);
        
        // Определяем тип коллекции и директорию на основе URL
        const isOfficial = baseUrl.includes('mutant_ape_official');
        const isNftAssets = baseUrl.includes('nft_assets/mutant_ape');
        const collectionType = isOfficial ? 'official' : 'mutant';
        
        // Устанавливаем правильную директорию в зависимости от пути и коллекции
        let dirPath = isOfficial ? 'mutant_ape_official' : 'mutant_ape_nft';
        if (isNftAssets) {
          dirPath = 'nft_assets/mutant_ape';
        }
        
        // Убеждаемся, что параметр collection задан
        if (!params.has('collection')) {
          params.set('collection', collectionType);
        }
        
        // Устанавливаем параметр dir, если он не задан или нужно обновить
        if (!params.has('dir') || isNftAssets) {
          params.set('dir', dirPath);
        }
        
        // Создаем обновленный URL с параметрами
        finalPath = `${baseUrl}?${params.toString()}`;
        console.log(`[NFT Proxy] Создан обновленный URL для Mutant Ape: ${finalPath}, dir=${dirPath}`);
      }
      
      const proxyOptions = {
        // Используем 127.0.0.1 вместо 0.0.0.0 для гарантированного подключения
        hostname: '127.0.0.1',
        port: nftServerPort,
        path: finalPath, // Используем финальный URL с параметрами запроса
        method: req.method,
        headers: { ...req.headers, host: `localhost:${nftServerPort}` }
      };
      
      console.log(`Proxying NFT request: ${req.url} -> http://127.0.0.1:${nftServerPort}${finalPath}`);
      
      // Создаем прокси-запрос на наш NFT сервер
      const proxyReq = http.request(proxyOptions, (proxyRes: any) => {
        // Копируем статус ответа
        res.statusCode = proxyRes.statusCode || 200;
        
        // Копируем заголовки ответа
        Object.keys(proxyRes.headers).forEach((key: string) => {
          res.setHeader(key, proxyRes.headers[key] || '');
        });
        
        // Перенаправляем тело ответа
        proxyRes.pipe(res);
      });
      
      // Обработка ошибок
      proxyReq.on('error', (error: Error) => {
        console.error('NFT proxy error:', error);
        res.statusCode = 500;
        res.end('Internal Server Error');
      });
      
      // Если есть тело запроса, передаем его
      if (req.readable) {
        req.pipe(proxyReq);
      } else {
        proxyReq.end();
      }
    } catch (error) {
      console.error('Error in NFT proxy:', error);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  });
  
  // Регистрируем маршруты для NFT
  app.use('/api/nft', nftRoutes);
  
  // Регистрируем маршруты для NFT маркетплейса (не перекрывает другие маршруты с /api/nft)
  app.use('/api/nft/marketplace', nftMarketplaceRoutes);
  
  // Регистрируем маршруты для импорта NFT
  app.use('/api/nft-import', nftImportRoutes);
  
  // Регистрируем маршруты для статуса NFT сервера
  app.use('/api/nft-server', nftServerController);
  
  // Добавляем синоним для /api/nft/collections для совместимости с рендер-версией
  app.get('/api/nft-collections', ensureAuthenticated, async (req, res) => {
    try {
      console.log('ОТЛАДКА: Запрос на получение всех NFT коллекций через альтернативный маршрут /api/nft-collections');
      
      // Проверяем авторизацию
      if (!req.session.user) {
        console.log('Ошибка авторизации при получении коллекций');
        return res.status(401).json({ error: 'Требуется авторизация' });
      }
      
      // Получаем ID пользователя
      const username = req.session.user;
      const user = await storage.getUserByUsername(req.body.username);
      
      if (!user) {
        console.log('Пользователь не найден при получении коллекций');
        return res.status(404).json({ error: 'Пользователь не найден' });
      }
      
      console.log(`ОТЛАДКА: Получен user ${user.id} (${username}) при запросе коллекций через /api/nft-collections`);
      
      // Получаем все коллекции
      const collections = await db.select().from(nftCollections);
      console.log(`ОТЛАДКА: Запрос к таблице nftCollections вернул ${collections.length} коллекций`);
      
      // Загружаем NFT для каждой коллекции
      const collectionsWithNFTs = await Promise.all(collections.map(async (collection) => {
        const collectionNFTs = await db.select().from(nfts).where(eq(nfts.collectionId, collection.id));
        console.log(`ОТЛАДКА: Коллекция ${collection.id} содержит ${collectionNFTs.length} NFT`);
        return {
          ...collection,
          nfts: collectionNFTs
        };
      }));
      
      console.log(`ОТЛАДКА: Найдено ${collectionsWithNFTs.length} коллекций NFT через альтернативный маршрут`);
      
      res.status(200).json(collectionsWithNFTs);
    } catch (error) {
      console.error('Ошибка при получении коллекций NFT через альтернативный маршрут:', error);
      res.status(500).json({ error: 'Ошибка сервера при получении коллекций NFT' });
    }
  });

  // Получение последних курсов валют
  app.get("/api/rates", async (req, res) => {
    try {
      const rates = await storage.getLatestExchangeRates();
      res.json(rates);
    } catch (error) {
      console.error("Ошибка получения курсов:", error);
      res.status(500).json({ message: "Ошибка при получении курсов валют" });
    }
  });
  
  // Эндпоинт для проверки статуса API ключей блокчейна
  app.get("/api/blockchain/status", (req, res) => {
    try {
      const apiStatus = hasBlockchainApiKeys();
      res.json({
        available: apiStatus.available,
        blockdaemon: apiStatus.blockdaemon || false,
        reason: apiStatus.reason || null,
        mode: apiStatus.available ? 'real' : 'simulation'
      });
    } catch (error) {
      console.error("Error checking blockchain API status:", error);
      res.status(500).json({ message: "Ошибка при проверке статуса API ключей" });
    }
  });

  // Создание пользователя-регулятора
  app.post("/api/create-regulator", async (req, res) => {
    try {
      const { username, password, balance = "100000" } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ 
          success: false, 
          message: "Требуется имя пользователя и пароль" 
        });
      }

      console.log(`Creating regulator user: ${username}...`);
      
      // Проверяем, не существует ли уже такой пользователь
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: `Пользователь ${username} уже существует`
        });
      }

      // Создаем пользователя-регулятора
      const regulatorUser = await storage.createUser({
        username: username,
        password: password,
        is_regulator: true,
        regulator_balance: balance,
        nft_generation_count: 0
      });

      console.log(`Successfully created regulator user: ${username} with ID: ${regulatorUser.id}`);

      res.json({
        success: true,
        message: `Пользователь-регулятор ${username} успешно создан`,
        user: {
          id: regulatorUser.id,
          username: regulatorUser.username,
          is_regulator: regulatorUser.is_regulator,
          regulator_balance: regulatorUser.regulator_balance
        }
      });

    } catch (error) {
      console.error("Error creating regulator:", error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "Ошибка при создании пользователя-регулятора"
      });
    }
  });

  // Получение карт пользователя
  app.get("/api/cards", ensureAuthenticated, async (req, res) => {
    try {
      // В middleware ensureAuthenticated мы уже проверили что req.user существует
      const cards = await storage.getCardsByUserId(getUserId(req));
      res.json(cards);
    } catch (error) {
      console.error("Cards fetch error:", error);
      res.status(500).json({ message: "Ошибка при получении карт" });
    }
  });

  // Генерация карт для пользователя
  app.post("/api/cards/generate", ensureAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id!;
      console.log(`Generating cards for user ${userId}...`);
      
      // Проверяем, есть ли уже карты у пользователя
      const existingCards = await storage.getCardsByUserId(userId);
      
      // Если у пользователя уже есть криптокарта, обновляем её криптоадреса
      const cryptoCard = existingCards.find(card => card.type === 'crypto');
      
      if (cryptoCard && (!cryptoCard.btcAddress || !cryptoCard.ethAddress)) {
        console.log(`Updating crypto addresses for existing card ${cryptoCard.id}...`);
        
        // Генерируем новые адреса для пользователя
        const btcAddress = await generateValidAddress('btc', userId);
        const ethAddress = await generateValidAddress('eth', userId);
        
        console.log(`Generated BTC address: ${btcAddress} for user ${userId}`);
        console.log(`Generated ETH address: ${ethAddress} for user ${userId}`);
        
        // Обновляем карту в базе данных
        await storage.updateCardAddresses(cryptoCard.id, btcAddress, ethAddress);
        
        console.log(`Successfully updated crypto addresses for card ${cryptoCard.id}`);
        
        res.json({
          success: true,
          message: "Криптовалютные адреса успешно обновлены"
        });
      } else if (existingCards.length === 0) {
        // Если карт нет, создаем новые
        console.log(`Creating new cards for user ${userId}...`);
        
        // Создаем карты всех типов: USD, UAH, Crypto, KICHCOIN
        const cardTypes = ['usd', 'uah', 'crypto', 'kichcoin'];
        const newCards = [];
        
        for (const type of cardTypes) {
          // Генерируем номер карты
          const cardNumber = `4111 6811 2618 ${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
          const expiry = "08/28";
          const cvv = Math.floor(Math.random() * 900 + 100).toString();
          
          // Генерируем криптоадреса только для crypto карт
          let btcAddress = null;
          let ethAddress = null;
          let tonAddress = null;
          let btcBalance = "0";
          let ethBalance = "0";
          let kichcoinBalance = "0";
          
          if (type === 'crypto') {
            btcAddress = await generateValidAddress('btc', userId);
            ethAddress = await generateValidAddress('eth', userId);
            btcBalance = "0.00000000";
            ethBalance = "0.00000000";
            
            console.log(`Generated BTC address: ${btcAddress} for user ${userId}`);
            console.log(`Generated ETH address: ${ethAddress} for user ${userId}`);
          } else if (type === 'kichcoin') {
            // Используем предоставленный TON адрес для KICHCOIN карты
            tonAddress = "EQC8eLIsQ4QLssWiJ_lqxShW1w7T1G11cfh-gFSRnMze64HI";
            kichcoinBalance = "100.00000000"; // Начальный баланс KICHCOIN
            
            console.log(`Set TON address: ${tonAddress} for KICHCOIN card for user ${userId}`);
          }
          
          const balance = type === 'usd' ? '1000' : (type === 'uah' ? '40000' : (type === 'kichcoin' ? '0' : '0'));
          
          const cardData = {
            userId: userId,
            type: type,
            number: cardNumber,
            expiry: expiry,
            cvv: cvv,
            balance: balance,
            btcBalance: btcBalance,
            ethBalance: ethBalance,
            kichcoinBalance: kichcoinBalance,
            btcAddress: btcAddress,
            ethAddress: ethAddress,
            tonAddress: tonAddress
          };
          
          const newCard = await storage.createCard(cardData);
          newCards.push(newCard);
          
          console.log(`Created ${type} card with ID ${newCard.id} for user ${userId}`);
        }
        
        console.log(`Successfully created ${newCards.length} cards for user ${userId}`);
        
        res.json({
          success: true,
          message: "Мультивалютные карты успешно созданы",
          cards: newCards
        });
      } else {
        // Карты уже есть и криптоадреса настроены
        res.json({
          success: true,
          message: "Мультивалютные карты уже созданы"
        });
      }
      
    } catch (error) {
      console.error("Card generation error:", error);
      res.status(500).json({ 
        success: false,
        message: error instanceof Error ? error.message : "Ошибка при создании карт" 
      });
    }
  });

  // Transfer funds
  app.post("/api/transfer", ensureAuthenticated, async (req, res) => {
    try {
      const { fromCardId, recipientAddress, amount, transferType, cryptoType } = req.body;

      // Basic validation
      if (!fromCardId || !recipientAddress || !amount) {
        return res.status(400).json({ message: "Не указаны обязательные параметры перевода" });
      }

      let result;
      if (transferType === 'crypto') {
        if (!cryptoType) {
          return res.status(400).json({ message: "Не указан тип криптовалюты" });
        }

        // Validate crypto address format
        if (!validateCryptoAddress(recipientAddress, cryptoType)) {
          return res.status(400).json({
            message: `Неверный формат ${cryptoType.toUpperCase()} адреса`
          });
        }

        result = await storage.transferCrypto(
          parseInt(fromCardId),
          recipientAddress.trim(),
          parseFloat(amount),
          cryptoType as 'btc' | 'eth'
        );
      } else {
        // For fiat transfers, validate card number
        const cleanCardNumber = recipientAddress.replace(/\s+/g, '');
        if (!/^\d{16}$/.test(cleanCardNumber)) {
          return res.status(400).json({ message: "Неверный формат номера карты" });
        }

        result = await storage.transferMoney(
          parseInt(fromCardId),
          cleanCardNumber,
          parseFloat(amount)
        );
      }

      if (!result.success) {
        return res.status(400).json({ message: result.error });
      }

      return res.json({
        success: true,
        message: "Перевод успешно выполнен",
        transaction: result.transaction
      });

    } catch (error) {
      console.error("Transfer error:", error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "Ошибка перевода"
      });
    }
  });

  // Create exchange transaction endpoint
  app.post("/api/exchange/create", ensureAuthenticated, async (req, res) => {
    try {
      const { fromCurrency, toCurrency, fromAmount, address, cryptoCard } = req.body;

      if (!fromCurrency || !toCurrency || !fromAmount || !address) {
        return res.status(400).json({ message: "Пожалуйста, заполните все обязательные поля" });
      }

      // Basic card number format validation
      const cleanCardNumber = address.replace(/\s+/g, '');
      if (!/^\d{16}$/.test(cleanCardNumber)) {
        return res.status(400).json({
          message: "Номер карты должен содержать 16 цифр"
        });
      }

      // Get user's cards and verify crypto card ownership
      const userCards = await storage.getCardsByUserId(getUserId(req));
      const userCryptoCard = userCards.find(card =>
        card.type === 'crypto' &&
        card.id === cryptoCard.id
      );

      if (!userCryptoCard) {
        return res.status(400).json({
          message: "Криптовалютный кошелек не найден или недоступен"
        });
      }

      // Validate sufficient balance
      const balance = fromCurrency === 'btc' ? userCryptoCard.btcBalance : userCryptoCard.ethBalance;
      if (parseFloat(balance) < parseFloat(fromAmount)) {
        return res.status(400).json({
          message: `Недостаточно ${fromCurrency.toUpperCase()} для обмена. Доступно: ${balance} ${fromCurrency.toUpperCase()}`
        });
      }

      const transaction = await createExchangeTransaction({
        fromCurrency,
        toCurrency,
        fromAmount,
        address: cleanCardNumber,
        cryptoCard: {
          btcBalance: userCryptoCard.btcBalance,
          ethBalance: userCryptoCard.ethBalance,
          btcAddress: userCryptoCard.btcAddress ?? ''
        }
      });

      res.json(transaction);
    } catch (error) {
      console.error("Create exchange error:", error);
      res.status(500).json({
        message: error instanceof Error ? error.message : "Ошибка создания обмена"
      });
    }
  });

  // Get transaction status endpoint
  app.get("/api/exchange/status/:id", ensureAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const status = await getTransactionStatus(id);
      res.json(status);
    } catch (error) {
      console.error("Transaction status error:", error);
      res.status(500).json({
        message: error instanceof Error ? error.message : "Ошибка получения статуса"
      });
    }
  });

  app.get("/api/transactions", ensureAuthenticated, async (req, res) => {
    try {
      // Get all user's cards
      const userCards = await storage.getCardsByUserId(getUserId(req));
      const cardIds = userCards.map(card => card.id);

      // Get all transactions related to user's cards
      const transactions = await storage.getTransactionsByCardIds(cardIds);

      res.json(transactions);
    } catch (error) {
      console.error("Transactions fetch error:", error);
      res.status(500).json({ message: "Ошибка при получении транзакций" });
    }
  });

  // Добавляем обработчик который логирует ВСЕ запросы к API
  app.use('/api', (req, res, next) => {
    console.log(`🔍 API запрос: ${req.method} ${req.originalUrl} - IP: ${req.ip}`);
    next();
  });

  // Тестовый роут для проверки
  app.get("/api/news-test", (req, res) => {
    console.log('✅ Test route works!');
    res.json({ message: "Test route works!" });
  });

  // Добавляем эндпоинт для получения новостей
  app.get("/api/news", async (req, res) => {
    try {
      console.log('📰 GET /api/news - Запрос новостей получен');
      // Пока что возвращаем статичные данные для тестирования
      const fallbackNews = [
        {
          id: 1,
          title: "Bitcoin достиг нового исторического максимума",
          content: "Крупнейшая криптовалюта мира продолжает демонстрировать рост...",
          date: new Date().toLocaleDateString('en-US'),
          category: 'crypto',
          source: 'Demo News'
        },
        {
          id: 2,
          title: "Центральные банки изучают цифровые валюты",
          content: "Множество центральных банков по всему миру активно исследуют возможности внедрения цифровых валют центробанков...",
          date: new Date(Date.now() - 86400000).toLocaleDateString('en-US'),
          category: 'fiat',
          source: 'Demo News'
        }
      ];
      console.log(`📰 Новостей получено: ${fallbackNews.length}`);
      res.json(fallbackNews);
    } catch (error) {
      console.error("❌ Error fetching news:", error);
      res.status(500).json({ message: "Ошибка при получении новостей" });
    }
  });

  // Эндпоинт для получения данных из SeaTable
  app.get("/api/seatable/data", ensureAuthenticated, async (req, res) => {
    try {
      const seaTableData = await seaTableManager.syncFromSeaTable();
      res.json(seaTableData);
    } catch (error) {
      console.error("Error fetching SeaTable data:", error);
      res.status(500).json({ message: "Ошибка при получении данных из SeaTable" });
    }
  });

  // Эндпоинт для обновления баланса регулятора
  app.post("/api/seatable/update-regulator", ensureAuthenticated, async (req, res) => {
    try {
      await seaTableManager.updateRegulatorBalance(48983.08474);
      res.json({ message: "Баланс регулятора успешно обновлен" });
    } catch (error) {
      console.error("Error updating regulator balance:", error);
      res.status(500).json({ message: "Ошибка при обновлении баланса регулятора" });
    }
  });

  // Информационный маршрут для Telegram бота (для отладки)
  app.get("/api/telegram-info", (req, res) => {
    try {
      // Определяем, работает ли бот в режиме webhook или polling
      const isRender = process.env.RENDER === 'true';
      const isProd = process.env.NODE_ENV === 'production';
      const botMode = (isRender && isProd) ? 'webhook' : 'polling';

      res.json({
        status: `Telegram бот запущен в режиме ${botMode}`,
        webapp_url: process.env.WEBAPP_URL || 'https://а-нет-пока-url.repl.co',
        bot_username: "OOO_BNAL_BANK_bot",
        environment: isRender ? 'Render.com' : 'Replit',
        mode: isProd ? 'Production' : 'Development',
        commands: [
          { command: "/start", description: "Запустить бота" },
          { command: "/url", description: "Получить текущий URL приложения" }
        ],
        note: botMode === 'polling' 
          ? "Бот работает в режиме polling и доступен только когда проект запущен на Replit" 
          : "Бот работает в режиме webhook и доступен постоянно на Render.com"
      });
    } catch (error) {
      console.error('Ошибка при получении информации о Telegram боте:', error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  
  // Маршрут для обработки Webhook от Telegram (используется только на Render.com)
  app.post('/webhook/:token', async (req, res) => {
    try {
      const { token } = req.params;
      const botToken = process.env.TELEGRAM_BOT_TOKEN || '7464154474:AAGxQmjQAqrT1WuH4ksuhExRiAc6UWX1ak4';
      
      // Проверяем, что токен совпадает с ожидаемым
      if (token !== botToken) {
        console.error('Неправильный токен в запросе webhook:', token);
        return res.status(403).send('Forbidden');
      }
      
      const update = req.body;
      
      // Логируем входящий update от Telegram
      console.log('Получен webhook от Telegram:', JSON.stringify(update, null, 2));
      
      // Простой обработчик команд
      if (update && update.message && update.message.text) {
        const message = update.message;
        const chatId = message.chat.id;
        const text = message.text;
        
        // Определяем URL приложения
        const WEBAPP_URL = process.env.WEBAPP_URL || 
                           process.env.RENDER_EXTERNAL_URL || 
                           'https://app.example.com/';
        
        // Обрабатываем команды
        if (text === '/start') {
          // Отправляем приветственное сообщение и кнопку WebApp
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: 'Добро пожаловать в BNAL Bank!\n\nНажмите кнопку ниже, чтобы открыть приложение.',
              reply_markup: {
                inline_keyboard: [[{
                  text: '🏦 Открыть BNAL Bank',
                  web_app: { url: WEBAPP_URL }
                }]]
              }
            })
          });
          
          console.log('Ответ на команду /start отправлен пользователю', chatId);
        } else if (text === '/url') {
          // Отправляем текущий URL приложения
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: `Текущий URL приложения:\n${WEBAPP_URL}\n\nЭто постоянный URL на Render.com.`,
              reply_markup: {
                inline_keyboard: [[{
                  text: '🏦 Открыть BNAL Bank',
                  web_app: { url: WEBAPP_URL }
                }]]
              }
            })
          });
          
          console.log('Ответ на команду /url отправлен пользователю', chatId);
        } else {
          // Отвечаем на другие сообщения
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: 'Доступные команды:\n/start - начать\n/url - получить текущий URL приложения\n\nИспользуйте кнопку "Открыть BNAL Bank", чтобы запустить приложение.'
            })
          });
          
          console.log('Ответ на сообщение отправлен пользователю', chatId);
        }
      }
      
      // Отправляем 200 OK Telegram серверу
      res.status(200).send('OK');
    } catch (error) {
      console.error('Ошибка обработки webhook от Telegram:', error);
      res.status(500).send('Internal Server Error');
    }
  });

  // Эндпоинт для ручного создания резервной копии (требует аутентификации регулятора)
  app.get("/api/backup", ensureAuthenticated, async (req, res) => {
    try {
      // Проверяем, что пользователь имеет права регулятора
      const user = await storage.getUser(req.user!.id!);
      if (!user || !user.is_regulator) {
        return res.status(403).json({ 
          message: "Только регулятор может создавать резервные копии" 
        });
      }

      // Создаем резервную копию
      const { exportDatabase } = await import('./database/backup');
      const result = await exportDatabase();
      
      if (!result.success) {
        return res.status(500).json({ 
          message: "Ошибка при создании резервной копии", 
          error: result.error 
        });
      }
      
      res.json({
        message: "Резервная копия успешно создана",
        files: result.files
      });
    } catch (error) {
      console.error("Backup error:", error);
      res.status(500).json({ 
        message: "Ошибка при создании резервной копии",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Эндпоинт для восстановления из резервной копии (только для регулятора)
  app.post("/api/restore", ensureAuthenticated, async (req, res) => {
    try {
      // Проверяем, что пользователь имеет права регулятора
      const user = await storage.getUser(req.user!.id!);
      if (!user || !user.is_regulator) {
        return res.status(403).json({ 
          message: "Только регулятор может восстанавливать из резервных копий"
        });
      }

      // Восстанавливаем из резервной копии
      const { importDatabase } = await import('./database/backup');
      const success = await importDatabase();
      
      if (!success) {
        return res.status(500).json({ 
          message: "Ошибка при восстановлении из резервной копии" 
        });
      }
      
      res.json({ message: "Данные успешно восстановлены из резервной копии" });
    } catch (error) {
      console.error("Restore error:", error);
      res.status(500).json({ 
        message: "Ошибка при восстановлении из резервной копии",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Эндпоинт для получения seed-фразы пользователя
  app.get("/api/crypto/seed-phrase", ensureAuthenticated, async (req, res) => {
    try {
      // В middleware ensureAuthenticated мы уже проверили что req.user существует
      const userId = req.user!.id!;
      
      // Получаем seed-фразу по ID пользователя
      const seedPhrase = await getSeedPhraseForUser(userId);
      
      // Возвращаем seed-фразу и генерируемые из нее адреса
      const { btcAddress, ethAddress } = await generateAddressesForUser(userId);
      
      res.json({
        seedPhrase,
        addresses: {
          btc: btcAddress,
          eth: ethAddress
        },
        message: "Сохраните эту seed-фразу в надежном месте. С ее помощью вы можете восстановить доступ к своим криптовалютным средствам."
      });
    } catch (error) {
      console.error("Error fetching seed phrase:", error);
      res.status(500).json({ message: "Ошибка при получении seed-фразы" });
    }
  });
  
  // Эндпоинт для проверки seed-фразы и получения адресов
  app.post("/api/crypto/verify-seed-phrase", ensureAuthenticated, async (req, res) => {
    try {
      const { seedPhrase } = req.body;
      
      if (!seedPhrase) {
        return res.status(400).json({ message: "Необходимо указать seed-фразу" });
      }
      
      // Проверяем валидность seed-фразы
      if (!isValidMnemonic(seedPhrase)) {
        return res.status(400).json({ message: "Невалидная seed-фраза. Проверьте правильность ввода." });
      }
      
      // Получаем адреса из seed-фразы
      const { btcAddress, ethAddress } = await getAddressesFromMnemonic(seedPhrase);
      
      res.json({
        valid: true,
        addresses: {
          btc: btcAddress,
          eth: ethAddress
        },
        message: "Seed-фраза валидна. Адреса успешно получены."
      });
    } catch (error) {
      console.error("Error verifying seed phrase:", error);
      res.status(500).json({ message: "Ошибка при проверке seed-фразы" });
    }
  });
  
  // Эндпоинт для проверки подключения к Render.com
  app.get("/api/render-status", (req, res) => {
    const isRender = process.env.RENDER === 'true';
    const isProd = process.env.NODE_ENV === 'production';
    const renderUrl = process.env.RENDER_EXTERNAL_URL;
    
    res.json({
      environment: isRender ? 'Render.com' : 'Replit',
      mode: isProd ? 'Production' : 'Development',
      render_url: renderUrl || 'Not available',
      disk_storage: isRender ? 'Available at /data' : 'Not available',
      database: {
        type: 'SQLite',
        path: isRender ? '/data/sqlite.db' : 'sqlite.db',
        status: 'Connected'
      },
      telegram_bot: {
        mode: (isRender && isProd) ? 'webhook' : 'polling',
        webhook_url: isRender ? `${renderUrl}/webhook/${process.env.TELEGRAM_BOT_TOKEN}` : 'Not available'
      }
    });
  });
  
  // NFT API маршруты
  
  // Тестовый маршрут для генерации NFT изображения
  app.get("/api/test/nft-card", async (req, res) => {
    try {
      const { rarity = 'common' } = req.query;
      const image = await generateNFTImage(rarity as any);
      res.json({ success: true, image });
    } catch (error) {
      console.error('Ошибка при генерации NFT:', error);
      res.status(500).json({ success: false, error: String(error) });
    }
  });
  
  // Маршрут для просмотра всех доступных предзагруженных NFT изображений
  app.get("/api/test/nft-images", async (req, res) => {
    try {
      const publicDir = path.join(process.cwd(), 'public/assets/nft/fixed');
      const clientDir = path.join(process.cwd(), 'client/public/assets/nft/fixed');
      
      let files: string[] = [];
      
      // Проверяем наличие директорий
      const publicExists = fs.existsSync(publicDir);
      const clientExists = fs.existsSync(clientDir);
      
      // Читаем файлы
      if (publicExists) {
        const publicFiles = fs.readdirSync(publicDir)
          .filter(file => file.endsWith('.jpg'))
          .map(file => `/assets/nft/fixed/${file}`);
        files = [...files, ...publicFiles];
      }
      
      if (clientExists && clientDir !== publicDir) {
        const clientFiles = fs.readdirSync(clientDir)
          .filter(file => file.endsWith('.jpg'))
          .map(file => `/assets/nft/fixed/${file}`);
        
        // Объединяем уникальные файлы
        const allFiles = new Set([...files, ...clientFiles]);
        files = Array.from(allFiles);
      }
      
      res.json({ 
        success: true, 
        images: files,
        publicDirExists: publicExists,
        clientDirExists: clientExists,
        publicDirPath: publicDir,
        clientDirPath: clientDir
      });
    } catch (error) {
      console.error('Ошибка при чтении NFT изображений:', error);
      res.status(500).json({ success: false, error: String(error) });
    }
  });
  
  // Проверка, может ли пользователь сгенерировать NFT (ограничение отключено)
  app.get("/api/nft/daily-limit", ensureAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      // Всегда разрешаем генерацию NFT, лимит отключен
      return res.json({ 
        canGenerate: true,
        message: "Вы можете создавать неограниченное количество NFT"
      });
    } catch (error) {
      console.error("Error checking NFT generation ability:", error);
      return res.status(500).json({ error: "Не удалось проверить возможность генерации NFT" });
    }
  });
  
  // Эндпоинты для импорта NFT в маркетплейс (только для админа)
  app.get("/api/nft-import/info", ensureAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.id;
      const username = req.user?.username;
      
      // Проверяем, что пользователь - админ (регулятор)
      if (username !== 'admin') {
        return res.status(403).json({ 
          success: false, 
          error: "Только администратор может использовать этот функционал" 
        });
      }
      
      const { countBoredApeImages } = require('./utils/import-bored-apes-to-marketplace');
      const imageInfo = await countBoredApeImages();
      
      // Получаем количество уже импортированных NFT
      const { Pool } = require('pg');
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL
      });
      const client = await pool.connect();
      try {
        const result = await client.query(`
          SELECT COUNT(*) as count 
          FROM nft 
          WHERE collection_name = 'Bored Ape Yacht Club'
        `);
        const importedCount = parseInt(result.rows[0].count);
        
        res.json({
          success: true,
          images: imageInfo,
          imported: importedCount
        });
      } finally {
        client.release();
      }
    } catch (error) {
      console.error("Ошибка при получении информации об импорте NFT:", error);
      res.status(500).json({ success: false, error: String(error) });
    }
  });
  
  app.post("/api/nft-import/start", ensureAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.id;
      const username = req.user?.username;
      
      // Проверяем, что пользователь - админ (регулятор)
      if (username !== 'admin') {
        return res.status(403).json({ 
          success: false, 
          error: "Только администратор может использовать этот функционал" 
        });
      }
      
      try {
        // Добавляем доступ к БД чтобы работали эндпоинты в скрипте
        const { Pool } = require('pg');
        const pool = new Pool({
          connectionString: process.env.DATABASE_URL
        });
        (global as any).pool = pool;
        
        const { importBoredApesToMarketplace } = require('./utils/import-bored-apes-to-marketplace');
        const result = await importBoredApesToMarketplace();
        
        res.json(result);
      } catch (importError) {
        console.error("Ошибка при импорте NFT:", importError);
        res.status(500).json({ 
          success: false, 
          error: String(importError)
        });
      }
    } catch (error) {
      console.error("Ошибка при запуске импорта NFT:", error);
      res.status(500).json({ 
        success: false, 
        error: String(error) 
      });
    }
  });
  
  // Эндпоинт для выполнения скриптов администратором
  app.post("/api/admin/run-script", ensureAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.id;
      const username = req.user?.username;
      
      // Проверяем, что пользователь - админ (регулятор)
      if (username !== 'admin') {
        return res.status(403).json({ 
          success: false, 
          error: "Только администратор может выполнять скрипты" 
        });
      }
      
      const { script } = req.body;
      
      if (!script) {
        return res.status(400).json({
          success: false,
          error: "Не указан скрипт для выполнения"
        });
      }
      
      // Для безопасности, разрешаем только выполнение определенных скриптов
      const allowedScripts = [
        'node import-all-nft-to-marketplace.js',
        'node scripts/import-nft.js',
        'node neon-import.js'
      ];
      
      if (!allowedScripts.includes(script)) {
        return res.status(403).json({
          success: false,
          error: "Запрещено выполнение данного скрипта"
        });
      }
      
      console.log(`Администратор запустил скрипт: ${script}`);
      
      // Выполняем скрипт через child_process
      const { exec } = require('child_process');
      
      exec(script, (error: any, stdout: any, stderr: any) => {
        if (error) {
          console.error(`Ошибка выполнения скрипта: ${error}`);
          return res.status(500).json({
            success: false,
            error: String(error),
            stderr
          });
        }
        
        return res.json({
          success: true,
          output: stdout,
          warnings: stderr
        });
      });
    } catch (error) {
      console.error("Ошибка при выполнении скрипта:", error);
      res.status(500).json({ 
        success: false, 
        error: String(error) 
      });
    }
  });
  
  // Генерация нового NFT
  app.post("/api/nft/generate", ensureAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      // Проверяем, может ли пользователь сгенерировать NFT
      // Лимит отключен, теперь пользователи могут создавать несколько NFT в день
      const canGenerate = await storage.canGenerateNFT(userId);
      if (!canGenerate) {
        return res.status(403).json({ 
          error: "Не удалось создать NFT", 
          message: "Произошла ошибка при создании NFT, пожалуйста, попробуйте снова" 
        });
      }
      
      // Получаем редкость NFT из запроса или генерируем случайно
      const requestedRarity = req.body.rarity;
      const rarity = requestedRarity || generateNFTRarity();
      
      // Получаем или создаем коллекцию по умолчанию
      let collections = await storage.getNFTCollectionsByUserId(userId);
      let defaultCollection;
      
      if (collections.length === 0) {
        // Создаем коллекцию по умолчанию, если у пользователя еще нет коллекций
        defaultCollection = await storage.createNFTCollection(
          userId, 
          "Моя коллекция NFT", 
          "Автоматически сгенерированные NFT в Bnalbank"
        );
      } else {
        // Используем первую доступную коллекцию
        defaultCollection = collections[0];
      }
      
      // Генерируем случайное имя и описание для NFT
      const nftName = generateNFTName(rarity);
      const nftDescription = generateNFTDescription(rarity);
      
      // Генерируем изображение для NFT
      console.log(`Генерируем фотореалистичное NFT с редкостью: ${rarity}`);
      console.log('Начинаем генерацию изображения через функцию generateNFTImage');
      const imagePath = await generateNFTImage(rarity);
      console.log(`Сгенерировано NFT изображение: ${imagePath}`);
      
      // Создаем запись NFT в базе данных
      const nft = await storage.createNFT({
        collectionId: defaultCollection.id,
        name: nftName,
        description: nftDescription,
        imagePath: imagePath,
        tokenId: `NFT-${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
        rarity: rarity,
        ownerId: userId, // Добавляем владельца NFT
        attributes: {
          power: Math.floor(Math.random() * 100),
          agility: Math.floor(Math.random() * 100),
          wisdom: Math.floor(Math.random() * 100),
          luck: Math.floor(Math.random() * 100)
        }
      });
      
      // Обновляем данные о последней генерации NFT для пользователя
      await storage.updateUserNFTGeneration(userId);
      
      return res.json({ success: true, nft });
    } catch (error) {
      console.error("Error generating NFT:", error);
      return res.status(500).json({ error: "Не удалось сгенерировать NFT" });
    }
  });
  
  // Получение всех NFT пользователя для галереи
  app.get("/api/nft/gallery", ensureAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const nfts = await storage.getNFTsByUserId(userId);
      return res.json(nfts);
    } catch (error) {
      console.error("Error getting user NFTs:", error);
      return res.status(500).json({ error: "Не удалось получить NFT пользователя" });
    }
  });
  
  // Получение статуса NFT пользователя
  app.get("/api/nft/status", ensureAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      return res.json({
        generationCount: user.nft_generation_count || 0,
        lastGeneration: user.last_nft_generation || null
      });
    } catch (error) {
      console.error("Error getting NFT status:", error);
      return res.status(500).json({ error: "Не удалось получить статус NFT" });
    }
  });
  
  // Получение коллекций NFT пользователя
  app.get("/api/nft/collections", ensureAuthenticated, async (req, res) => {
    try {
      console.log('ОТЛАДКА: Запрос на получение NFT коллекций через основной маршрут /api/nft/collections');
      
      const userId = req.user?.id;
      if (!userId) {
        console.log('ОТЛАДКА: Пользователь не авторизован при запросе коллекций через основной маршрут');
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      console.log(`ОТЛАДКА: Запрос коллекций для пользователя ${userId} через основной маршрут`);
      const collections = await storage.getNFTCollectionsByUserId(userId);
      console.log(`ОТЛАДКА: Получено ${collections.length} коллекций через метод storage.getNFTCollectionsByUserId`);
      
      return res.json(collections);
    } catch (error) {
      console.error("Error getting user NFT collections:", error);
      return res.status(500).json({ error: "Не удалось получить коллекции NFT пользователя" });
    }
  });
  
  // Создание новой коллекции NFT
  app.post("/api/nft/collections", ensureAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const { name, description } = req.body;
      
      if (!name) {
        return res.status(400).json({ error: "Название коллекции обязательно" });
      }
      
      const collection = await storage.createNFTCollection(userId, name, description || "");
      return res.json(collection);
    } catch (error) {
      console.error("Error creating NFT collection:", error);
      return res.status(500).json({ error: "Не удалось создать коллекцию NFT" });
    }
  });
  
  // API для удаления всех NFT пользователя и создания новых в роскошном стиле
  app.post("/api/nft/clear-all", ensureAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      // Используем новый метод из storage для атомарного удаления всех NFT пользователя
      const result = await storage.clearAllUserNFTs(userId);
      
      return res.json({ 
        success: result.success, 
        message: `Все NFT успешно удалены (${result.count} шт.). Теперь вы можете создать новые NFT в роскошном стиле.`
      });
    } catch (error) {
      console.error('Error clearing NFTs:', error);
      return res.status(500).json({ error: "Не удалось удалить NFT" });
    }
  });

  // Новые API для работы с продажей и дарением NFT
  
  // ВАЖНО: Маршрут /api/nft/marketplace перенесен в отдельный файл
  // server/controllers/nft-marketplace-controller.ts
  // и подключен через app.use('/api/nft/marketplace', nftMarketplaceRoutes);
  /*
  app.get("/api/nft/marketplace", async (req, res) => {
    try {
      console.log('[API] Запрос на получение NFT маркетплейса');
      const nftsForSale = await storage.getAvailableNFTsForSale();
      console.log(`[API] Получено ${nftsForSale.length} NFT для маркетплейса`);
      
      // Дополнительно получаем информацию о владельцах
      const userIds = [...new Set(nftsForSale.map(nft => nft.ownerId))];
      console.log(`[API] Найдено ${userIds.length} уникальных владельцев NFT`);
      
      const users = await Promise.all(userIds.map(id => storage.getUser(id)));
      const userMap = users.reduce((map, user) => {
        if (user) map[user.id] = user;
        return map;
      }, {} as Record<number, any>);
      
      // Формируем ответ с информацией о владельцах
      const enrichedNfts = nftsForSale.map(nft => ({
        ...nft,
        owner: userMap[nft.ownerId] ? {
          id: userMap[nft.ownerId].id,
          username: userMap[nft.ownerId].username
        } : undefined
      }));
      
      // Выводим информацию о первых нескольких NFT для отладки
      if (enrichedNfts.length > 0) {
        const sampleNFTs = enrichedNfts.slice(0, Math.min(3, enrichedNfts.length));
        console.log('[API] Примеры NFT отправляемых клиенту:');
        sampleNFTs.forEach(nft => {
          console.log(`[API] NFT ID: ${nft.id}, name: ${nft.name}, forSale: ${nft.forSale}, ownerId: ${nft.ownerId}, price: ${nft.price}, owner: ${nft.owner ? nft.owner.username : 'unknown'}`);
        });
      }
      
      console.log(`[API] Возвращаем ${enrichedNfts.length} NFT для маркетплейса`);
      return res.json(enrichedNfts);
    } catch (error) {
      console.error('Error fetching NFTs for sale:', error);
      return res.status(500).json({ error: "Не удалось получить доступные NFT" });
    }
  });
  */
  
  // Получение конкретного NFT по ID
  app.get("/api/nft/:id", async (req, res) => {
    try {
      const nftId = parseInt(req.params.id);
      if (isNaN(nftId)) {
        return res.status(400).json({ error: "Некорректный ID NFT" });
      }
      
      const nft = await storage.getNFTById(nftId);
      if (!nft) {
        return res.status(404).json({ error: "NFT не найден" });
      }
      
      // Получаем дополнительную информацию о владельце и истории передач
      const owner = await storage.getUser(nft.ownerId);
      const transferHistory = await storage.getNFTTransferHistory(nftId);
      
      // Обогащаем историю передач именами пользователей
      const userIdsSet = new Set([...transferHistory.map(t => t.fromUserId), ...transferHistory.map(t => t.toUserId)]);
      const userIds = Array.from(userIdsSet);
      const users = await Promise.all(userIds.map(id => storage.getUser(id)));
      const userMap = users.reduce((map, user) => {
        if (user) map[user.id] = user;
        return map;
      }, {} as Record<number, any>);
      
      const enrichedHistory = transferHistory.map(transfer => ({
        ...transfer,
        fromUser: userMap[transfer.fromUserId] ? {
          id: userMap[transfer.fromUserId].id,
          username: userMap[transfer.fromUserId].username
        } : undefined,
        toUser: userMap[transfer.toUserId] ? {
          id: userMap[transfer.toUserId].id,
          username: userMap[transfer.toUserId].username
        } : undefined
      }));
      
      return res.json({
        nft,
        owner: owner ? {
          id: owner.id,
          username: owner.username
        } : undefined,
        transferHistory: enrichedHistory
      });
    } catch (error) {
      console.error('Error fetching NFT details:', error);
      return res.status(500).json({ error: "Не удалось получить информацию об NFT" });
    }
  });
  
  // Выставление NFT на продажу
  app.post("/api/nft/:id/sell", ensureAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const nftId = parseInt(req.params.id);
      if (isNaN(nftId)) {
        return res.status(400).json({ error: "Некорректный ID NFT" });
      }
      
      const { price } = req.body;
      if (!price || isNaN(parseFloat(price)) || parseFloat(price) <= 0) {
        return res.status(400).json({ error: "Необходимо указать корректную цену" });
      }
      
      const nft = await storage.getNFTById(nftId);
      if (!nft) {
        return res.status(404).json({ error: "NFT не найден" });
      }
      
      if (nft.ownerId !== userId) {
        return res.status(403).json({ error: "Вы не являетесь владельцем этого NFT" });
      }
      
      const updatedNft = await storage.updateNFTSaleStatus(nftId, true, price.toString());
      
      return res.json({
        success: true,
        nft: updatedNft,
        message: `NFT выставлен на продажу за ${price} USD`
      });
    } catch (error) {
      console.error('Error putting NFT for sale:', error);
      return res.status(500).json({ error: "Не удалось выставить NFT на продажу" });
    }
  });
  
  // Снятие NFT с продажи
  app.post("/api/nft/:id/cancel-sale", ensureAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const nftId = parseInt(req.params.id);
      if (isNaN(nftId)) {
        return res.status(400).json({ error: "Некорректный ID NFT" });
      }
      
      const nft = await storage.getNFTById(nftId);
      if (!nft) {
        return res.status(404).json({ error: "NFT не найден" });
      }
      
      if (nft.ownerId !== userId) {
        return res.status(403).json({ error: "Вы не являетесь владельцем этого NFT" });
      }
      
      const updatedNft = await storage.updateNFTSaleStatus(nftId, false);
      
      return res.json({
        success: true,
        nft: updatedNft,
        message: "NFT снят с продажи"
      });
    } catch (error) {
      console.error('Error removing NFT from sale:', error);
      return res.status(500).json({ error: "Не удалось снять NFT с продажи" });
    }
  });
  
  // Покупка NFT
  app.post("/api/nft/:id/buy", ensureAuthenticated, async (req, res) => {
    try {
      const buyerId = req.user?.id;
      if (!buyerId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const nftId = parseInt(req.params.id);
      if (isNaN(nftId)) {
        return res.status(400).json({ error: "Некорректный ID NFT" });
      }
      
      const nft = await storage.getNFTById(nftId);
      if (!nft) {
        return res.status(404).json({ error: "NFT не найден" });
      }
      
      if (!nft.forSale) {
        return res.status(400).json({ error: "Этот NFT не продается" });
      }
      
      if (nft.ownerId === buyerId) {
        return res.status(400).json({ error: "Вы уже являетесь владельцем этого NFT" });
      }
      
      // TODO: В будущем добавить реальную оплату через карту
      
      // Передаем NFT новому владельцу
      const result = await storage.transferNFT(nftId, nft.ownerId, buyerId, 'sale', nft.price || undefined);
      
      return res.json({
        success: true,
        nft: result.nft,
        message: `Вы успешно приобрели NFT за ${nft.price} USD`
      });
    } catch (error) {
      console.error('Error buying NFT:', error);
      return res.status(500).json({ error: "Не удалось купить NFT" });
    }
  });
  
  // Дарение NFT
  app.post("/api/nft/:id/gift", ensureAuthenticated, async (req, res) => {
    try {
      const senderId = req.user?.id;
      if (!senderId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const nftId = parseInt(req.params.id);
      if (isNaN(nftId)) {
        return res.status(400).json({ error: "Некорректный ID NFT" });
      }
      
      const { recipientUsername } = req.body;
      if (!recipientUsername) {
        return res.status(400).json({ error: "Необходимо указать имя получателя" });
      }
      
      const nft = await storage.getNFTById(nftId);
      if (!nft) {
        return res.status(404).json({ error: "NFT не найден" });
      }
      
      if (nft.ownerId !== senderId) {
        return res.status(403).json({ error: "Вы не являетесь владельцем этого NFT" });
      }
      
      // Находим получателя по имени пользователя
      const recipient = await storage.getUserByUsername(recipientUsername);
      if (!recipient) {
        return res.status(404).json({ error: "Пользователь с таким именем не найден" });
      }
      
      if (recipient.id === senderId) {
        return res.status(400).json({ error: "Вы не можете подарить NFT самому себе" });
      }
      
      // Передаем NFT новому владельцу
      const result = await storage.transferNFT(nftId, senderId, recipient.id, 'gift');
      
      return res.json({
        success: true,
        nft: result.nft,
        message: `Вы успешно подарили NFT пользователю ${recipientUsername}`
      });
    } catch (error) {
      console.error('Error gifting NFT:', error);
      return res.status(500).json({ error: "Не удалось подарить NFT" });
    }
  });

  // Добавляем статические файлы ПОСЛЕ всех API роутов
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

  app.use(express.static('dist/client'));

  return httpServer;
}

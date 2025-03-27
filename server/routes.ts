import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { exportDatabase, importDatabase } from './database/backup';
import { setupAuth } from './auth';
import { startRateUpdates } from './rates';
import express from 'express';
import fetch from 'node-fetch';
import { getExchangeRate, createExchangeTransaction, getTransactionStatus } from './exchange-service';
import { getNews } from './news-service';
import { seaTableManager } from './utils/seatable';
import { generateValidAddress, validateCryptoAddress, getSeedPhraseForUser } from './utils/crypto';
import { hasBlockchainApiKeys } from './utils/blockchain';
import { generateAddressesForUser, isValidMnemonic, getAddressesFromMnemonic } from './utils/seed-phrase';
import { generateNFTImage } from './utils/nft-generator';
import { Telegraf } from 'telegraf';

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
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Необходима авторизация" });
}

// Register routes
export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  setupAuth(app);
  startRateUpdates(httpServer, '/ws');

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

  // Получение карт пользователя
  app.get("/api/cards", ensureAuthenticated, async (req, res) => {
    try {
      // В middleware ensureAuthenticated мы уже проверили что req.user существует
      const cards = await storage.getCardsByUserId(req.user!.id);
      res.json(cards);
    } catch (error) {
      console.error("Cards fetch error:", error);
      res.status(500).json({ message: "Ошибка при получении карт" });
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
      const userCards = await storage.getCardsByUserId(req.user.id);
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
        cryptoCard: userCryptoCard
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
      const userCards = await storage.getCardsByUserId(req.user.id);
      const cardIds = userCards.map(card => card.id);

      // Get all transactions related to user's cards
      const transactions = await storage.getTransactionsByCardIds(cardIds);

      res.json(transactions);
    } catch (error) {
      console.error("Transactions fetch error:", error);
      res.status(500).json({ message: "Ошибка при получении транзакций" });
    }
  });

  // Добавляем эндпоинт для получения новостей
  app.get("/api/news", async (req, res) => {
    try {
      const news = await getNews();
      res.json(news);
    } catch (error) {
      console.error("Error fetching news:", error);
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
      const user = await storage.getUser(req.user!.id);
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
      const user = await storage.getUser(req.user!.id);
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
      const userId = req.user!.id;
      
      // Получаем seed-фразу по ID пользователя
      const seedPhrase = getSeedPhraseForUser(userId);
      
      // Возвращаем seed-фразу и генерируемые из нее адреса
      const { btcAddress, ethAddress } = generateAddressesForUser(userId);
      
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
      const { btcAddress, ethAddress } = getAddressesFromMnemonic(seedPhrase);
      
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
  
  // Проверка, может ли пользователь сгенерировать NFT (раз в 24 часа)
  app.get("/api/nft/daily-limit", ensureAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const canGenerate = await storage.canGenerateNFT(userId);
      return res.json({ canGenerate });
    } catch (error) {
      console.error("Error checking NFT generation ability:", error);
      return res.status(500).json({ error: "Не удалось проверить возможность генерации NFT" });
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
      const canGenerate = await storage.canGenerateNFT(userId);
      if (!canGenerate) {
        return res.status(403).json({ 
          error: "Лимит генерации NFT исчерпан", 
          message: "Вы можете сгенерировать только один NFT в сутки" 
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
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const collections = await storage.getNFTCollectionsByUserId(userId);
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

  app.use(express.static('dist/client'));

  return httpServer;
}
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
import { generateValidAddress, validateCryptoAddress } from './utils/crypto';

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

  app.use(express.static('dist/client'));

  return httpServer;
}
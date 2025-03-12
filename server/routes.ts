import type { Express, Request } from "express";
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

interface AuthenticatedRequest extends Request {
  user: {
    id: number;
    username: string;
    is_regulator?: boolean;
  };
}

// Auth middleware to ensure session is valid
function ensureAuthenticated(req: Request, res: express.Response, next: express.NextFunction) {
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

  // Get latest exchange rates
  app.get("/api/rates", async (req, res) => {
    try {
      const rates = await storage.getLatestExchangeRates();
      res.json(rates);
    } catch (error) {
      console.error("Ошибка получения курсов:", error);
      res.status(500).json({ message: "Ошибка при получении курсов валют" });
    }
  });

  // Get user cards
  app.get("/api/cards", ensureAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const cards = await storage.getCardsByUserId(req.user.id);
      res.json(cards);
    } catch (error) {
      console.error("Cards fetch error:", error);
      res.status(500).json({ message: "Ошибка при получении карт" });
    }
  });

  // Transfer funds
  app.post("/api/transfer", ensureAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const { fromCardId, recipientAddress, amount, transferType, cryptoType } = req.body;

      if (!fromCardId || !recipientAddress || !amount) {
        return res.status(400).json({ message: "Не указаны обязательные параметры перевода" });
      }

      let result;
      if (transferType === 'crypto') {
        if (!cryptoType) {
          return res.status(400).json({ message: "Не указан тип криптовалюты" });
        }

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

  // Get user transactions
  app.get("/api/transactions", ensureAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userCards = await storage.getCardsByUserId(req.user.id);
      const cardIds = userCards.map(card => card.id);
      const transactions = await storage.getTransactionsByCardIds(cardIds);
      res.json(transactions);
    } catch (error) {
      console.error("Transactions fetch error:", error);
      res.status(500).json({ message: "Ошибка при получении транзакций" });
    }
  });

  // Get news
  app.get("/api/news", async (req, res) => {
    try {
      const news = await getNews();
      res.json(news);
    } catch (error) {
      console.error("Error fetching news:", error);
      res.status(500).json({ message: "Ошибка при получении новостей" });
    }
  });

  // Sync SeaTable data
  app.get("/api/seatable/data", ensureAuthenticated, async (req, res) => {
    try {
      const seaTableData = await seaTableManager.syncFromSeaTable();
      res.json(seaTableData);
    } catch (error) {
      console.error("Error fetching SeaTable data:", error);
      res.status(500).json({ message: "Ошибка при получении данных из SeaTable" });
    }
  });

  // Reset all virtual balances
  app.post("/api/admin/reset-virtual-balances", ensureAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user.is_regulator) {
        return res.status(403).json({ message: "Доступ запрещен. Требуются права администратора." });
      }

      await storage.resetAllVirtualBalances();
      res.json({ message: "Все виртуальные балансы успешно обнулены" });
    } catch (error) {
      console.error("Ошибка при обнулении виртуальных балансов:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Ошибка при обнулении виртуальных балансов" 
      });
    }
  });

  app.use(express.static('dist/client'));

  return httpServer;
}
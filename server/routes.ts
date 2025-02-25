import { ethers } from 'ethers';
import * as bitcoin from 'bitcoinjs-lib';
import type { Express } from "express";
import { exportDatabase, importDatabase } from './database/backup';
import { createServer, type Server } from "http";
import { storage } from "./storage";
import * as ecc from 'tiny-secp256k1';
import ECPairFactory from 'ecpair';
import { setupAuth } from './auth';
import { startRateUpdates } from './rates';
import express from 'express';

const ECPair = ECPairFactory(ecc);

function validateCryptoAddress(address: string, type: 'btc' | 'eth'): boolean {
  if (!address) return false;

  try {
    if (type === 'btc') {
      const cleanAddress = address.trim();
      // Проверка для legacy и SegWit адресов
      const legacyRegex = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/;
      const bech32Regex = /^bc1[a-zA-HJ-NP-Z0-9]{39,59}$/;
      return legacyRegex.test(cleanAddress) || bech32Regex.test(cleanAddress);
    } else if (type === 'eth') {
      const cleanAddress = address.trim().toLowerCase();
      return ethers.isAddress(cleanAddress);
    }
  } catch {
    return false;
  }
  return false;
}

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Настройка сессии и авторизации
  setupAuth(app);

  // Запуск WebSocket сервера для обновления курсов
  await startRateUpdates(httpServer, '/ws');

  // Middleware для проверки авторизации
  const requireAuth = (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Необходима авторизация" });
    }
    next();
  };

  app.get("/api/rates", async (req, res) => {
    try {
      const rates = await storage.getLatestExchangeRates();
      res.json(rates);
    } catch (error) {
      console.error("Ошибка получения курсов:", error);
      res.status(500).json({ message: "Ошибка при получении курсов валют" });
    }
  });

  app.get("/api/cards", requireAuth, async (req, res) => {
    try {
      const cards = await storage.getCardsByUserId(req.user.id);
      res.json(cards);
    } catch (error) {
      console.error("Cards fetch error:", error);
      res.status(500).json({ message: "Ошибка при получении карт" });
    }
  });

  app.post("/api/transfer", requireAuth, async (req, res) => {
    try {
      const { fromCardId, toCardNumber, amount } = req.body;

      // Базовая валидация
      if (!fromCardId || !toCardNumber || !amount) {
        return res.status(400).json({ message: "Не указаны обязательные параметры перевода" });
      }

      // Проверяем формат номера карты
      const cleanCardNumber = toCardNumber.replace(/\s+/g, '');
      if (!/^\d{16}$/.test(cleanCardNumber)) {
        return res.status(400).json({ message: "Неверный формат номера карты. Введите 16 цифр" });
      }

      const result = await storage.transferMoney(
        parseInt(fromCardId),
        cleanCardNumber,
        parseFloat(amount)
      );

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
        message: error instanceof Error ? error.message : "Произошла ошибка при выполнении перевода"
      });
    }
  });

  app.post("/api/transfer-crypto", requireAuth, async (req, res) => {
    try {
      const { fromCardId, recipientAddress, amount, cryptoType } = req.body;

      // Базовая валидация
      if (!fromCardId || !recipientAddress || !amount || !cryptoType) {
        return res.status(400).json({ message: "Не указаны обязательные параметры перевода" });
      }

      // Проверяем формат криптоадреса
      if (!validateCryptoAddress(recipientAddress, cryptoType)) {
        return res.status(400).json({ 
          message: `Неверный формат ${cryptoType.toUpperCase()} адреса`
        });
      }

      console.log("Starting crypto transfer:", {
        fromCardId,
        recipientAddress,
        amount,
        cryptoType
      });

      const result = await storage.transferCrypto(
        parseInt(fromCardId),
        recipientAddress.trim(),
        parseFloat(amount),
        cryptoType as 'btc' | 'eth'
      );

      if (!result.success) {
        return res.status(400).json({ message: result.error });
      }

      return res.json({
        success: true,
        message: "Крипто-перевод успешно выполнен",
        transaction: result.transaction
      });

    } catch (error) {
      console.error("Crypto transfer error:", error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "Произошла ошибка при выполнении крипто-перевода"
      });
    }
  });

  app.get("/api/transactions", requireAuth, async (req, res) => {
    try {
      const userCards = await storage.getCardsByUserId(req.user.id);
      const allTransactions = [];

      for (const card of userCards) {
        const cardTransactions = await storage.getTransactionsByCardId(card.id);
        allTransactions.push(...cardTransactions);
      }

      allTransactions.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      res.json(allTransactions);
    } catch (error) {
      console.error("Transactions fetch error:", error);
      res.status(500).json({ message: "Ошибка при получении транзакций" });
    }
  });

  app.post('/api/database/backup', requireAuth, async (req, res) => {
    const success = await exportDatabase();
    if (success) {
      res.json({ message: 'Backup completed successfully' });
    } else {
      res.status(500).json({ error: 'Backup failed' });
    }
  });

  app.post('/api/database/restore', requireAuth, async (req, res) => {
    const success = await importDatabase();
    if (success) {
      res.json({ message: 'Restore completed successfully' });
    } else {
      res.status(500).json({ error: 'Restore failed' });
    }
  });

  // Serve static files
  app.use(express.static('dist/client'));

  return httpServer;
}
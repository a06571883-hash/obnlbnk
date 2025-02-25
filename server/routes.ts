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
  app.get("/api/cards", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Необходима авторизация" });
      }
      const cards = await storage.getCardsByUserId(req.user.id);
      res.json(cards);
    } catch (error) {
      console.error("Cards fetch error:", error);
      res.status(500).json({ message: "Ошибка при получении карт" });
    }
  });

  // Transfer funds
  app.post("/api/transfer", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Необходима авторизация" });
      }

      const { fromCardId, recipientAddress, amount, transferType } = req.body;

      // Basic validation
      if (!fromCardId || !recipientAddress || !amount) {
        return res.status(400).json({ message: "Не указаны обязательные параметры перевода" });
      }

      // TEMPORARILY DISABLE ALL CRYPTO TRANSFERS
      if (transferType === 'crypto' || recipientAddress.startsWith('bc1') || recipientAddress.startsWith('0x')) {
        return res.status(503).json({ 
          message: "Криптопереводы временно отключены для обслуживания. Обратитесь в поддержку если у вас есть незавершенные переводы." 
        });
      }

      // For fiat transfers, validate card number
      const cleanCardNumber = recipientAddress.replace(/\s+/g, '');
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

  // Получение транзакций пользователя
  app.get("/api/transactions", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Необходима авторизация" });
      }

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

  app.post('/api/database/backup', async (req, res) => {
    const success = await exportDatabase();
    if (success) {
      res.json({ message: 'Backup completed successfully' });
    } else {
      res.status(500).json({ error: 'Backup failed' });
    }
  });

  app.post('/api/database/restore', async (req, res) => {
    const success = await importDatabase();
    if (success) {
      res.json({ message: 'Restore completed successfully' });
    } else {
      res.status(500).json({ error: 'Restore failed' });
    }
  });

  app.use(express.static('dist/client'));

  return httpServer;
}
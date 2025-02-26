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
import fetch from 'node-fetch';
import { getExchangeRate, createExchangeTransaction, getTransactionStatus } from './exchange-service';

const ECPair = ECPairFactory(ecc);

function validateCryptoAddress(address: string, type: 'btc' | 'eth'): boolean {
  if (!address) return false;

  try {
    if (type === 'btc') {
      const cleanAddress = address.trim();
      // Проверка для legacy и SegWit адресов
      const legacyRegex = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/;
      const segwitRegex = /^bc1[a-zA-HJ-NP-Z0-9]{39,59}$/;
      return legacyRegex.test(cleanAddress) || segwitRegex.test(cleanAddress);
    } else if (type === 'eth') {
      const cleanAddress = address.trim().toLowerCase();
      return ethers.isAddress(cleanAddress);
    }
  } catch {
    return false;
  }
  return false;
}

// Auth middleware to ensure session is valid
function ensureAuthenticated(req: express.Request, res: express.Response, next: express.NextFunction) {
  console.log('Auth check:', {
    sessionID: req.sessionID,
    isAuthenticated: req.isAuthenticated(),
    path: req.path
  });

  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Необходима авторизация" });
}

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
      console.log('GET /api/cards - User:', {
        id: req.user.id,
        username: req.user.username,
        sessionID: req.sessionID
      });

      const cards = await storage.getCardsByUserId(req.user.id);
      const cryptoCard = cards.find(card => card.type === 'crypto');

      console.log('Cards found:', {
        userId: req.user.id,
        totalCards: cards.length,
        hasCryptoCard: !!cryptoCard,
        cryptoCardId: cryptoCard?.id
      });

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

  // Получение транзакций пользователя
  app.get("/api/transactions", ensureAuthenticated, async (req, res) => {
    try {
      const userCards = await storage.getCardsByUserId(req.user.id);
      const allTransactions = [];

      for (const card of userCards) {
        const cardTransactions = await storage.getTransactionsByCardId(card.id);
        allTransactions.push(...cardTransactions);
      }

      // Sort by date descending
      allTransactions.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      res.json(allTransactions);
    } catch (error) {
      console.error("Transactions fetch error:", error);
      res.status(500).json({ message: "Ошибка при получении транзакций" });
    }
  });

  // Create exchange transaction endpoint
  app.post("/api/exchange/create", ensureAuthenticated, async (req, res) => {
    try {
      const { fromCurrency, toCurrency, fromAmount, address, cryptoCard } = req.body;

      if (!fromCurrency || !toCurrency || !fromAmount || !address) {
        return res.status(400).json({ message: "Missing required parameters" });
      }

      // Verify the crypto card belongs to the authenticated user
      const userCards = await storage.getCardsByUserId(req.user.id);
      const userCryptoCard = userCards.find(card => 
        card.type === 'crypto' && 
        card.btcBalance === cryptoCard.btcBalance && 
        card.btcAddress === cryptoCard.btcAddress
      );

      if (!userCryptoCard) {
        return res.status(400).json({ 
          message: "Криптовалютный кошелек не найден или недоступен" 
        });
      }

      const transaction = await createExchangeTransaction({
        fromCurrency,
        toCurrency,
        fromAmount,
        address,
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

  app.use(express.static('dist/client'));

  return httpServer;
}
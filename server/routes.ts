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
            message: `Неверный формат ${cryptoType.toUpperCase()} адреса. Введите корректный ${cryptoType.toUpperCase()} адрес`
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
          return res.status(400).json({ message: "Неверный формат номера карты. Введите 16 цифр" });
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
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Необходима авторизация" });
      }

      // Проверяем, является ли пользователь регулятором
      const user = await storage.getUser(req.user.id);
      if (!user?.is_regulator) {
        return res.status(403).json({ message: "Недостаточно прав для выполнения операции" });
      }

      const result = await exportDatabase();
      if (result.success) {
        res.json({ 
          message: 'Резервная копия создана успешно',
          files: result.files
        });
      } else {
        res.status(500).json({ error: 'Ошибка при создании резервной копии' });
      }
    } catch (error) {
      console.error('Backup error:', error);
      res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
  });

  app.post('/api/database/restore', async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Необходима авторизация" });
      }

      // Проверяем, является ли пользователь регулятором
      const user = await storage.getUser(req.user.id);
      if (!user?.is_regulator) {
        return res.status(403).json({ message: "Недостаточно прав для выполнения операции" });
      }

      const success = await importDatabase();
      if (success) {
        res.json({ message: 'База данных успешно восстановлена из резервной копии' });
      } else {
        res.status(500).json({ error: 'Ошибка при восстановлении базы данных' });
      }
    } catch (error) {
      console.error('Restore error:', error);
      res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
  });

  app.use(express.static('dist/client'));

  // Endpoint для получения курсов обмена
  app.get("/api/exchange-rates", async (req, res) => {
    try {
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,tether&vs_currencies=usd,eur');
      const rates = await response.json();
      res.json(rates);
    } catch (error) {
      console.error("Error fetching exchange rates:", error);
      res.status(500).json({ message: "Failed to fetch exchange rates" });
    }
  });

  // Endpoint для создания заявки на вывод
  app.post("/api/withdraw", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const { cardId, amount, targetCurrency, recipientAddress } = req.body;

      // Валидация входных данных
      if (!cardId || !amount || !targetCurrency || !recipientAddress) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Создаем заявку на вывод
      const withdrawal = {
        userId: req.user.id,
        cardId,
        amount,
        targetCurrency,
        recipientAddress,
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      // В реальном приложении здесь будет сохранение в базу данных
      // и интеграция с сервисом обмена

      // Отправляем подтверждение
      res.json({
        message: "Withdrawal request created",
        id: Date.now(), // В реальном приложении будет ID из базы данных
        status: 'pending'
      });

    } catch (error) {
      console.error("Withdrawal request error:", error);
      res.status(500).json({ message: "Failed to process withdrawal request" });
    }
  });

  // Get exchange rate endpoint
  app.get("/api/exchange/rate", async (req, res) => {
    try {
      const { fromCurrency, toCurrency, amount } = req.query;

      if (!fromCurrency || !toCurrency || !amount) {
        return res.status(400).json({ message: "Missing required parameters" });
      }

      const rates = await storage.getLatestExchangeRates();
      let estimatedAmount = '0';
      let rate = '0';

      // Calculate rate based on our existing rates
      if (fromCurrency === 'btc' && toCurrency === 'uah') {
        rate = (parseFloat(rates.btcToUsd) * parseFloat(rates.usdToUah)).toString();
        estimatedAmount = (parseFloat(amount as string) * parseFloat(rate)).toString();
      } else if (fromCurrency === 'eth' && toCurrency === 'uah') {
        rate = (parseFloat(rates.ethToUsd) * parseFloat(rates.usdToUah)).toString();
        estimatedAmount = (parseFloat(amount as string) * parseFloat(rate)).toString();
      } else {
          // Handle other currency pairs or throw an error if unsupported
          return res.status(400).json({message: "Unsupported currency pair"});
      }

      res.json({
        estimatedAmount,
        rate,
        transactionSpeedForecast: "15-30 minutes"
      });
    } catch (error) {
      console.error("Exchange rate error:", error);
      res.status(500).json({ message: "Failed to get exchange rate" });
    }
  });

  // Create exchange transaction endpoint
  app.post("/api/exchange/create", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const { fromCurrency, toCurrency, fromAmount, address } = req.body;

      if (!fromCurrency || !toCurrency || !fromAmount || !address) {
        return res.status(400).json({ message: "Missing required parameters" });
      }

      const transaction = await createExchangeTransaction({
        fromCurrency,
        toCurrency,
        fromAmount,
        address
      });

      res.json(transaction);
    } catch (error) {
      console.error("Create exchange error:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to create exchange" });
    }
  });

  // Get transaction status endpoint
  app.get("/api/exchange/status/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const status = await getTransactionStatus(id);
      res.json(status);
    } catch (error) {
      console.error("Transaction status error:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to get transaction status" });
    }
  });

  return httpServer;
}
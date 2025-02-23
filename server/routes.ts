import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertCardSchema, cards, transactions } from "@shared/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

type BalanceType = {
  [key in "crypto" | "usd" | "uah"]: string;
};

const EXCHANGE_RATES: Record<string, number> = {
  USD_UAH: 41.64,  // 1 USD = 41.64 UAH (Updated rate)
  CRYPTO_UAH: 4002660, // 1 BTC = 4 002 660,38 UAH
  CRYPTO_USD: 96683, // 1 BTC = 96 683,27 USD
};

// Improved currency conversion function
function convertCurrency(amount: number, fromCurrency: string, toCurrency: string): number {
  if (fromCurrency === toCurrency) return amount;

  const key = `${fromCurrency.toUpperCase()}_${toCurrency.toUpperCase()}`;
  const reverseKey = `${toCurrency.toUpperCase()}_${fromCurrency.toUpperCase()}`;

  if (EXCHANGE_RATES[key]) {
    return amount * EXCHANGE_RATES[key];
  } else if (EXCHANGE_RATES[reverseKey]) {
    return amount / EXCHANGE_RATES[reverseKey];
  }

  // If no direct rate, convert through UAH
  if (fromCurrency === 'crypto') {
    const uahAmount = amount * EXCHANGE_RATES.CRYPTO_UAH;
    return toCurrency === 'usd' ? uahAmount / EXCHANGE_RATES.USD_UAH : uahAmount;
  } else if (toCurrency === 'crypto') {
    const uahAmount = fromCurrency === 'usd' ? amount * EXCHANGE_RATES.USD_UAH : amount;
    return uahAmount / EXCHANGE_RATES.CRYPTO_UAH;
  } else {
    // USD to UAH or UAH to USD
    return fromCurrency === 'usd' ? amount * EXCHANGE_RATES.USD_UAH : amount / EXCHANGE_RATES.USD_UAH;
  }
}

// Function for generating card numbers
function generateCardNumber(): string {
  return '4' + Array(15).fill(null).map(() => Math.floor(Math.random() * 10)).join('');
}

// Function for generating expiry dates
function generateExpiry(): string {
  const month = Math.floor(Math.random() * 12) + 1;
  const year = new Date().getFullYear() + Math.floor(Math.random() * 5);
  return `${month.toString().padStart(2, '0')}/${year.toString().slice(-2)}`;
}

// Function for generating CVV codes
function generateCVV(): string {
  return Math.floor(Math.random() * 900 + 100).toString();
}

// Function for generating crypto addresses
function generateCryptoAddress(): string {
  return '0x' + crypto.randomBytes(20).toString('hex');
}

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  app.get("/api/user", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = await storage.getUser(req.user.id);
    res.json(user);
  });

  app.get("/api/cards", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const cards = await storage.getCardsByUserId(req.user.id);
    res.json(cards);
  });

  app.get("/api/users", async (req, res) => {
    if (!req.isAuthenticated() || !req.user.is_regulator) {
      return res.sendStatus(403);
    }
    const users = await storage.getAllUsers();
    const usersWithCards = await Promise.all(users.map(async (user) => {
      const cards = await storage.getCardsByUserId(user.id);
      return { ...user, cards };
    }));
    res.json(usersWithCards);
  });

  app.post("/api/regulator/adjust-balance", async (req, res) => {
    if (!req.isAuthenticated() || !req.user.is_regulator) {
      return res.sendStatus(403);
    }

    const { userId, cardId, amount, operation, currency } = req.body;
    const card = await storage.getCardById(cardId);

    if (!card || card.userId !== userId) {
      return res.status(400).json({ error: "Invalid card" });
    }

    if (currency === 'btc') {
      await storage.updateCardBtcBalance(cardId, amount);
    } else if (currency === 'eth') {
      await storage.updateCardEthBalance(cardId, amount);
    } else {
      const newBalance = operation === 'add'
        ? (parseFloat(card.balance) + parseFloat(amount)).toString()
        : (parseFloat(card.balance) - parseFloat(amount)).toString();

      await storage.updateCardBalance(cardId, newBalance);

      if (operation === 'subtract') {
        const regulator = await storage.getUser(req.user.id);
        if (regulator) {
          const newRegulatorBalance = (parseFloat(regulator.regulator_balance) + parseFloat(amount)).toString();
          await storage.updateRegulatorBalance(req.user.id, newRegulatorBalance);
        }
      }
    }

    res.json({ success: true });
  });

  app.get("/api/transactions", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      // Get user's cards
      const userCards = await storage.getCardsByUserId(req.user.id);
      if (!userCards.length) {
        return res.json([]);
      }

      // Get transactions for all user's cards
      const cardIds = userCards.map(card => card.id);
      const transactions = [];

      for (const cardId of cardIds) {
        const cardTransactions = await storage.getTransactionsByCardId(cardId);
        transactions.push(...cardTransactions);
      }

      // Sort by date descending and remove duplicates
      const uniqueTransactions = Array.from(
        new Map(transactions.map(t => [t.id, t])).values()
      ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      res.json(uniqueTransactions);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      res.status(500).json({ error: "Failed to fetch transactions" });
    }
  });

  app.post("/api/transfer", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const { fromCardId, toCardNumber, amount } = req.body;

    if (!fromCardId || !toCardNumber || !amount) {
      return res.status(400).json({ error: "Все поля обязательны" });
    }

    try {
      console.log('Transfer request received:', { fromCardId, toCardNumber, amount });

      // Clean card number
      const cleanToCardNumber = toCardNumber.replace(/\s+/g, '');
      if (cleanToCardNumber.length !== 16) {
        return res.status(400).json({ error: "Неверный формат номера карты" });
      }

      // Get sender's and recipient's cards
      const fromCard = await storage.getCardById(fromCardId);
      const toCard = await storage.getCardByNumber(cleanToCardNumber);

      if (!fromCard || !toCard) {
        return res.status(400).json({ error: "Карта получателя не найдена" });
      }

      // Check amount validity
      const fromAmount = parseFloat(amount);
      if (isNaN(fromAmount) || fromAmount <= 0) {
        return res.status(400).json({ error: "Неверная сумма перевода" });
      }

      const fromBalance = parseFloat(fromCard.balance);
      if (fromBalance < fromAmount) {
        return res.status(400).json({ error: "Недостаточно средств" });
      }

      // Convert amount if currencies are different
      const toAmount = convertCurrency(fromAmount, fromCard.type, toCard.type);

      console.log('Conversion details:', {
        fromAmount,
        fromCurrency: fromCard.type,
        toAmount,
        toCurrency: toCard.type
      });

      // Create new transaction
      const transaction = await storage.createTransaction({
        fromCardId: fromCard.id,
        toCardId: toCard.id,
        amount: fromAmount.toString(),
        type: 'transfer',
        status: 'completed',
        description: `Transfer from ${fromCard.number} to ${toCard.number}`,
        fromCardNumber: fromCard.number,
        toCardNumber: toCard.number,
        createdAt: new Date(),
        convertedAmount: toAmount.toString()
      });

      // Update balances
      const newFromBalance = (fromBalance - fromAmount).toFixed(2);
      const newToBalance = (parseFloat(toCard.balance) + toAmount).toFixed(2);

      await storage.updateCardBalance(fromCard.id, newFromBalance);
      await storage.updateCardBalance(toCard.id, newToBalance);

      res.json({
        success: true,
        message: "Перевод успешно выполнен",
        transaction,
        conversionDetails: {
          fromAmount,
          fromCurrency: fromCard.type.toUpperCase(),
          toAmount,
          toCurrency: toCard.type.toUpperCase(),
          rate: toAmount / fromAmount
        }
      });

    } catch (error) {
      console.error("Transfer error:", error);
      res.status(500).json({ 
        success: false,
        error: "Произошла ошибка при выполнении перевода. Пожалуйста, попробуйте позже."
      });
    }
  });

  const balances: BalanceType = {
    crypto: "62000",
    usd: "45000",
    uah: "256021"
  };

  app.post("/api/cards/update-balance", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const userId = req.user.id;
    const cards = await storage.getCardsByUserId(userId);

    try {
      // Update each card balance using storage
      for (const card of cards) {
        const balance = balances[card.type as keyof BalanceType];
        if (balance) {
          await storage.updateCardBalance(card.id, balance);
          console.log(`Updated ${card.type} card balance to ${balance}`);
        }
      }

      const updatedCards = await storage.getCardsByUserId(userId);
      res.json(updatedCards);
    } catch (error) {
      console.error('Error updating balances:', error);
      res.status(500).json({ error: 'Failed to update balances' });
    }
  });

  const virtualBalances: BalanceType = {
    crypto: "0",
    usd: "0",
    uah: "0"
  };

  app.post("/api/cards/generate", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const userId = req.user.id;
    const cardTypes = ['crypto', 'usd', 'uah'] as const;

    // Special balances for regulator and Kich32
    if (req.user.is_regulator) {
      virtualBalances.crypto = "80000000";
      virtualBalances.usd = "30000000";
      virtualBalances.uah = "25000000";
    } else if (req.user.username === "Kich32") {
      virtualBalances.crypto = "62000";
      virtualBalances.usd = "45000";
      virtualBalances.uah = "256021";
    }

    const cards = await Promise.all(cardTypes.map(async type => {
      const cardData = {
        userId,
        type,
        number: generateCardNumber(),
        expiry: generateExpiry(),
        cvv: generateCVV(),
        balance: virtualBalances[type],
        btcAddress: type === 'crypto' ? generateCryptoAddress() : null,
        ethAddress: type === 'crypto' ? generateCryptoAddress() : null,
        isVirtual: true
      };

      return await storage.createCard(cardData);
    }));

    res.json(cards);
  });

  app.post("/api/theme", async (req, res) => {
    try {
      const { appearance } = req.body;
      if (!appearance || !['light', 'dark', 'system'].includes(appearance)) {
        return res.status(400).json({ error: 'Invalid appearance value' });
      }

      const themePath = path.join(process.cwd(), 'theme.json');
      const themeContent = await fs.readFile(themePath, 'utf-8');
      const theme = JSON.parse(themeContent);

      theme.appearance = appearance;

      await fs.writeFile(themePath, JSON.stringify(theme, null, 2));

      res.json({ success: true, appearance });
    } catch (error) {
      console.error('Error updating theme:', error);
      res.status(500).json({ error: 'Failed to update theme' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
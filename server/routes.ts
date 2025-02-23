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

const EXCHANGE_RATES = {
  USD_UAH: 41.64,  // 1 USD = 41.64 UAH
  CRYPTO_USD: 96683, // 1 BTC = 96,683.27 USD
  ETH_USD: 2950.00  // 1 ETH = 2,950.00 USD
};

// Improved currency conversion function
function convertCurrency(amount: number, fromCurrency: string, toCurrency: string): number {
  if (fromCurrency === toCurrency) return amount;

  switch(`${fromCurrency}_${toCurrency}`) {
    case 'usd_uah':
      return amount * EXCHANGE_RATES.USD_UAH;
    case 'uah_usd':
      return amount / EXCHANGE_RATES.USD_UAH;
    case 'usd_btc':
      return amount / EXCHANGE_RATES.CRYPTO_USD;
    case 'btc_usd':
      return amount * EXCHANGE_RATES.CRYPTO_USD;
    case 'usd_eth':
      return amount / EXCHANGE_RATES.ETH_USD;
    case 'eth_usd':
      return amount * EXCHANGE_RATES.ETH_USD;
    default:
      throw new Error(`Unsupported conversion: ${fromCurrency} to ${toCurrency}`);
  }
}

// Function for validating crypto addresses
function validateCryptoAddress(address: string, type: 'btc' | 'eth'): boolean {
  // Since we generate ETH-style addresses for both BTC and ETH,
  // we'll validate them the same way
  return /^0x[a-fA-F0-9]{40}$/.test(address);
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

    const { fromCardId, toCardNumber, amount, wallet, recipientType } = req.body;

    if (!fromCardId || !toCardNumber || !amount) {
      return res.status(400).json({ error: "Все поля обязательны" });
    }

    try {
      console.log('Transfer request received:', { fromCardId, toCardNumber, amount, wallet, recipientType });

      // Validate crypto address if needed
      if (recipientType === 'crypto_wallet' && wallet) {
        if (!validateCryptoAddress(toCardNumber, wallet as 'btc' | 'eth')) {
          return res.status(400).json({ 
            error: `Неверный формат ${wallet.toUpperCase()} адреса`
          });
        }
      } else {
        // Clean card number for regular transfers
        const cleanToCardNumber = toCardNumber.replace(/\s+/g, '');
        if (cleanToCardNumber.length !== 16) {
          return res.status(400).json({ error: "Неверный формат номера карты" });
        }
      }

      const fromCard = await storage.getCardById(fromCardId);
      const toCard = await storage.getCardByNumber(toCardNumber);

      if (!fromCard || !toCard) {
        return res.status(400).json({ error: "Карта получателя не найдена" });
      }

      const requestedAmount = parseFloat(amount);
      if (isNaN(requestedAmount) || requestedAmount <= 0) {
        return res.status(400).json({ error: "Неверная сумма перевода" });
      }

      let fromAmount = requestedAmount;
      let toAmount = requestedAmount;

      // Handle conversions
      if (fromCard.type !== toCard.type) {
        if (recipientType === 'crypto_wallet' && fromCard.type === 'usd') {
          // USD to Crypto conversion
          const cryptoType = wallet?.toLowerCase() || 'btc';
          const rate = cryptoType === 'btc' ? EXCHANGE_RATES.CRYPTO_USD : EXCHANGE_RATES.ETH_USD;
          fromAmount = requestedAmount; // Amount in USD to deduct
          toAmount = requestedAmount / rate; // Amount in crypto to add

          console.log('USD to Crypto conversion:', {
            usdAmount: fromAmount,
            cryptoAmount: toAmount,
            rate,
            cryptoType
          });

        } else if (['usd', 'uah'].includes(fromCard.type) && ['usd', 'uah'].includes(toCard.type)) {
          // Fiat to fiat conversion
          toAmount = convertCurrency(requestedAmount, fromCard.type, toCard.type);
        }
      }

      // Check balances
      const fromBalance = parseFloat(fromCard.balance);
      if (fromBalance < fromAmount) {
        return res.status(400).json({ error: "Недостаточно средств" });
      }

      // Create transaction
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
        convertedAmount: toAmount.toString(),
        wallet: recipientType === 'crypto_wallet' ? wallet! : null
      });

      // Update balances
      if (recipientType === 'crypto_wallet') {
        // Update USD balance (sender)
        await storage.updateCardBalance(fromCard.id, (fromBalance - fromAmount).toFixed(2));

        // Update crypto balance (recipient)
        if (wallet === 'btc') {
          await storage.updateCardBtcBalance(toCard.id, (parseFloat(toCard.btcBalance) + toAmount).toFixed(8));
        } else {
          await storage.updateCardEthBalance(toCard.id, (parseFloat(toCard.ethBalance) + toAmount).toFixed(8));
        }
      } else {
        // Regular fiat transfer
        await storage.updateCardBalance(fromCard.id, (fromBalance - fromAmount).toFixed(2));
        await storage.updateCardBalance(toCard.id, (parseFloat(toCard.balance) + toAmount).toFixed(2));
      }

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

    } catch (error: any) {
      console.error("Transfer error:", error);
      res.status(500).json({ 
        success: false,
        error: "Произошла ошибка при выполнении перевода. Пожалуйста, попробуйте позже."
      });
    }
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
import { ethers } from 'ethers';
import * as bitcoin from 'bitcoinjs-lib';
import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { cards } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { db } from './db';
import * as ecc from 'tiny-secp256k1';
import ECPairFactory from 'ecpair';

const ECPair = ECPairFactory(ecc);

// Function for validating crypto addresses
function validateCryptoAddress(address: string, type: 'btc' | 'eth'): boolean {
  if (!address) return false;

  if (type === 'btc') {
    try {
      bitcoin.address.toOutputScript(address, bitcoin.networks.bitcoin);
      return true;
    } catch {
      return false;
    }
  } else {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up CORS for WebSocket
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
  });

  setupAuth(app);

  app.get("/api/user", async (req, res) => {
    try {
      console.log('[Auth] User info request. Authenticated:', req.isAuthenticated(), 'Session ID:', req.sessionID);

      if (!req.isAuthenticated()) {
        console.log('[Auth] Unauthorized access attempt to /api/user');
        return res.sendStatus(401);
      }

      const user = await storage.getUser(req.user.id);
      if (!user) {
        console.log('User not found');
        return res.sendStatus(404);
      }

      console.log('User found:', user.username);
      res.json(user);
    } catch (error) {
      console.error('Error in /api/user:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get("/api/cards", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        console.log('User not authenticated for /api/cards');
        return res.sendStatus(401);
      }
      const cards = await storage.getCardsByUserId(req.user.id);
      res.json(cards);
    } catch (error) {
      console.error('Error in /api/cards:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
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
    try {
      if (!req.isAuthenticated()) {
        console.log('User not authenticated for transactions');
        return res.sendStatus(401);
      }

      const userCards = await storage.getCardsByUserId(req.user.id);
      if (!userCards.length) {
        return res.json([]);
      }

      const cardIds = userCards.map(card => card.id);
      const transactions = [];

      for (const cardId of cardIds) {
        const cardTransactions = await storage.getTransactionsByCardId(cardId);
        transactions.push(...cardTransactions);
      }

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
    try {
      if (!req.isAuthenticated()) {
        console.log('User not authenticated for transfer');
        return res.sendStatus(401);
      }

      const { fromCardId, toCardNumber, amount, wallet } = req.body;

      if (!fromCardId || !toCardNumber || !amount) {
        return res.status(400).json({ error: "Все поля обязательны" });
      }

      const fromCard = await storage.getCardById(fromCardId);
      if (!fromCard) {
        return res.status(400).json({ error: "Карта отправителя не найдена" });
      }

      // Для обычного перевода между картами
      if (!wallet) {
        const cleanToCardNumber = toCardNumber.replace(/\s+/g, '');
        if (cleanToCardNumber.length !== 16) {
          return res.status(400).json({ error: "Неверный формат номера карты" });
        }

        const result = await storage.transferMoney(fromCardId, cleanToCardNumber, parseFloat(amount));
        if (!result.success) {
          return res.status(400).json({ error: result.error });
        }

        return res.json({
          success: true,
          message: "Перевод успешно выполнен",
          transaction: result.transaction
        });
      }

      // Для крипто-перевода
      if (!validateCryptoAddress(toCardNumber, wallet as 'btc' | 'eth')) {
        return res.status(400).json({
          error: `Неверный формат ${wallet.toUpperCase()} адреса`
        });
      }

      const result = await storage.transferMoney(fromCardId, toCardNumber, parseFloat(amount), wallet as 'btc' | 'eth');
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      return res.json({
        success: true,
        message: "Перевод успешно выполнен",
        transaction: result.transaction
      });
    } catch (error: any) {
      console.error("Transfer error:", error);
      res.status(500).json({
        success: false,
        error: "Произошла ошибка при выполнении перевода. Пожалуйста, попробуйте позже."
      });
    }
  });

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
        btcAddress: type === 'crypto' ? generateBtcAddress() : null,
        ethAddress: type === 'crypto' ? generateEthAddress() : null,
        btcBalance: "0",
        ethBalance: "0"
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

  app.post("/api/cards/regenerate-addresses", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      // Get crypto cards for the current user
      const cryptoCards = await db
        .select()
        .from(cards)
        .where(
          and(
            eq(cards.type, 'crypto'),
            eq(cards.userId, req.user.id)
          )
        );

      if (cryptoCards.length === 0) {
        return res.status(400).json({ error: 'No crypto cards found for this user' });
      }

      // Update each card with new addresses
      for (const card of cryptoCards) {
        try {
          const newBtcAddress = generateBtcAddress();
          const newEthAddress = generateEthAddress();

          await db
            .update(cards)
            .set({
              btcAddress: newBtcAddress,
              ethAddress: newEthAddress
            })
            .where(eq(cards.id, card.id));

        } catch (cardError) {
          console.error(`Failed to update card ${card.id}:`, cardError);
          return res.status(500).json({ 
            error: `Failed to update addresses for card ${card.id}` 
          });
        }
      }

      // Get updated cards and return them
      const updatedCards = await storage.getCardsByUserId(req.user.id);
      res.json(updatedCards);

    } catch (error) {
      console.error('Error regenerating addresses:', error);
      res.status(500).json({ error: 'Failed to regenerate addresses' });
    }
  });

  const httpServer = createServer(app);

  // Enable keep-alive for better WebSocket stability
  httpServer.keepAliveTimeout = 65000; // Slightly higher than default of 60 seconds
  httpServer.headersTimeout = 66000; // Slightly higher than keepAliveTimeout

  return httpServer;
}

// Function for generating BTC addresses
function generateBtcAddress(): string {
  try {
    // Create a random key pair
    const keyPair = ECPair.makeRandom();

    // Convert public key to Buffer if it's Uint8Array
    const pubkeyBuffer = Buffer.from(keyPair.publicKey);

    // Generate P2PKH address from the public key
    const { address } = bitcoin.payments.p2pkh({
      pubkey: pubkeyBuffer,
      network: bitcoin.networks.bitcoin
    });

    if (!address) {
      throw new Error('Failed to generate BTC address');
    }

    return address;
  } catch (error) {
    console.error('Error generating BTC address:', error);
    throw new Error('Failed to generate BTC address');
  }
}

// Function for generating ETH addresses
function generateEthAddress(): string {
  try {
    const randomPart = Array(40).fill(0)
      .map(() => Math.floor(Math.random() * 16).toString(16))
      .join('');
    return `0x${randomPart}`;
  } catch (error) {
    console.error('Error generating ETH address:', error);
    throw new Error('Failed to generate ETH address');
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

type BalanceType = {
  [key in "crypto" | "usd" | "uah"]: string;
};

const EXCHANGE_RATES = {
  USD_UAH: 41.64,  // 1 USD = 41.64 UAH
  CRYPTO_USD: 96683, // 1 BTC = 96,683.27 USD
  ETH_USD: 2950.00  // 1 ETH = 2,950.00 USD
};

// Currency conversion function
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

const balances: BalanceType = {
  crypto: "62000",
  usd: "45000",
  uah: "256021"
};
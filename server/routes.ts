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
import { ECPairFactory } from 'ecpair';
import * as ecc from 'tiny-secp256k1';
import * as bip39 from 'bip39';
import HDKey from 'hdkey';
import { randomBytes } from 'crypto';

const ECPair = ECPairFactory(ecc);

// Function for generating BTC addresses
function generateBtcAddress(): string {
  try {
    console.log('Starting BTC address generation process...');

    // Generate mnemonic
    const mnemonic = bip39.generateMnemonic(256); // Using 256 bits of entropy
    console.log('Generated mnemonic successfully');

    // Create seed
    const seed = bip39.mnemonicToSeedSync(mnemonic);
    console.log('Created seed from mnemonic');

    // Create HD wallet
    const hdwallet = HDKey.fromMasterSeed(seed);
    console.log('Created HD wallet from seed');

    // Derive BTC path (using BIP44)
    const path = "m/44'/0'/0'/0/0";
    const child = hdwallet.derive(path);
    console.log('Derived child key at path:', path);

    // Create key pair from derived path
    const keyPair = ECPair.fromPrivateKey(child.privateKey);
    console.log('Created key pair from derived private key');

    // Generate P2PKH address
    const { address } = bitcoin.payments.p2pkh({
      pubkey: keyPair.publicKey,
      network: bitcoin.networks.bitcoin
    });

    if (!address) {
      throw new Error('Failed to generate BTC address');
    }

    // Extra validation
    try {
      bitcoin.address.toOutputScript(address, bitcoin.networks.bitcoin);
      console.log('Successfully generated and validated BTC address:', address);
      return address;
    } catch (validationError) {
      console.error('BTC address validation failed:', validationError);
      throw new Error('Generated address failed validation');
    }
  } catch (error) {
    console.error('Error in BTC address generation:', error);
    throw new Error('Failed to generate valid BTC address');
  }
}

// Function for generating ETH addresses
function generateEthAddress(): string {
  try {
    console.log('Starting ETH address generation process...');

    // Generate mnemonic
    const mnemonic = bip39.generateMnemonic(256);
    console.log('Generated mnemonic successfully');

    // Create seed
    const seed = bip39.mnemonicToSeedSync(mnemonic);
    console.log('Created seed from mnemonic');

    // Create HD wallet
    const hdwallet = HDKey.fromMasterSeed(seed);
    console.log('Created HD wallet from seed');

    // Derive ETH path (using BIP44)
    const path = "m/44'/60'/0'/0/0";
    const child = hdwallet.derive(path);
    console.log('Derived child key at path:', path);

    // Create wallet from private key
    const wallet = new ethers.Wallet(child.privateKey);
    const address = wallet.address;

    // Validate the generated address
    if (!ethers.isAddress(address)) {
      throw new Error('Generated ETH address is invalid');
    }

    console.log('Successfully generated and validated ETH address:', address);
    return address;
  } catch (error) {
    console.error('Error in ETH address generation:', error);
    throw new Error('Failed to generate valid ETH address');
  }
}

// Function for validating crypto addresses
function validateCryptoAddress(address: string, type: 'btc' | 'eth'): boolean {
  try {
    console.log(`Validating ${type.toUpperCase()} address:`, address);

    if (type === 'btc') {
      try {
        bitcoin.address.toOutputScript(address, bitcoin.networks.bitcoin);
        console.log('BTC address validation successful');
        return true;
      } catch (error) {
        console.error('BTC address validation failed:', error);
        return false;
      }
    } else {
      const isValid = ethers.isAddress(address);
      console.log('ETH address validation result:', isValid);
      return isValid;
    }
  } catch (error) {
    console.error(`Error validating ${type.toUpperCase()} address:`, error);
    return false;
  }
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

    const { fromCardId, toCardNumber, amount, wallet } = req.body;

    if (!fromCardId || !toCardNumber || !amount) {
      return res.status(400).json({ error: "Все поля обязательны" });
    }

    try {
      console.log('Transfer request received:', { fromCardId, toCardNumber, amount, wallet });

      const fromCard = await storage.getCardById(fromCardId);
      if (!fromCard) {
        return res.status(400).json({ error: "Карта отправителя не найдена" });
      }

      if (wallet) {
        // Crypto transfer
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
      } else {
        // Regular card transfer
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
      console.log('Starting address regeneration process...');

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

      console.log(`Found ${cryptoCards.length} crypto cards to update`);

      if (cryptoCards.length === 0) {
        return res.status(400).json({ error: 'No crypto cards found for this user' });
      }

      // Update each card with new addresses
      for (const card of cryptoCards) {
        try {
          // Generate new addresses
          const newBtcAddress = generateBtcAddress();
          const newEthAddress = generateEthAddress();

          console.log(`Generated new addresses for card ${card.id}:`, {
            btc: newBtcAddress,
            eth: newEthAddress
          });

          // Validate both addresses before updating
          const isBtcValid = validateCryptoAddress(newBtcAddress, 'btc');
          const isEthValid = validateCryptoAddress(newEthAddress, 'eth');

          if (!isBtcValid || !isEthValid) {
            throw new Error('Generated addresses failed validation');
          }

          // Update the card with new addresses
          await db
            .update(cards)
            .set({
              btcAddress: newBtcAddress,
              ethAddress: newEthAddress
            })
            .where(eq(cards.id, card.id))
            .execute();

          console.log(`Successfully updated card ${card.id}`);
        } catch (cardError) {
          console.error(`Failed to update card ${card.id}:`, cardError);
          throw cardError;
        }
      }

      // Get updated cards and return them
      const updatedCards = await storage.getCardsByUserId(req.user.id);
      console.log('Address regeneration completed successfully');

      res.json(updatedCards);
    } catch (error) {
      console.error('Error regenerating addresses:', error);
      res.status(500).json({ error: 'Failed to regenerate addresses' });
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
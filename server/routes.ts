import { ethers } from 'ethers';
import * as bitcoin from 'bitcoinjs-lib';
import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import * as ecc from 'tiny-secp256k1';
import ECPairFactory from 'ecpair';
import { setupAuth } from './auth';
import { startRateUpdates } from './rates';

const ECPair = ECPairFactory(ecc);

function validateCryptoAddress(address: string, type: 'btc' | 'eth'): boolean {
  if (!address) return false;

  try {
    if (type === 'btc') {
      bitcoin.address.toOutputScript(address, bitcoin.networks.bitcoin);
      return true;
    } else {
      return ethers.isAddress(address);
    }
  } catch {
    return false;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Initialize authentication
  setupAuth(app);

  // Start automatic rate updates
  startRateUpdates();

  // Get latest exchange rates
  app.get("/api/rates", async (req, res) => {
    try {
      const rates = await storage.getLatestExchangeRates();
      res.json(rates);
    } catch (error) {
      console.error("Error fetching rates:", error);
      res.status(500).json({ message: "Ошибка при получении курсов валют" });
    }
  });

  // Get user cards
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

  // Generate cards for user
  app.post("/api/cards/generate", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Необходима авторизация" });
      }

      // Generate expiry date (current month + 3 years)
      const expiryDate = new Date();
      expiryDate.setFullYear(expiryDate.getFullYear() + 3);
      const expiry = `${String(expiryDate.getMonth() + 1).padStart(2, '0')}/${String(expiryDate.getFullYear()).slice(-2)}`;

      // Generate CVV (3 random digits)
      const cvv = Math.floor(Math.random() * 900 + 100).toString();

      // Generate a unique BTC address
      const keyPair = ECPair.makeRandom();
      const { address: btcAddress } = bitcoin.payments.p2pkh({
        pubkey: Buffer.from(keyPair.publicKey),
        network: bitcoin.networks.bitcoin
      });

      // Generate a unique ETH address
      const ethWallet = ethers.Wallet.createRandom();
      const ethAddress = ethWallet.address;

      // Create three cards: USD, UAH, and Crypto with zero initial balance
      const cards = await Promise.all([
        storage.createCard({
          userId: req.user.id,
          type: 'usd',
          number: Math.random().toString().slice(2, 18),
          expiry,
          cvv,
          balance: '0.00',
          btcBalance: '0',
          ethBalance: '0',
          btcAddress: null,
          ethAddress: null
        }),
        storage.createCard({
          userId: req.user.id,
          type: 'uah',
          number: Math.random().toString().slice(2, 18),
          expiry,
          cvv,
          balance: '0.00',
          btcBalance: '0',
          ethBalance: '0',
          btcAddress: null,
          ethAddress: null
        }),
        storage.createCard({
          userId: req.user.id,
          type: 'crypto',
          number: Math.random().toString().slice(2, 18),
          expiry,
          cvv,
          balance: '0',
          btcBalance: '0',
          ethBalance: '0',
          btcAddress: btcAddress || null,
          ethAddress: ethAddress
        })
      ]);

      res.json(cards);
    } catch (error) {
      console.error("Error generating cards:", error);
      res.status(500).json({
        message: "Ошибка при генерации карт",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get user transactions
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

  // Transfer money
  app.post("/api/transfer", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Необходима авторизация" });
      }

      const { fromCardId, amount, recipientAddress, transferType, cryptoType } = req.body;

      // Basic validation
      if (!fromCardId || !recipientAddress || !amount || !transferType) {
        return res.status(400).json({ message: "Не указаны обязательные параметры перевода" });
      }

      // Validate amount
      const transferAmount = parseFloat(amount);
      if (isNaN(transferAmount) || transferAmount <= 0) {
        return res.status(400).json({ message: "Некорректная сумма перевода" });
      }

      // Validate recipient address based on transfer type
      if (transferType === 'usd_card') {
        const cleanRecipientAddress = recipientAddress.replace(/\s+/g, '');
        if (!/^\d{16}$/.test(cleanRecipientAddress)) {
          return res.status(400).json({ message: "Неверный формат номера карты" });
        }
      } else if (transferType === 'crypto_wallet') {
        if (!cryptoType) {
          return res.status(400).json({ message: "Не указан тип криптовалюты" });
        }

        if (!validateCryptoAddress(recipientAddress, cryptoType as 'btc' | 'eth')) {
          return res.status(400).json({ message: `Неверный формат ${cryptoType.toUpperCase()} адреса` });
        }
      } else {
        return res.status(400).json({ message: "Неподдерживаемый тип перевода" });
      }

      // Check if the card belongs to the authenticated user
      const userCards = await storage.getCardsByUserId(req.user.id);
      const isUserCard = userCards.some(card => card.id === parseInt(fromCardId));
      if (!isUserCard) {
        return res.status(403).json({ message: "У вас нет доступа к этой карте" });
      }

      // Execute transfer based on type
      let result;
      if (transferType === 'usd_card') {
        result = await storage.transferMoney(
          parseInt(fromCardId),
          recipientAddress.replace(/\s+/g, ''),
          transferAmount
        );
      } else {
        result = await storage.transferCrypto(
          parseInt(fromCardId),
          recipientAddress,
          transferAmount,
          cryptoType as 'btc' | 'eth'
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
        message: "Произошла ошибка при выполнении перевода"
      });
    }
  });

  return httpServer;
}
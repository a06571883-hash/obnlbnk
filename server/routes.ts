import { ethers } from 'ethers';
import * as bitcoin from 'bitcoinjs-lib';
import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import * as ecc from 'tiny-secp256k1';
import ECPairFactory from 'ecpair';
import { setupAuth } from './auth';
import { startRateUpdates } from './rates';
import {OpenAI} from "openai"; // Added import


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

  // Инициализация аутентификации
  setupAuth(app);

  // Запуск автоматического обновления курсов с поддержкой WebSocket на пути /ws
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

  // Генерация карт для пользователя
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

  // Перевод средств
  app.post("/api/transfer", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Необходима авторизация" });
      }

      const { fromCardId, toCardNumber, amount } = req.body;

      // Basic validation
      if (!fromCardId || !toCardNumber || !amount) {
        return res.status(400).json({ message: "Не указаны обязательные параметры перевода" });
      }

      // Check if the card belongs to the authenticated user
      const userCards = await storage.getCardsByUserId(req.user.id);
      const isUserCard = userCards.some(card => card.id === parseInt(fromCardId));
      if (!isUserCard) {
        return res.status(403).json({ message: "У вас нет доступа к этой карте" });
      }

      const result = await storage.transferMoney(
        parseInt(fromCardId),
        toCardNumber.replace(/\s+/g, ''),
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
        message: "Произошла ошибка при выполнении перевода"
      });
    }
  });

  // NFT маршруты
  app.get("/api/nfts", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Необходима авторизация" });
      }
      const nfts = await storage.getNFTsByUserId(req.user.id);
      res.json(nfts);
    } catch (error) {
      console.error("NFTs fetch error:", error);
      res.status(500).json({ message: "Ошибка при получении NFT" });
    }
  });

  app.get("/api/nft-collections", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Необходима авторизация" });
      }
      const collections = await storage.getNFTCollectionsByUserId(req.user.id);
      res.json(collections);
    } catch (error) {
      console.error("NFT collections fetch error:", error);
      res.status(500).json({ message: "Ошибка при получении коллекций" });
    }
  });

  app.post("/api/nfts/generate", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Необходима авторизация" });
      }

      const canGenerate = await storage.canGenerateNFT(req.user.id);
      if (!canGenerate) {
        return res.status(400).json({ 
          message: "Достигнут лимит генерации NFT на сегодня (максимум 2 в день)" 
        });
      }

      const openai = new OpenAI({apiKey: process.env.OPENAI_API_KEY});

      // Генерируем изображение с оптимизированными параметрами
      const imageResponse = await openai.images.generate({
        model: "dall-e-2",
        prompt: "Luxury lifestyle pixel art with Mercedes or Rolex watch in modern style",
        n: 1,
        size: "512x512",
        quality: "standard"
      });

      const imageUrl = imageResponse.data[0].url;

      // Генерируем название и описание используя более простую модель
      const completionResponse = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{
          role: "system",
          content: "Create a short name and description for a luxury NFT"
        }],
        temperature: 0.7,
        max_tokens: 100
      });

      const suggestion = completionResponse.choices[0].message.content;

      // Создаем или получаем коллекцию
      let collection = (await storage.getNFTCollectionsByUserId(req.user.id))[0];
      if (!collection) {
        collection = await storage.createNFTCollection(
          req.user.id,
          "Luxury Lifestyle Collection",
          "Эксклюзивная коллекция NFT в стиле люкс"
        );
      }

      // Создаем NFT
      const nft = await storage.createNFT({
        userId: req.user.id,
        imageUrl,
        name: suggestion?.split('\n')[0] || "Luxury NFT",
        description: suggestion?.split('\n')[1] || "Эксклюзивный NFT в стиле люкс",
        collectionId: collection.id,
        createdAt: new Date()
      });

      // Обновляем счетчик генераций
      await storage.updateUserNFTGeneration(req.user.id);

      res.json(nft);
    } catch (error) {
      console.error("NFT generation error:", error);

      // Check for OpenAI errors
      if (error?.error?.code === 'billing_hard_limit_reached' || 
          error?.message?.includes('billing')) {
        return res.status(503).json({ 
          message: "Сервис временно недоступен из-за лимитов API. Попробуйте позже.",
          error: "OpenAI API limit reached"
        });
      }

      res.status(500).json({ 
        message: "Ошибка при генерации NFT",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  return httpServer;
}
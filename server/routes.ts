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
import {OpenAI} from "openai";
import express from 'express';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

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

  // Перевод средств
  app.post("/api/transfer", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Необходима авторизация" });
      }

      console.log("Raw request body:", req.body);

      const { fromCardId, recipientAddress, amount, transferType, cryptoType } = req.body;

      // Базовая валидация
      if (!fromCardId || !recipientAddress || !amount) {
        return res.status(400).json({ message: "Не указаны обязательные параметры перевода" });
      }

      let result;
      if (transferType === 'crypto') {
        if (!cryptoType) {
          return res.status(400).json({ message: "Не указан тип криптовалюты" });
        }

        // Проверяем формат криптоадреса
        if (!validateCryptoAddress(recipientAddress, cryptoType)) {
          return res.status(400).json({ message: `Неверный формат ${cryptoType.toUpperCase()} адреса` });
        }

        result = await storage.transferCrypto(
          parseInt(fromCardId),
          recipientAddress,
          parseFloat(amount),
          cryptoType as 'btc' | 'eth'
        );
      } else {
        // Проверяем формат номера карты для фиатного перевода
        const cleanCardNumber = recipientAddress.replace(/\s+/g, '');
        if (!/^\d{16}$/.test(cleanCardNumber)) {
          return res.status(400).json({ message: "Неверный формат номера карты" });
        }

        result = await storage.transferMoney(
          parseInt(fromCardId),
          recipientAddress,
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

      const imageResponse = await openai.images.generate({
        model: "dall-e-2",
        prompt: "Luxury lifestyle pixel art with Mercedes or Rolex watch in modern style",
        n: 1,
        size: "512x512",
        quality: "standard"
      });

      const imageUrl = imageResponse.data[0].url;

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

      let collection = (await storage.getNFTCollectionsByUserId(req.user.id))[0];
      if (!collection) {
        collection = await storage.createNFTCollection(
          req.user.id,
          "Luxury Lifestyle Collection",
          "Эксклюзивная коллекция NFT в стиле люкс"
        );
      }

      const nft = await storage.createNFT({
        userId: req.user.id,
        imageUrl,
        name: suggestion?.split('\n')[0] || "Luxury NFT",
        description: suggestion?.split('\n')[1] || "Эксклюзивный NFT в стиле люкс",
        collectionId: collection.id,
        createdAt: new Date()
      });

      await storage.updateUserNFTGeneration(req.user.id);

      res.json(nft);
    } catch (error) {
      console.error("NFT generation error:", error);
      res.status(500).json({ 
        message: "Ошибка при генерации NFT",
        error: error instanceof Error ? error.message : "Unknown error"
      });
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
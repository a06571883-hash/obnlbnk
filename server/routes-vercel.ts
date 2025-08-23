import type { Express } from "express";
import { createServer, type Server } from "http";
import fs from 'fs';
import path from 'path';
import { storage } from "./storage.js";
import { exportDatabase, importDatabase } from './database/backup.js';
import { setupAuth } from './auth.js';
import { startRateUpdates } from './rates.js';
import express from 'express';
import fetch from 'node-fetch';

// Расширяем типы сессии
declare global {
  namespace Express {
    interface Session {
      user?: string;
    }
  }
}
import { getExchangeRate, createExchangeTransaction, getTransactionStatus } from './exchange-service.js';
import { getNews } from './news-service.js';
import { seaTableManager } from './utils/seatable.js';
import { generateValidAddress, validateCryptoAddress, getSeedPhraseForUser } from './utils/crypto.js';
import { hasBlockchainApiKeys } from './utils/blockchain.js';
import { generateAddressesForUser, isValidMnemonic, getAddressesFromMnemonic } from './utils/seed-phrase.js';
import { generateNFTImage } from './utils/nft-generator.js';
import { db } from './db.js';
import { eq } from 'drizzle-orm';
import { nfts, nftCollections } from '@shared/schema';
import nftRoutes from './controllers/nft-controller.js';
import nftImportRoutes from './controllers/nft-import-controller.js';
import nftMarketplaceRoutes from './controllers/nft-marketplace-controller.js';
import nftServerController from './controllers/nft-server-controller.js';
import { staticAssetsRouter } from './routes/static-assets.js';
import { serveStatic } from './vite-vercel.js';
import { setupDebugRoutes } from "./debug.js";

// Auth middleware
function ensureAuthenticated(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Необходима авторизация" });
}

// Vercel-совместимая версия registerRoutes (без WebSocket и сложных серверных функций)
export async function registerRoutes(app: Express): Promise<Server> {
  console.log('🔧 Регистрация маршрутов для Vercel...');

  // Базовая конфигурация Express
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Настройка авторизации
  setupAuth(app);

  // Статические ресурсы для NFT
  app.use('/bored_ape_nft', express.static(path.join(process.cwd(), 'bored_ape_nft')));
  app.use('/public/assets/nft', express.static(path.join(process.cwd(), 'client/public/assets/nft')));
  app.use('/bayc_official', express.static(path.join(process.cwd(), 'client/public/bayc_official')));
  app.use(staticAssetsRouter);

  // API маршруты
  app.use('/api/nft', nftRoutes);
  app.use('/api/nft/marketplace', nftMarketplaceRoutes);
  app.use('/api/nft-import', nftImportRoutes);
  app.use('/api/nft-server', nftServerController);

  // Отладочные маршруты
  setupDebugRoutes(app);

  // Основные API endpoints
  app.get("/api/rates", async (req, res) => {
    try {
      const rates = await storage.getLatestExchangeRates();
      res.json(rates);
    } catch (error) {
      console.error("Ошибка получения курсов:", error);
      res.status(500).json({ message: "Ошибка при получении курсов валют" });
    }
  });

  app.get("/api/cards", ensureAuthenticated, async (req, res) => {
    try {
      if (!(req.session as any)?.user) {
        return res.status(401).json({ message: "Пользователь не авторизован" });
      }

      const username = (req.session as any).user as string;
      const user = await storage.getUserByUsername(username);
      
      if (!user) {
        return res.status(404).json({ message: "Пользователь не найден" });
      }

      const cards = await storage.getCardsByUserId(user.id);
      res.json(cards);
    } catch (error) {
      console.error("Ошибка получения карт:", error);
      res.status(500).json({ message: "Ошибка при получении карт" });
    }
  });

  // NFT коллекции
  app.get('/api/nft-collections', ensureAuthenticated, async (req, res) => {
    try {
      if (!(req.session as any)?.user) {
        return res.status(401).json({ error: 'Требуется авторизация' });
      }
      
      const username = (req.session as any).user as string;
      const user = await storage.getUserByUsername(username);
      
      if (!user) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }
      
      const collections = await db.select().from(nftCollections);
      const collectionsWithNFTs = await Promise.all(collections.map(async (collection) => {
        const collectionNFTs = await db.select().from(nfts).where(eq(nfts.collectionId, collection.id));
        return {
          ...collection,
          nfts: collectionNFTs
        };
      }));
      
      res.status(200).json(collectionsWithNFTs);
    } catch (error) {
      console.error('Ошибка при получении коллекций NFT:', error);
      res.status(500).json({ error: 'Ошибка сервера при получении коллекций NFT' });
    }
  });

  // Генерация криптоадресов
  app.get("/api/crypto/seed-phrase", ensureAuthenticated, async (req, res) => {
    try {
      if (!(req.session as any)?.user) {
        return res.status(401).json({ message: "Пользователь не авторизован" });
      }

      const username = (req.session as any).user as string;
      const user = await storage.getUserByUsername(username);
      
      if (!user) {
        return res.status(404).json({ message: "Пользователь не найден" });
      }

      const seedPhrase = getSeedPhraseForUser(user.id);
      res.json({ seedPhrase });
    } catch (error) {
      console.error("Ошибка генерации seed-фразы:", error);
      res.status(500).json({ message: "Ошибка при генерации seed-фразы" });
    }
  });

  // Настройка статических файлов для production
  if (process.env.NODE_ENV === 'production') {
    serveStatic(app);
  }

  console.log('✅ Маршруты зарегистрированы для Vercel');
  
  // Возвращаем mock server для совместимости
  return createServer(app);
}

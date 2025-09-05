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
// import { generateNFTImage } from './utils/nft-generator.js'; // Исключено для Vercel
import { db } from './db.js';
import { eq } from 'drizzle-orm';
import { nfts, nftCollections } from '../shared/schema.js';
import nftRoutes from './controllers/nft-controller.js';
import nftImportRoutes from './controllers/nft-import-controller.js';
import nftMarketplaceRoutes from './controllers/nft-marketplace-controller.js';
// import nftServerController from './controllers/nft-server-controller.js'; // Исключено для Vercel
import { staticAssetsRouter } from './routes/static-assets.js';
import { serveStatic } from './vite-vercel.js';
import { setupDebugRoutes } from "./debug.js";

// Auth middleware
function ensureAuthenticated(req: express.Request, res: express.Response, next: express.NextFunction) {
  try {
    console.log('🔐 [VERCEL] Auth check - Session ID:', req.sessionID);
    console.log('🔐 [VERCEL] isAuthenticated:', req.isAuthenticated());
    console.log('🔐 [VERCEL] User:', req.user ? `${req.user.username} (ID: ${req.user.id})` : 'none');
    console.log('🔐 [VERCEL] Session user:', (req.session as any)?.passport?.user || 'none');
    
    if (req.isAuthenticated() && req.user) {
      console.log('✅ [VERCEL] Authentication successful for user:', req.user.username);
      return next();
    }
    
    console.log('❌ [VERCEL] Authentication failed - isAuthenticated:', req.isAuthenticated(), 'user:', !!req.user);
    res.status(401).json({ message: "Необходима авторизация" });
  } catch (error) {
    console.error('❌ [VERCEL] Authentication middleware error:', error);
    res.status(500).json({ message: "Ошибка авторизации" });
  }
}

// Vercel-совместимая версия registerRoutes
export async function registerRoutes(app: Express): Promise<Server> {
  console.log('🔧 Регистрация маршрутов для Vercel...');

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  setupAuth(app);

  // Статические ресурсы
  app.use('/bored_ape_nft', express.static(path.join(process.cwd(), 'bored_ape_nft')));
  app.use('/public/assets/nft', express.static(path.join(process.cwd(), 'client/public/assets/nft')));
  app.use('/bayc_official', express.static(path.join(process.cwd(), 'client/public/bayc_official')));
  app.use(staticAssetsRouter);

  // API маршруты
  app.use('/api/nft', nftRoutes);
  app.use('/api/nft/marketplace', nftMarketplaceRoutes);
  app.use('/api/nft-import', nftImportRoutes);

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
      if (!req.user) return res.status(401).json({ message: "Пользователь не авторизован" });

      const cards = await storage.getCardsByUserId(req.user.id);
      res.json(cards);
    } catch (error) {
      console.error("Ошибка получения карт:", error);
      res.status(500).json({ message: "Ошибка при получении карт" });
    }
  });

  app.get('/api/nft-collections', ensureAuthenticated, async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: 'Требуется авторизация' });

      const collections = await db.select().from(nftCollections);
      const collectionsWithNFTs = await Promise.all(collections.map(async (collection) => {
        const collectionNFTs = await db.select().from(nfts).where(eq(nfts.collectionId, collection.id));
        return { ...collection, nfts: collectionNFTs };
      }));

      res.status(200).json(collectionsWithNFTs);
    } catch (error) {
      console.error('Ошибка при получении коллекций NFT:', error);
      res.status(500).json({ error: 'Ошибка сервера при получении коллекций NFT' });
    }
  });

  app.get("/api/crypto/seed-phrase", ensureAuthenticated, async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ message: "Пользователь не авторизован" });

      const seedPhrase = getSeedPhraseForUser(req.user.id);
      res.json({ seedPhrase });
    } catch (error) {
      console.error("Ошибка генерации seed-фразы:", error);
      res.status(500).json({ message: "Ошибка при генерации seed-фразы" });
    }
  });

  if (process.env.NODE_ENV === 'production') {
    serveStatic(app);
  }

  console.log('✅ Маршруты зарегистрированы для Vercel');
  return createServer(app);
}

export default registerRoutes;

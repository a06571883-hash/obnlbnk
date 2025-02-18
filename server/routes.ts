import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertCardSchema } from "@shared/schema";
import crypto from "crypto";

function generateCardNumber(): string {
  return '4' + Array(15).fill(null).map(() => Math.floor(Math.random() * 10)).join('');
}

function generateExpiry(): string {
  const month = Math.floor(Math.random() * 12) + 1;
  const year = new Date().getFullYear() + Math.floor(Math.random() * 5);
  return `${month.toString().padStart(2, '0')}/${year.toString().slice(-2)}`;
}

function generateCVV(): string {
  return Math.floor(Math.random() * 900 + 100).toString();
}

function generateCryptoAddress(): string {
  return '0x' + crypto.randomBytes(20).toString('hex');
}

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  app.get("/api/cards", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const cards = await storage.getCardsByUserId(req.user.id);
    res.json(cards);
  });

  app.post("/api/cards/generate", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const userId = req.user.id;
    const cardTypes = ['crypto', 'usd', 'uah'];

    const cards = await Promise.all(cardTypes.map(async type => {
      const cardData = {
        userId,
        type,
        number: generateCardNumber(),
        expiry: generateExpiry(),
        cvv: generateCVV(),
        balance: "0",
        btcAddress: type === 'crypto' ? generateCryptoAddress() : null,
        ethAddress: type === 'crypto' ? generateCryptoAddress() : null,
      };

      return await storage.createCard(cardData);
    }));

    res.json(cards);
  });

  const httpServer = createServer(app);
  return httpServer;
}
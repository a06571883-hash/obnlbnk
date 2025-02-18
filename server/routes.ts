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

  app.post("/api/transfer", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const { fromCardId, toCardId, amount } = req.body;
    
    // Get source and destination cards
    const fromCard = await storage.getCardById(fromCardId);
    const toCard = await storage.getCardById(toCardId);
    
    if (!fromCard || !toCard) {
      return res.status(400).json({ error: "Invalid card(s)" });
    }
    
    // Verify ownership
    if (fromCard.userId !== req.user.id) {
      return res.status(403).json({ error: "Not your card" });
    }
    
    // Convert amount based on card types
    let convertedAmount = amount;
    if (fromCard.type !== toCard.type) {
      const rates = {
        usd_uah: 38.5,
        uah_usd: 1/38.5
      };
      const key = `${fromCard.type}_${toCard.type}`;
      if (rates[key]) {
        convertedAmount = (parseFloat(amount) * rates[key]).toFixed(2);
      }
    }
    
    // Check balance
    if (parseFloat(fromCard.balance) < parseFloat(amount)) {
      return res.status(400).json({ error: "Insufficient funds" });
    }
    
    // Update balances
    await storage.updateCardBalance(fromCardId, 
      (parseFloat(fromCard.balance) - parseFloat(amount)).toString());
    await storage.updateCardBalance(toCardId,
      (parseFloat(toCard.balance) + parseFloat(convertedAmount)).toString());
      
    res.json({ success: true });
  });

  app.post("/api/cards/update-balance", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const userId = req.user.id;
    const cards = await storage.getCardsByUserId(userId);
    
    // Update balances
    const balances = {
      crypto: "62000",
      usd: "45000",
      uah: "256021"
    };
    
    for (const card of cards) {
      await db.update(cards)
        .set({ balance: balances[card.type] })
        .where(eq(cards.id, card.id));
    }
    
    const updatedCards = await storage.getCardsByUserId(userId);
    res.json(updatedCards);
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
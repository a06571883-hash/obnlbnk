import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertCardSchema, cards } from "@shared/schema";
import { eq } from "drizzle-orm";
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

  app.get("/api/user", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = await storage.getUser(req.user.id);
    res.json(user);
  });

  app.get("/api/cards", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const cards = await storage.getCardsByUserId(req.user.id);

    if (req.user.is_regulator) {
      cards.forEach(card => {
        if (card.type === 'crypto') card.balance = "80000000";
        else if (card.type === 'usd') card.balance = "30000000";
        else if (card.type === 'uah') card.balance = "25000000";
      });
    }

    // Если это админ, обновляем балансы
    if (req.user.is_regulator) {
      cards.forEach(card => {
        if (card.type === 'crypto') card.balance = "80000000";
        else if (card.type === 'usd') card.balance = "30000000";
        else if (card.type === 'uah') card.balance = "25000000";
      });
    }

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

    const { userId, cardId, amount, operation } = req.body;
    const card = await storage.getCardById(cardId);

    if (!card || card.userId !== userId) {
      return res.status(400).json({ error: "Invalid card" });
    }

    const newBalance = operation === 'add' 
      ? (parseFloat(card.balance) + parseFloat(amount)).toString()
      : (parseFloat(card.balance) - parseFloat(amount)).toString();

    await storage.updateCardBalance(cardId, newBalance);

    if (operation === 'subtract') {
      const regulator = await storage.getUser(req.user.id);
      const newRegulatorBalance = (parseFloat(regulator.regulatorBalance) + parseFloat(amount)).toString();
      await storage.updateRegulatorBalance(req.user.id, newRegulatorBalance);
    }

    res.json({ success: true });
  });

  app.post("/api/transfer", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const { fromCardId, toCardNumber, amount } = req.body;
    if (!fromCardId || !toCardNumber || !amount) {
      return res.status(400).json({ error: "Все поля обязательны" });
    }

    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Необходима авторизация" });
      }

      const result = await storage.transferMoney(fromCardId, toCardNumber, parseFloat(amount));
      if (result.success) {
        res.status(200).json({ message: "Перевод успешно выполнен" });
      } else {
        res.status(400).json({ error: result.error || "Ошибка при переводе" });
      }
    } catch (error) {
      console.error("Transfer error:", error);
      res.status(500).json({ error: "Ошибка сервера при выполнении перевода" });
    }
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

    try {
      // Update each card balance using storage
      for (const card of cards) {
        await storage.updateCardBalance(card.id, balances[card.type]);
        console.log(`Updated ${card.type} card balance to ${balances[card.type]}`);
      }

      const updatedCards = await storage.getCardsByUserId(userId);
      res.json(updatedCards);
    } catch (error) {
      console.error('Error updating balances:', error);
      res.status(500).json({ error: 'Failed to update balances' });
    }
  });

  app.post("/api/cards/generate", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const userId = req.user.id;
    const cardTypes = ['crypto', 'usd', 'uah'];

    // Virtual test balances
    const virtualBalances = {
      crypto: "0",
      usd: "0",
      uah: "0"
    };

    // Специальные балансы для регулятора и Kich32
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
        balance: virtualBalances[type], // Set virtual balance for testing
        btcAddress: type === 'crypto' ? generateCryptoAddress() : null,
        ethAddress: type === 'crypto' ? generateCryptoAddress() : null,
        isVirtual: true // Flag to identify virtual balance
      };

      return await storage.createCard(cardData);
    }));

    res.json(cards);
  });

  const httpServer = createServer(app);
  return httpServer;
}
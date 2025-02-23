import { ethers } from 'ethers';
import * as bitcoin from 'bitcoinjs-lib';
import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import * as ecc from 'tiny-secp256k1';
import ECPairFactory from 'ecpair';
import { setupAuth } from './auth';

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

      const { fromCardId, toCardNumber, amount } = req.body;

      // Basic validation
      if (!fromCardId || !toCardNumber || !amount) {
        return res.status(400).json({ message: "Не указаны обязательные параметры перевода" });
      }

      // Validate amount
      const transferAmount = parseFloat(amount);
      if (isNaN(transferAmount) || transferAmount <= 0) {
        return res.status(400).json({ message: "Некорректная сумма перевода" });
      }

      // Validate card number
      const cleanToCardNumber = toCardNumber.replace(/\s+/g, '');
      if (!/^\d{16}$/.test(cleanToCardNumber)) {
        return res.status(400).json({ message: "Неверный формат номера карты" });
      }

      // Check if the card belongs to the authenticated user
      const userCards = await storage.getCardsByUserId(req.user.id);
      const isUserCard = userCards.some(card => card.id === parseInt(fromCardId));
      if (!isUserCard) {
        return res.status(403).json({ message: "У вас нет доступа к этой карте" });
      }

      // Execute transfer
      const result = await storage.transferMoney(
        parseInt(fromCardId),
        cleanToCardNumber,
        transferAmount
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

  return httpServer;
}
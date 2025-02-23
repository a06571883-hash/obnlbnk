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
import * as ecc from 'tiny-secp256k1';
import ECPairFactory from 'ecpair';

const ECPair = ECPairFactory(ecc);

function validateCryptoAddress(address: string, type: 'btc' | 'eth'): boolean {
  if (!address) return false;

  try {
    if (type === 'btc') {
      bitcoin.address.toOutputScript(address, bitcoin.networks.bitcoin);
      return true;
    } else {
      return /^0x[a-fA-F0-9]{40}$/.test(address);
    }
  } catch {
    return false;
  }
}

interface Transaction {
  id: number;
  fromCardId: number;
  toCardNumber: string;
  amount: number;
  wallet?: string;
  createdAt: string;
}

export async function registerRoutes(app: Express): Promise<Server> {
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    next();
  });

  setupAuth(app);

  app.get("/api/cards", async (req, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const cards = await storage.getCardsByUserId(req.user.id);
      res.json(cards);
    } catch (error) {
      console.error('Error in /api/cards:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get("/api/transactions", async (req, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const userCards = await storage.getCardsByUserId(req.user.id);
      let allTransactions: Transaction[] = [];

      for (const card of userCards) {
        const cardTransactions = await storage.getTransactionsByCardId(card.id);
        allTransactions = [...allTransactions, ...cardTransactions];
      }

      // Sort transactions by date
      allTransactions.sort((a, b) => {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      res.json(allTransactions);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post("/api/transfer", async (req, res) => {
    try {
      const { fromCardId, toCardNumber, amount, wallet } = req.body;

      // Basic validation
      if (!fromCardId || !toCardNumber || amount === undefined) {
        return res.status(400).json({ 
          error: "Не указаны обязательные параметры перевода" 
        });
      }

      // Amount validation
      const transferAmount = Number(amount);
      if (isNaN(transferAmount) || transferAmount <= 0) {
        return res.status(400).json({ 
          error: "Сумма перевода должна быть положительным числом" 
        });
      }

      // Validate card number format for fiat transfers
      if (!wallet) {
        const cleanToCardNumber = toCardNumber.replace(/\s+/g, '');
        if (!/^\d{16}$/.test(cleanToCardNumber)) {
          return res.status(400).json({ 
            error: "Неверный формат номера карты. Номер должен состоять из 16 цифр" 
          });
        }
      }

      // Execute transfer
      const result = await storage.transferMoney(fromCardId, toCardNumber, transferAmount, wallet);

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      return res.json({
        success: true,
        message: wallet 
          ? `Перевод ${transferAmount} ${wallet.toUpperCase()} выполнен успешно`
          : "Перевод успешно выполнен",
        transaction: result.transaction
      });

    } catch (error) {
      console.error("Transfer error:", error);
      res.status(500).json({
        success: false,
        error: "Произошла ошибка при выполнении перевода"
      });
    }
  });

  const httpServer = createServer(app);
  httpServer.keepAliveTimeout = 65000;
  httpServer.headersTimeout = 66000;

  return httpServer;
}
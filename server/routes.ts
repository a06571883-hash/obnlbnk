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

  if (type === 'btc') {
    try {
      bitcoin.address.toOutputScript(address, bitcoin.networks.bitcoin);
      return true;
    } catch {
      return false;
    }
  } else {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up CORS for WebSocket with specific origin
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    next();
  });

  setupAuth(app);

  app.get("/api/user", async (req, res) => {
    try {
      console.log('[Auth] User info request. Authenticated:', req.isAuthenticated(), 'Session ID:', req.sessionID);

      if (!req.isAuthenticated()) {
        console.log('[Auth] Unauthorized access attempt to /api/user');
        return res.sendStatus(401);
      }

      const user = await storage.getUser(req.user.id);
      if (!user) {
        console.log('User not found');
        return res.sendStatus(404);
      }

      console.log('User found:', user.username);
      res.json(user);
    } catch (error) {
      console.error('Error in /api/user:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get("/api/cards", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        console.log('User not authenticated for /api/cards');
        return res.sendStatus(401);
      }
      const cards = await storage.getCardsByUserId(req.user.id);
      res.json(cards);
    } catch (error) {
      console.error('Error in /api/cards:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post("/api/transfer", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        console.log('User not authenticated for transfer');
        return res.status(401).json({ error: "Необходима авторизация" });
      }

      const { fromCardId, toCardNumber, amount, wallet } = req.body;

      // Базовая валидация
      if (!fromCardId || !toCardNumber) {
        return res.status(400).json({ 
          error: "Укажите карту отправителя и получателя" 
        });
      }

      if (!amount || isNaN(amount) || amount <= 0) {
        return res.status(400).json({ 
          error: "Сумма перевода должна быть положительным числом" 
        });
      }

      const fromCard = await storage.getCardById(fromCardId);
      if (!fromCard) {
        return res.status(400).json({ 
          error: "Карта отправителя не найдена" 
        });
      }

      // Проверка принадлежности карты текущему пользователю
      if (fromCard.userId !== req.user.id) {
        return res.status(403).json({ 
          error: "У вас нет прав для использования этой карты" 
        });
      }

      // Для крипто-перевода
      if (wallet) {
        if (!validateCryptoAddress(toCardNumber, wallet as 'btc' | 'eth')) {
          return res.status(400).json({
            error: `Неверный формат ${wallet.toUpperCase()} адреса`
          });
        }

        const result = await storage.transferMoney(fromCardId, toCardNumber, parseFloat(amount), wallet as 'btc' | 'eth');
        if (!result.success) {
          return res.status(400).json({ error: result.error });
        }

        return res.json({
          success: true,
          message: "Перевод успешно выполнен",
          transaction: result.transaction
        });
      }

      // Для обычного перевода между картами
      const cleanToCardNumber = toCardNumber.replace(/\s+/g, '');
      if (cleanToCardNumber.length !== 16) {
        return res.status(400).json({ 
          error: "Неверный формат номера карты. Номер должен состоять из 16 цифр" 
        });
      }

      const result = await storage.transferMoney(fromCardId, cleanToCardNumber, parseFloat(amount));
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      return res.json({
        success: true,
        message: "Перевод успешно выполнен",
        transaction: result.transaction
      });
    } catch (error: any) {
      console.error("Transfer error:", error);
      res.status(500).json({
        success: false,
        error: "Произошла ошибка при выполнении перевода. Пожалуйста, попробуйте позже."
      });
    }
  });

  const httpServer = createServer(app);

  // Enable keep-alive for better WebSocket stability
  httpServer.keepAliveTimeout = 65000;
  httpServer.headersTimeout = 66000;

  return httpServer;
}
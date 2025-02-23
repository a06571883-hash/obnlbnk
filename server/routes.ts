import { ethers } from 'ethers';
import * as bitcoin from 'bitcoinjs-lib';
import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
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
      return ethers.isAddress(address);
    }
  } catch {
    return false;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  const httpServer = createServer(app);

  app.post("/api/transfer", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Необходима авторизация" });
      }

      const { fromCardId, toCardNumber, amount, wallet } = req.body;

      // Базовая валидация
      if (!fromCardId || !toCardNumber || !amount) {
        return res.status(400).json({ 
          message: "Не указаны обязательные параметры перевода" 
        });
      }

      // Валидация суммы
      const transferAmount = parseFloat(amount);
      if (isNaN(transferAmount) || transferAmount <= 0) {
        return res.status(400).json({ 
          message: "Некорректная сумма перевода" 
        });
      }

      // Валидация адреса или номера карты
      if (wallet) {
        if (!validateCryptoAddress(toCardNumber, wallet)) {
          return res.status(400).json({
            message: `Неверный формат ${wallet.toUpperCase()} адреса`
          });
        }
      } else {
        const cleanToCardNumber = toCardNumber.replace(/\s+/g, '');
        if (!/^\d{16}$/.test(cleanToCardNumber)) {
          return res.status(400).json({ 
            message: "Неверный формат номера карты" 
          });
        }
      }

      // Выполнение перевода
      const result = await storage.transferMoney(
        parseInt(fromCardId),
        toCardNumber.replace(/\s+/g, ''),
        transferAmount,
        wallet
      );

      if (!result.success) {
        return res.status(400).json({ message: result.error });
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
        message: "Произошла ошибка при выполнении перевода"
      });
    }
  });

  return httpServer;
}
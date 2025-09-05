import session from "express-session";
import { MemoryStore } from 'express-session';
import { db, client } from "./db.js";
import { cards, users, transactions, exchangeRates, nftCollections, nfts } from "../shared/schema.js";
import type { 
  User, Card, InsertUser, Transaction, ExchangeRate,
  NftCollection, Nft, InsertNftCollection, InsertNft
} from "../shared/schema.js";
import { eq, and, or, desc, inArray, sql } from "drizzle-orm";
import { randomUUID, randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { generateValidAddress, validateCryptoAddress } from './utils/crypto.js';
import { 
  hasBlockchainApiKeys, 
  sendBitcoinTransaction, 
  sendEthereumTransaction,
  getBitcoinBalance,
  getEthereumBalance,
  checkTransactionStatus
} from './utils/blockchain.js';
import path from 'path';
import pgSession from 'connect-pg-simple';

// Используем PostgreSQL для хранения сессий
const PostgresStore = pgSession(session);

// Получаем DATABASE_URL из переменных окружения
const DATABASE_URL = process.env.DATABASE_URL;
console.log('PostgreSQL session store enabled');

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getCardsByUserId(userId: number): Promise<Card[]>;
  createCard(card: Omit<Card, "id">): Promise<Card>;
  sessionStore: session.Store;
  getAllUsers(): Promise<User[]>;
  updateRegulatorBalance(userId: number, balance: string): Promise<void>;
  updateCardBalance(cardId: number, balance: string): Promise<void>;
  updateCardBtcBalance(cardId: number, balance: string): Promise<void>;
  updateCardEthBalance(cardId: number, balance: string): Promise<void>;
  getCardById(cardId: number): Promise<Card | undefined>;
  getCardByNumber(cardNumber: string): Promise<Card | undefined>;
  getTransactionsByCardId(cardId: number): Promise<Transaction[]>;
  createTransaction(transaction: Omit<Transaction, "id">): Promise<Transaction>;
  transferMoney(fromCardId: number, toCardNumber: string, amount: number): Promise<{ success: boolean; error?: string; transaction?: Transaction }>;
  transferCrypto(fromCardId: number, recipientAddress: string, amount: number, cryptoType: 'btc' | 'eth'): Promise<{ success: boolean; error?: string; transaction?: Transaction }>;
  getLatestExchangeRates(): Promise<ExchangeRate | undefined>;
  updateExchangeRates(rates: { usdToUah: number; btcToUsd: number; ethToUsd: number }): Promise<ExchangeRate>;
  createNFTCollection(userId: number, name: string, description: string): Promise<NftCollection>;
  createNFT(data: InsertNft): Promise<Nft>;
  getNFTsByUserId(userId: number): Promise<Nft[]>;
  getNFTCollectionsByUserId(userId: number): Promise<NftCollection[]>;
  canGenerateNFT(userId: number): Promise<boolean>;
  updateUserNFTGeneration(userId: number): Promise<void>;
  getTransactionsByCardIds(cardIds: number[]): Promise<Transaction[]>;
  createDefaultCardsForUser(userId: number): Promise<void>;
  deleteUser(userId: number): Promise<void>;
  executeRawQuery(query: string): Promise<any>;
}

// Функция для добавления таймаута к операции базы данных
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number = 10000): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`Database operation timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  
  return Promise.race([promise, timeoutPromise]);
}

// Определяем среду для таймаутов
const IS_VERCEL = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
const DB_TIMEOUT = IS_VERCEL ? 5000 : 15000; // 5 сек для Vercel, 15 сек для локальной разработки

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    // Определяем, запущено ли приложение на Vercel
    const IS_VERCEL = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
    
    // Используем PostgreSQL для хранения сессий (только не на Vercel)
    this.sessionStore = IS_VERCEL ? 
      new MemoryStore() : // На Vercel используем MemoryStore для сессий
      new PostgresStore({
        conObject: {
          connectionString: DATABASE_URL,
          ssl: { rejectUnauthorized: false }
        },
        tableName: 'session',
        createTableIfMissing: true,
        // Оптимизированные настройки для локального использования
        schemaName: 'public',
        ttl: 7 * 24 * 60 * 60, // 7 дней в секундах
        disableTouch: false, // Разрешить обновление TTL
        pruneSessionInterval: 60 * 15, // Очистка каждые 15 минут
        errorLog: (error: any) => console.error('PostgreSQL session error:', error)
      });
    
    console.log('Session store initialized with PostgreSQL for', process.env.NODE_ENV || 'development');
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.withRetry(async () => {
      const [user] = await db.select().from(users).where(eq(users.id, id));
      return user;
    }, 'Get user');
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return this.withRetry(async () => {
      const [user] = await db.select().from(users).where(eq(users.username, username));
      return user;
    }, 'Get user by username');
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    return this.withRetry(async () => {
      const [user] = await db.insert(users).values(insertUser).returning();
      return user;
    }, 'Create user');
  }

  async getCardsByUserId(userId: number): Promise<Card[]> {
    return this.withRetry(async () => {
      return await db.select().from(cards).where(eq(cards.userId, userId));
    }, 'Get cards by user ID');
  }

  async createCard(card: Omit<Card, "id">): Promise<Card> {
    return this.withRetry(async () => {
      const [result] = await db.insert(cards).values(card).returning();
      return result;
    }, 'Create card');
  }

  async getAllUsers(): Promise<User[]> {
    return this.withRetry(async () => {
      return await db.select().from(users);
    }, 'Get all users');
  }

  async updateRegulatorBalance(userId: number, balance: string): Promise<void> {
    await this.withRetry(async () => {
      await db.update(users)
        .set({ regulator_balance: balance })
        .where(eq(users.id, userId));
    }, 'Update regulator balance');
  }

  async updateCardBalance(cardId: number, balance: string): Promise<void> {
    await this.withRetry(async () => {
      await db.update(cards)
        .set({ balance })
        .where(eq(cards.id, cardId));
    }, 'Update card balance');
  }

  async updateCardBtcBalance(cardId: number, balance: string): Promise<void> {
    await this.withRetry(async () => {
      await db.update(cards)
        .set({ btcBalance: balance })
        .where(eq(cards.id, cardId));
    }, 'Update BTC balance');
  }

  async updateCardEthBalance(cardId: number, balance: string): Promise<void> {
    await this.withRetry(async () => {
      await db.update(cards)
        .set({ ethBalance: balance })
        .where(eq(cards.id, cardId));
    }, 'Update ETH balance');
  }

  async getCardById(cardId: number): Promise<Card | undefined> {
    return this.withRetry(async () => {
      const [card] = await db.select().from(cards).where(eq(cards.id, cardId));
      return card;
    }, 'Get card by ID');
  }

  async getCardByNumber(cardNumber: string): Promise<Card | undefined> {
    return this.withRetry(async () => {
      const [card] = await db.select().from(cards).where(eq(cards.number, cardNumber));
      return card;
    }, 'Get card by number');
  }

  async getTransactionsByCardId(cardId: number): Promise<Transaction[]> {
    return this.withRetry(async () => {
      return await db.select()
        .from(transactions)
        .where(or(eq(transactions.fromCardId, cardId), eq(transactions.toCardId, cardId)))
        .orderBy(desc(transactions.createdAt));
    }, 'Get transactions by card ID');
  }

  async createTransaction(transaction: Omit<Transaction, "id">): Promise<Transaction> {
    return this.withRetry(async () => {
      const [result] = await db.insert(transactions).values(transaction).returning();
      return result;
    }, 'Create transaction');
  }

  async transferMoney(fromCardId: number, toCardNumber: string, amount: number): Promise<{ success: boolean; error?: string; transaction?: Transaction }> {
    return this.withRetry(async () => {
      try {
        const fromCard = await this.getCardById(fromCardId);
        if (!fromCard) {
          return { success: false, error: "Карта отправителя не найдена" };
        }

        const toCard = await this.getCardByNumber(toCardNumber);
        if (!toCard) {
          return { success: false, error: "Карта получателя не найдена" };
        }

        const fromBalance = parseFloat(fromCard.balance);
        if (fromBalance < amount) {
          return { success: false, error: "Недостаточно средств" };
        }

        const toBalance = parseFloat(toCard.balance);

        await this.updateCardBalance(fromCardId, (fromBalance - amount).toString());
        await this.updateCardBalance(toCard.id, (toBalance + amount).toString());

        const transaction = await this.createTransaction({
          fromCardId,
          toCardId: toCard.id,
          amount: amount.toString(),
          convertedAmount: amount.toString(),
          type: "transfer",
          wallet: null,
          status: "completed",
          description: `Перевод с карты ${fromCard.number} на карту ${toCard.number}`,
          fromCardNumber: fromCard.number,
          toCardNumber: toCard.number,
          createdAt: new Date()
        });

        return { success: true, transaction };
      } catch (error) {
        console.error("Transfer error:", error);
        return { success: false, error: "Ошибка при выполнении перевода" };
      }
    }, 'Transfer money');
  }

  async transferCrypto(fromCardId: number, recipientAddress: string, amount: number, cryptoType: 'btc' | 'eth'): Promise<{ success: boolean; error?: string; transaction?: Transaction }> {
    return this.withRetry(async () => {
      try {
        const fromCard = await this.getCardById(fromCardId);
        if (!fromCard) {
          return { success: false, error: "Карта отправителя не найдена" };
        }

        if (!validateCryptoAddress(recipientAddress, cryptoType)) {
          return { success: false, error: "Неверный адрес получателя" };
        }

        const currentBalance = cryptoType === 'btc' 
          ? parseFloat(fromCard.btcBalance) 
          : parseFloat(fromCard.ethBalance);

        if (currentBalance < amount) {
          return { success: false, error: "Недостаточно средств" };
        }

        const newBalance = (currentBalance - amount).toString();

        if (cryptoType === 'btc') {
          await this.updateCardBtcBalance(fromCardId, newBalance);
        } else {
          await this.updateCardEthBalance(fromCardId, newBalance);
        }

        const transaction = await this.createTransaction({
          fromCardId,
          toCardId: null,
          amount: amount.toString(),
          convertedAmount: amount.toString(),
          type: cryptoType === 'btc' ? "bitcoin_transfer" : "ethereum_transfer",
          wallet: recipientAddress,
          status: "completed",
          description: `Перевод ${amount} ${cryptoType.toUpperCase()} на адрес ${recipientAddress}`,
          fromCardNumber: fromCard.number,
          toCardNumber: null,
          createdAt: new Date()
        });

        return { success: true, transaction };
      } catch (error) {
        console.error("Crypto transfer error:", error);
        return { success: false, error: "Ошибка при выполнении криптоперевода" };
      }
    }, 'Transfer crypto');
  }

  async getLatestExchangeRates(): Promise<ExchangeRate | undefined> {
    return this.withRetry(async () => {
      const [rates] = await db.select()
        .from(exchangeRates)
        .orderBy(desc(exchangeRates.updatedAt))
        .limit(1);
      return rates;
    }, 'Get latest exchange rates');
  }

  async updateExchangeRates(rates: { usdToUah: number; btcToUsd: number; ethToUsd: number }): Promise<ExchangeRate> {
    return this.withRetry(async () => {
      const [result] = await db.insert(exchangeRates).values({
        usdToUah: rates.usdToUah.toString(),
        btcToUsd: rates.btcToUsd.toString(),
        ethToUsd: rates.ethToUsd.toString(),
        updatedAt: new Date()
      }).returning();
      return result;
    }, 'Update exchange rates');
  }

  async createNFTCollection(userId: number, name: string, description: string): Promise<NftCollection> {
    return this.withRetry(async () => {
      const [collection] = await db.insert(nftCollections).values({
        userId,
        name,
        description,
        coverImage: null,
        createdAt: new Date()
      }).returning();
      return collection;
    }, 'Create NFT collection');
  }

  async createNFT(data: InsertNft): Promise<Nft> {
    return this.withRetry(async () => {
      const [nft] = await db.insert(nfts).values(data).returning();
      return nft;
    }, 'Create NFT');
  }

  async getNFTsByUserId(userId: number): Promise<Nft[]> {
    return this.withRetry(async () => {
      return await db.select()
        .from(nfts)
        .where(eq(nfts.ownerId, userId))
        .orderBy(desc(nfts.mintedAt));
    }, 'Get NFTs by user ID');
  }

  async getNFTCollectionsByUserId(userId: number): Promise<NftCollection[]> {
    return this.withRetry(async () => {
      return await db.select()
        .from(nftCollections)
        .where(eq(nftCollections.userId, userId))
        .orderBy(desc(nftCollections.createdAt));
    }, 'Get NFT collections by user ID');
  }

  async canGenerateNFT(userId: number): Promise<boolean> {
    return this.withRetry(async () => {
      const user = await this.getUser(userId);
      if (!user) return false;

      const now = new Date();
      const lastGeneration = user.last_nft_generation;
      
      if (!lastGeneration) return true;

      const timeDiff = now.getTime() - lastGeneration.getTime();
      const hoursDiff = timeDiff / (1000 * 60 * 60);
      
      return hoursDiff >= 24 && user.nft_generation_count < 3;
    }, 'Check if user can generate NFT');
  }

  async updateUserNFTGeneration(userId: number): Promise<void> {
    await this.withRetry(async () => {
      const user = await this.getUser(userId);
      if (!user) throw new Error("User not found");

      const now = new Date();
      const newCount = user.nft_generation_count + 1;

      await db.update(users)
        .set({ 
          last_nft_generation: now,
          nft_generation_count: newCount
        })
        .where(eq(users.id, userId));
    }, 'Update user NFT generation');
  }

  async getTransactionsByCardIds(cardIds: number[]): Promise<Transaction[]> {
    return this.withRetry(async () => {
      if (cardIds.length === 0) return [];
      
      return await db.select()
        .from(transactions)
        .where(or(
          inArray(transactions.fromCardId, cardIds),
          inArray(transactions.toCardId, cardIds)
        ))
        .orderBy(desc(transactions.createdAt));
    }, 'Get transactions by card IDs');
  }

  async createDefaultCardsForUser(userId: number): Promise<void> {
    await this.withRetry(async () => {
      const btcAddress = await generateValidAddress('btc', userId);
      const ethAddress = await generateValidAddress('eth', userId);
      
      const virtualCard = await this.createCard({
        userId,
        type: "virtual",
        number: this.generateCardNumber(),
        expiry: this.generateExpiryDate(),
        cvv: this.generateCVV(),
        balance: "1000",
        btcBalance: "0",
        ethBalance: "0",
        kichcoinBalance: "100",
        btcAddress: null,
        ethAddress: null,
        tonAddress: null
      });

      const cryptoCard = await this.createCard({
        userId,
        type: "crypto",
        number: this.generateCardNumber(),
        expiry: this.generateExpiryDate(),
        cvv: this.generateCVV(),
        balance: "0",
        btcBalance: "0.001",
        ethBalance: "0.01",
        kichcoinBalance: "50",
        btcAddress: btcAddress,
        ethAddress: ethAddress,
        tonAddress: null
      });

      console.log(`Created virtual card ${virtualCard.id} and crypto card ${cryptoCard.id} for user ${userId}`);
    }, 'Create default cards for user');
  }

  async deleteUser(userId: number): Promise<void> {
    await this.withRetry(async () => {
      await db.delete(cards).where(eq(cards.userId, userId));
      await db.delete(users).where(eq(users.id, userId));
    }, 'Delete user');
  }

  async executeRawQuery(query: string): Promise<any> {
    return this.withRetry(async () => {
      return await client.unsafe(query);
    }, 'Execute raw query');
  }

  private async withRetry<T>(operation: () => Promise<T>, operationName: string, maxRetries: number = 3): Promise<T> {
    let attempt = 0;
    while (attempt < maxRetries) {
      try {
        // Добавляем таймаут для каждой операции
        return await withTimeout(operation(), DB_TIMEOUT);
      } catch (error) {
        attempt++;
        console.error(`${operationName} failed on attempt ${attempt}:`, error);
        
        if (attempt >= maxRetries) {
          throw error;
        }
        
        // Уменьшаем задержку для Vercel
        const delay = IS_VERCEL ? 100 : Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    throw new Error(`Operation failed after ${maxRetries} attempts`);
  }

  private generateCardNumber(): string {
    const digits = Array.from({ length: 16 }, () => Math.floor(Math.random() * 10)).join("");
    return digits;
  }

  private generateExpiryDate(): string {
    const now = new Date();
    const expYear = now.getFullYear() + 4;
    const expMonth = (now.getMonth() + 1).toString().padStart(2, '0');
    return `${expMonth}/${expYear.toString().slice(-2)}`;
  }

  private generateCVV(): string {
    return Math.floor(100 + Math.random() * 900).toString();
  }
}

// Export singleton instance
export const storage = new DatabaseStorage();
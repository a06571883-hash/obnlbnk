import session from "express-session";
import { db } from "./db";
import { cards, users, transactions } from "@shared/schema";
import type { User, Card, InsertUser, Transaction } from "@shared/schema";
import { eq, and, or, desc } from "drizzle-orm";
import { pool } from "./db";
import connectPg from "connect-pg-simple";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import pg from 'pg';

const scryptAsync = promisify(scrypt);

const PostgresSessionStore = connectPg(session);

const sessionPool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 60000, // 1 minute
  connectionTimeoutMillis: 5000, // 5 seconds
  ssl: false,
  keepAlive: true
});

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
  transferMoney(fromCardId: number, toCardNumber: string, amount: number, wallet?: 'btc' | 'eth'): Promise<{ success: boolean; error?: string; transaction?: Transaction }>;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    console.log('Initializing DatabaseStorage with session store...');
    try {
      this.sessionStore = new PostgresSessionStore({
        pool: sessionPool,
        tableName: 'session',
        createTableIfMissing: true,
        pruneSessionInterval: 60 * 15, // 15 minutes
        errorLog: console.error.bind(console),
        schemaName: 'public',
        ttl: 24 * 60 * 60 // 24 hours
      });
      console.log('Session store initialized successfully');
    } catch (error) {
      console.error('Failed to initialize session store:', error);
      throw error;
    }
  }

  private async withRetry<T>(operation: () => Promise<T>, context: string): Promise<T> {
    let lastError: Error | undefined;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await operation();
        return result;
      } catch (error) {
        lastError = error as Error;
        console.error(`${context} failed (attempt ${attempt + 1}/3):`, error);
        if (attempt < 2) {
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
        }
      }
    }
    throw lastError || new Error(`${context} failed after 3 attempts`);
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.withRetry(async () => {
      console.log(`Getting user by ID: ${id}`);
      const [user] = await db.select().from(users).where(eq(users.id, id));
      console.log(`User found: ${user ? 'yes' : 'no'}`);
      return user;
    }, 'Get user');
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return this.withRetry(async () => {
      console.log(`Finding user by username: ${username}`);
      const [user] = await db.select().from(users).where(eq(users.username, username));
      console.log('Found user by username:', user ? 'yes' : 'no');
      return user;
    }, 'Get user by username');
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    return this.withRetry(async () => {
      console.log('Creating user:', insertUser.username);
      const [user] = await db.insert(users).values(insertUser).returning();
      console.log('User created successfully:', user.username);
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
        .set({ balance: balance })
        .where(eq(cards.id, cardId));
    }, 'Update card balance');
  }

  async getCardById(cardId: number): Promise<Card | undefined> {
    return this.withRetry(async () => {
      const [card] = await db.select().from(cards).where(eq(cards.id, cardId));
      return card;
    }, 'Get card by ID');
  }

  async getCardByNumber(cardNumber: string): Promise<Card | undefined> {
    return this.withRetry(async () => {
      const cleanCardNumber = cardNumber.replace(/\s+/g, '');
      const [card] = await db.select().from(cards).where(eq(cards.number, cleanCardNumber));
      console.log('Searching for card with number:', cleanCardNumber, 'Found:', card ? 'yes' : 'no');
      return card;
    }, 'Get card by number');
  }

  async getTransactionsByCardId(cardId: number): Promise<Transaction[]> {
    return this.withRetry(async () => {
      return await db.select()
        .from(transactions)
        .where(
          or(
            eq(transactions.fromCardId, cardId),
            eq(transactions.toCardId, cardId)
          )
        )
        .orderBy(desc(transactions.createdAt));
    }, 'Get transactions by card ID');
  }

  async createTransaction(transaction: Omit<Transaction, "id">): Promise<Transaction> {
    return this.withRetry(async () => {
      console.log('Creating transaction:', transaction);
      const [result] = await db.insert(transactions).values({
        fromCardId: transaction.fromCardId,
        toCardId: transaction.toCardId || null,
        amount: transaction.amount,
        convertedAmount: transaction.convertedAmount || transaction.amount,
        type: transaction.type,
        status: transaction.status || 'completed',
        description: transaction.description || null,
        wallet: transaction.wallet || null,
        fromCardNumber: transaction.fromCardNumber || null,
        toCardNumber: transaction.toCardNumber || null,
        createdAt: transaction.createdAt || new Date()
      }).returning();
      console.log('Transaction created:', result);
      return result;
    }, 'Create transaction');
  }

  async transferMoney(fromCardId: number, toCardNumber: string, amount: number, wallet?: 'btc' | 'eth'): Promise<{ success: boolean; error?: string; transaction?: Transaction }> {
    return this.withRetry(async () => {
      console.log(`Starting transfer: fromCardId=${fromCardId}, toCardNumber=${toCardNumber}, amount=${amount}, wallet=${wallet}`);

      if (amount <= 0) {
        return { success: false, error: "Сумма перевода должна быть больше 0" };
      }

      const fromCard = await this.getCardById(fromCardId);
      if (!fromCard) {
        return { success: false, error: "Карта отправителя не найдена" };
      }

      // Crypto transfer
      if (wallet) {
        if (fromCard.type !== 'crypto') {
          return { success: false, error: "Отправлять криптовалюту можно только с крипто-карты" };
        }

        const fromBalance = wallet === 'btc' ?
          parseFloat(fromCard.btcBalance || '0') :
          parseFloat(fromCard.ethBalance || '0');

        if (fromBalance < amount) {
          return {
            success: false,
            error: `Недостаточно ${wallet.toUpperCase()}. Требуется: ${amount}, Доступно: ${fromBalance}`
          };
        }

        const newFromBalance = (fromBalance - amount).toFixed(8);

        const transaction = await this.createTransaction({
          fromCardId: fromCard.id,
          toCardId: null,
          amount: amount.toString(),
          convertedAmount: amount.toString(),
          type: 'transfer',
          wallet: wallet,
          status: 'completed',
          description: `Перевод ${amount} ${wallet.toUpperCase()} на адрес ${toCardNumber}`,
          fromCardNumber: fromCard.number,
          toCardNumber: toCardNumber,
          createdAt: new Date()
        });

        if (wallet === 'btc') {
          await this.updateCardBtcBalance(fromCard.id, newFromBalance);
        } else {
          await this.updateCardEthBalance(fromCard.id, newFromBalance);
        }

        return { success: true, transaction };
      }

      // Regular card transfer
      const toCard = await this.getCardByNumber(toCardNumber);
      if (!toCard) {
        return { success: false, error: "Карта получателя не найдена" };
      }

      if (fromCard.id === toCard.id) {
        return { success: false, error: "Нельзя перевести деньги на ту же карту" };
      }

      const fromBalance = parseFloat(fromCard.balance);
      const toBalance = parseFloat(toCard.balance);

      if (fromBalance < amount) {
        return { success: false, error: `Недостаточно средств. Требуется: ${amount}, Доступно: ${fromBalance}` };
      }

      const newFromBalance = (fromBalance - amount).toFixed(2);
      const newToBalance = (toBalance + amount).toFixed(2);

      const transaction = await this.createTransaction({
        fromCardId: fromCard.id,
        toCardId: toCard.id,
        amount: amount.toString(),
        convertedAmount: amount.toString(),
        type: 'transfer',
        status: 'completed',
        description: `Перевод ${amount} ${fromCard.type.toUpperCase()}`,
        fromCardNumber: fromCard.number,
        toCardNumber: toCard.number,
        createdAt: new Date()
      });

      await this.updateCardBalance(fromCard.id, newFromBalance);
      await this.updateCardBalance(toCard.id, newToBalance);

      return { success: true, transaction };
    }, 'Transfer money');
  }

  async updateCardBtcBalance(cardId: number, balance: string): Promise<void> {
    await this.withRetry(async () => {
      await db.update(cards)
        .set({ btcBalance: balance })
        .where(eq(cards.id, cardId));
    }, 'Update card BTC balance');
  }

  async updateCardEthBalance(cardId: number, balance: string): Promise<void> {
    await this.withRetry(async () => {
      await db.update(cards)
        .set({ ethBalance: balance })
        .where(eq(cards.id, cardId));
    }, 'Update card ETH balance');
  }
}

export const storage = new DatabaseStorage();